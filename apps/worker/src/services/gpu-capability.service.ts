import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Teste de encode é curtíssimo; se travar mais que isso, a GPU não está sã. */
const PROBE_TIMEOUT_MS = 15_000;

/**
 * Intervalo mínimo entre novas tentativas depois de uma falha.
 *
 * Um container de vida longa pode perder e recuperar o handle da GPU sem
 * nenhuma mudança de configuração (visto em produção: 19h rodando, GPU
 * presente e sã, mas `cuInit` devolvendo CUDA_ERROR_NO_DEVICE só para este
 * processo — resolvido recriando o container). Cachear a falha PARA SEMPRE
 * prendia o worker em CPU até o próximo restart manual, mesmo quando a GPU
 * voltava a responder sozinha minutos depois.
 */
function retryCooldownMs(): number {
    const parsed = Number(process.env.GPU_PROBE_RETRY_COOLDOWN_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60_000;
}

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
 * Sucesso é cacheado para sempre (mudar de GPU pra CPU em runtime, com o
 * container no ar, é raro). Falha é cacheada só até um cooldown expirar —
 * uma sonda que falhou uma vez tenta de novo mais tarde sozinha, em vez de
 * prender o processo em CPU até o próximo restart manual.
 *
 * Se a placa for removida de vez, o worker sobe igual e cai para CPU. Se a
 * GPU falhar no meio de um render, o FfmpegService ainda refaz aquele render
 * em CPU.
 */
@Injectable()
export class GpuCapabilityService {
    private readonly logger = new Logger(GpuCapabilityService.name);
    /** Sonda em andamento — evita duas sondas simultâneas concorrendo. */
    private inFlight?: Promise<boolean>;
    /** Último resultado CONHECIDO e o instante em que foi obtido. */
    private lastResult?: { available: boolean; at: number };

    /**
     * true quando o encode por GPU foi verificado e funciona.
     *
     * Sucesso é cacheado para sempre (GPU raramente some com o container no
     * ar, e se sumir no meio de um render, o FfmpegService já refaz aquele
     * render em CPU). Falha é cacheada só até o cooldown expirar, para um
     * problema transitório se curar sozinho sem exigir restart manual.
     */
    async isNvencAvailable(): Promise<boolean> {
        if (encoderMode() === "cpu") return false;

        if (this.lastResult) {
            const stillFresh = this.lastResult.available || Date.now() - this.lastResult.at < retryCooldownMs();
            if (stillFresh) return this.lastResult.available;
        }

        this.inFlight ??= this.runProbe().finally(() => {
            this.inFlight = undefined;
        });
        return this.inFlight;
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
            this.lastResult = { available: true, at: Date.now() };
            return true;
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.logger.log({
                msg: `GPU indisponível; encode seguirá em CPU (libx264) — nova tentativa em até ${Math.round(retryCooldownMs() / 1000)}s`,
                encoder: "libx264",
                // Sem placa isso é esperado, não é erro — fica em log normal.
                detail: detail.split("\n").filter(Boolean).slice(-1)[0] ?? detail,
            });
            this.lastResult = { available: false, at: Date.now() };
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
