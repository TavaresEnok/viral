import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Teste de encode é curtíssimo; se travar mais que isso, a GPU não está sã. */
const PROBE_TIMEOUT_MS = 15_000;

/**
 * `auto` (padrão) detecta em runtime. `cpu` força libx264 mesmo com GPU
 * presente. `gpu` NÃO é oferecido de propósito: forçar a GPU quebraria o
 * requisito de "tirar a placa e o sistema subir mesmo assim".
 */
function encoderMode(): "auto" | "cpu" {
    return (process.env.VIDEO_ENCODER ?? "auto").toLowerCase() === "cpu" ? "cpu" : "auto";
}

/**
 * Descobre, em tempo de execução, se dá para encodar na GPU (NVENC).
 *
 * A detecção NÃO se contenta com `ffmpeg -encoders` listando h264_nvenc: o
 * binário do Debian lista o encoder mesmo em máquina sem placa nenhuma. Só um
 * encode de teste de verdade prova que driver + placa + container estão ok.
 *
 * O resultado é cacheado por processo. Se a placa for removida, o worker sobe
 * igual e cai para CPU sozinho — e se a GPU falhar no meio de um render, o
 * FfmpegService ainda refaz aquele render em CPU.
 */
@Injectable()
export class GpuCapabilityService {
    private readonly logger = new Logger(GpuCapabilityService.name);
    private probe?: Promise<boolean>;

    /** true quando o encode por GPU foi verificado e funciona. */
    async isNvencAvailable(): Promise<boolean> {
        if (encoderMode() === "cpu") return false;
        this.probe ??= this.runProbe();
        return this.probe;
    }

    private async runProbe(): Promise<boolean> {
        try {
            // Gera 1 frame sintético e tenta encodar descartando a saída.
            // Não toca em disco nem depende de nenhum arquivo de entrada.
            await execFileAsync(
                "ffmpeg",
                [
                    "-hide_banner",
                    "-loglevel", "error",
                    "-f", "lavfi",
                    "-i", "color=c=black:s=256x256:d=0.1",
                    "-c:v", "h264_nvenc",
                    "-frames:v", "1",
                    "-f", "null",
                    "-",
                ],
                { timeout: PROBE_TIMEOUT_MS },
            );
            this.logger.log({
                msg: "GPU detectada: encode por NVENC habilitado (h264_nvenc)",
                encoder: "h264_nvenc",
            });
            return true;
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.logger.log({
                msg: "GPU indisponível; encode seguirá em CPU (libx264)",
                encoder: "libx264",
                // Sem placa isso é esperado, não é erro — fica em log normal.
                detail: detail.split("\n").filter(Boolean).slice(-1)[0] ?? detail,
            });
            return false;
        }
    }

    /**
     * Argumentos de codec de vídeo para o ffmpeg.
     *
     * NVENC não aceita `-crf` nem os presets do x264 (`veryfast` etc.): usa
     * `-cq` para qualidade constante e presets p1..p7. p4 equivale a "medium"
     * e, mesmo assim, é muito mais rápido que o x264 em CPU.
     */
    videoCodecArgs(useGpu: boolean, cpuPreset: string, threads: number): string[] {
        if (useGpu) {
            return [
                "-c:v", "h264_nvenc",
                "-preset", process.env.NVENC_PRESET ?? "p4",
                "-tune", "hq",
                "-rc", "vbr",
                "-cq", process.env.NVENC_CQ ?? "23",
                // Em modo CQ puro o bitrate alvo precisa ficar livre.
                "-b:v", "0",
            ];
        }
        return [
            "-c:v", "libx264",
            "-preset", cpuPreset,
            "-threads", String(threads),
            "-crf", "23",
        ];
    }
}
