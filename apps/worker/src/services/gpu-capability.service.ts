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
 * Encoders NVENC a tentar, do melhor para o mais compatível.
 *
 * Medido nesta placa (RTX 5060 Ti), mesmo corte, contra referência sem perdas:
 *   av1_nvenc  cq31 -> 2,58 MB  SSIM 0,990859
 *   hevc_nvenc cq25 -> 2,96 MB  SSIM 0,990709
 *   h264_nvenc cq23 -> 4,98 MB  SSIM 0,991351
 * AV1 entrega qualidade igual ou melhor que HEVC em 13% menos bytes, no mesmo
 * tempo de encode — e ainda toca nativamente em Chrome e Firefox, onde o HEVC
 * depende de decode por hardware.
 *
 * A ordem importa porque `av1_nvenc` só existe em placas Ada (RTX 40) ou mais
 * novas: numa RTX 30 a primeira sonda falha e a segunda pega. Sem essa cadeia,
 * uma placa mais antiga cairia direto para a CPU mesmo sabendo fazer HEVC.
 *
 * NVENC_CODEC explícito desliga a cadeia e respeita a escolha do operador.
 */
function nvencCandidates(): string[] {
    const explicit = process.env.NVENC_CODEC?.trim();
    if (explicit) return [explicit];
    return ["av1_nvenc", "hevc_nvenc", "h264_nvenc"];
}

/** `-cq` padrão de cada família, calibrado para a mesma qualidade percebida. */
function defaultCq(codec: string): string {
    if (codec.startsWith("av1")) return "31";
    if (codec.startsWith("hevc")) return "25";
    return "23";
}

/**
 * Lê uma variável tratando string vazia como ausente.
 *
 * O compose repassa `NVENC_CQ: ${NVENC_CQ:-}`, que chega como "" quando não
 * definida. Com `??` isso passaria direto e o ffmpeg receberia `-cq ""`.
 */
function envOr(name: string, fallback: string): string {
    const value = process.env[name];
    return value !== undefined && value.trim() !== "" ? value : fallback;
}

/**
 * Descobre, em tempo de execução, se dá para encodar na GPU (NVENC).
 *
 * A detecção NÃO se contenta com `ffmpeg -encoders` listando o encoder: o
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
    /** Codec que passou na sonda; o render precisa usar exatamente este. */
    private resolvedCodec?: string;

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
        const failures: string[] = [];
        for (const codec of nvencCandidates()) {
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
                        "-c:v", codec,
                        "-frames:v", "1",
                        "-f", "null",
                        "-",
                    ],
                    { timeout: PROBE_TIMEOUT_MS },
                );
                this.resolvedCodec = codec;
                this.logger.log({ msg: `GPU detectada: encode por NVENC habilitado (${codec})`, encoder: codec });
                this.lastResult = { available: true, at: Date.now() };
                return true;
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                failures.push(`${codec}: ${detail.split("\n").filter(Boolean).slice(-1)[0] ?? detail}`);
            }
        }

        this.resolvedCodec = undefined;
        this.logger.log({
            msg: `GPU indisponível; encode seguirá em CPU (libx264) — nova tentativa em até ${Math.round(retryCooldownMs() / 1000)}s`,
            encoder: "libx264",
            // Sem placa isso é esperado, não é erro — fica em log normal.
            detail: failures.join(" | "),
        });
        this.lastResult = { available: false, at: Date.now() };
        return false;
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
            // HEVC por padrao: medido no mesmo corte de 30s, gasta o mesmo tempo
            // do H.264 (5,9s contra 6,0s) e gera metade do arquivo (8,9MB contra
            // 16,3MB) — o encode ja esta no NVENC, entao a economia sai de graca.
            // NVENC_CODEC=h264_nvenc reverte sem rebuild se algum destino de
            // publicacao recusar HEVC.
            // O codec que a sonda aprovou; antes dela, o primeiro da cadeia.
            const codec = this.resolvedCodec ?? nvencCandidates()[0];
            const isHevc = codec.startsWith("hevc");
            return [
                "-c:v", codec,
                "-preset", envOr("NVENC_PRESET", "p4"),
                "-tune", "hq",
                "-rc", "vbr",
                // HEVC entrega a mesma qualidade percebida num CQ mais alto.
                "-cq", envOr("NVENC_CQ", defaultCq(codec)),
                // Em modo CQ puro o bitrate alvo precisa ficar livre.
                "-b:v", "0",
                // MP4 aceita duas marcacoes para HEVC: `hev1` (padrao do ffmpeg)
                // e `hvc1`. QuickTime, Safari e o iOS so tocam `hvc1` — sem esta
                // tag o arquivo abre preto no ecossistema Apple.
                ...(isHevc ? ["-tag:v", "hvc1"] : []),
            ];
        }
        // O fallback de CPU segue em H.264 de proposito: o x265 por software e
        // ordens de grandeza mais lento que o x264, e este caminho so roda quando
        // a GPU ja falhou — trocar o codec aqui transformaria uma degradacao em
        // travamento.
        return [
            "-c:v", "libx264",
            "-preset", cpuPreset,
            "-threads", String(threads),
            "-crf", "23",
        ];
    }
}
