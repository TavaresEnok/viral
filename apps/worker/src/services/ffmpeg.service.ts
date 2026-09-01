import { Injectable, Logger } from "@nestjs/common";
import type { RenderLayout } from "@prisma/client";
import { execFile } from "node:child_process";
import { cpus } from "node:os";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { GpuCapabilityService } from "./gpu-capability.service.js";
import type { FaceTrackPoint, SmoothedCrop } from "./smart-crop.service.js";

const execFileAsync = promisify(execFile);

// O default do execFile é 1MB: ffmpeg emitindo warning por frame (ex.: "Past
// duration too large") estoura isso num render longo, e o Node MATA o processo
// no meio, com um erro que não parece de ffmpeg.
const EXEC_MAX_BUFFER = 64 * 1024 * 1024;

const FFMPEG_TIMEOUT_MS = parseInt(
    process.env.FFMPEG_TIMEOUT_MS ?? "600000",
    10,
);

// Resolução em que o fundo desfocado é gerado antes de ser ampliado para
// 1080x1920. 1/4 da largura = 16x menos pixels para o boxblur processar.
const BLUR_WIDTH = 270;
const BLUR_HEIGHT = 480;
const BLUR_DOWNSCALE = 4;

/**
 * Filtros da GPU (scale_cuda/overlay_cuda) para o layout padrão.
 *
 * Medido no mesmo corte de 30s, com `/proc/<pid>/stat` somando tempo de
 * usuário+sistema do processo ffmpeg (não só o relógio de parede):
 *   filtros CPU:  6,3s de parede, 14,5s de CPU somada entre os threads
 *   filtros CUDA: 9,1s de parede, 11,7s de CPU somada
 * Mais lento (a legenda ainda força um hwdownload antes do libass, que não
 * tem versão GPU em nenhum ffmpeg), mas ~19% menos CPU total consumida — o
 * pedido explícito era exatamente essa troca: tirar carga da CPU mesmo que
 * o render individual demore mais.
 *
 * `RENDER_GPU_FILTERS=false` desliga sem rebuild, caindo nos filtros de CPU.
 */
function gpuFiltersEnabled(): boolean {
    return (process.env.RENDER_GPU_FILTERS ?? "true").toLowerCase() !== "false";
}

function positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : fallback;
}

export type { FaceTrackPoint };

@Injectable()
export class FfmpegService {
    private readonly logger = new Logger(FfmpegService.name);
    private readonly threads = positiveInt(
        process.env.FFMPEG_THREADS,
        Math.max(1, Math.floor(cpus().length / 4)),
    );
    private readonly preset = process.env.FFMPEG_PRESET ?? "veryfast";

    constructor(private readonly gpu: GpuCapabilityService) {}

    async ensureDir(path: string) {
        await mkdir(dirname(path), { recursive: true });
    }

    private async execFfprobe(args: string[]): Promise<{ stdout: string }> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FFMPEG_TIMEOUT_MS);
        try {
            return await execFileAsync("ffprobe", args, {
                signal: controller.signal,
                maxBuffer: EXEC_MAX_BUFFER,
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    private async execFfmpeg(
        args: string[],
    ): Promise<{ stdout: string; stderr: string }> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FFMPEG_TIMEOUT_MS);
        try {
            return await execFileAsync("ffmpeg", args, {
                signal: controller.signal,
                maxBuffer: EXEC_MAX_BUFFER,
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    async probeDuration(filePath: string): Promise<number> {
        const { stdout } = await this.execFfprobe([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            filePath,
        ]);
        return Number(stdout.trim());
    }

    async hasVideoStream(filePath: string): Promise<boolean> {
        try {
            const { stdout } = await this.execFfprobe([
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_type",
                "-of",
                "csv=p=0",
                filePath,
            ]);
            return stdout.trim() === "video";
        } catch {
            return false;
        }
    }

    async extractAudio(inputPath: string, outputPath: string) {
        await this.ensureDir(outputPath);
        await this.execFfmpeg([
            "-y",
            "-threads",
            String(this.threads),
            "-i",
            inputPath,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "128k",
            outputPath,
        ]);
    }

    /**
     * Extrai só o áudio de um intervalo. Usado para regerar a legenda de UM
     * corte: transcrever 40s custa segundos, o vídeo inteiro custa minutos.
     * -ss/-t antes do -i = seek rápido, e o ffmpeg zera os timestamps (a saída
     * começa em 0, relativa ao início do trecho).
     */
    async extractAudioRange(inputPath: string, outputPath: string, startSec: number, durationSec: number) {
        await this.ensureDir(outputPath);
        await this.execFfmpeg([
            "-y",
            "-threads",
            String(this.threads),
            "-ss",
            String(Math.max(0, startSec)),
            "-t",
            String(Math.max(1, durationSec)),
            "-i",
            inputPath,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "128k",
            outputPath,
        ]);
    }

    async splitAudio(inputPath: string, outputPattern: string) {
        await this.ensureDir(outputPattern);
        await this.execFfmpeg([
            "-y",
            "-threads",
            String(this.threads),
            "-i",
            inputPath,
            "-f",
            "segment",
            "-segment_time",
            "600",
            "-c",
            "copy",
            outputPattern,
        ]);
    }

    async renderClip(
        inputPath: string,
        outputPath: string,
        subtitlePath: string,
        start: number,
        end: number,
        renderLayout: RenderLayout,
        smartCrop?: SmoothedCrop | null,
        watermarkText?: string,
        dualCrop?: [SmoothedCrop, SmoothedCrop],
        brollSegments?: Array<{ filePath: string; startSec: number; endSec: number }>,
    ) {
        await this.ensureDir(outputPath);
        const duration = Math.max(1, end - start);
        const escapedSubtitlePath = this.escapeFilterPath(subtitlePath);
        const useGpu = await this.gpu.isNvencAvailable();
        // Só o layout padrão (sem crop de verdade em lugar nenhum da cadeia)
        // tem equivalente em CUDA — os outros usam recorte de enquadramento
        // exato, que não existe para frames de hardware.
        const useGpuFilters = useGpu && gpuFiltersEnabled() && renderLayout === "BLURRED_BACKGROUND";

        const buildFilter = (gpuFilters: boolean) => {
            const baseFilter = gpuFilters
                ? this.gpuBlurredBackgroundFilter()
                : this.videoLayoutFilter(renderLayout, smartCrop, dualCrop);

            // B-roll (EXPERIMENTAL): só entra com plano não-vazio (BROLL_ENABLED).
            // Quando vazio, `brollChain` é "" e `videoLabel` continua "vbase", então
            // o filtergraph e os inputs ficam IDÊNTICOS ao comportamento atual.
            // Funciona igual nos dois casos: a versão GPU já devolve `[vbase]` em
            // memória normal (hwdownload embutido), então b-roll/legenda/marca
            // d'água nunca precisam saber se o fundo veio da CPU ou da GPU.
            const broll = brollSegments ?? [];
            let videoLabel = "vbase";
            const brollParts: string[] = [];
            broll.forEach((seg, idx) => {
                const inputIdx = idx + 1; // input 0 é o vídeo principal
                const next = `vbr${idx}`;
                brollParts.push(
                    `[${inputIdx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[br${idx}]`,
                );
                brollParts.push(
                    `[${videoLabel}][br${idx}]overlay=0:0:enable='between(t,${seg.startSec},${seg.endSec})'[${next}]`,
                );
                videoLabel = next;
            });
            const brollChain = brollParts.length ? `;${brollParts.join(";")}` : "";

            // Legenda (e marca d'água) ficam SEMPRE por cima do B-roll.
            let filter = `${baseFilter}${brollChain};[${videoLabel}]subtitles='${escapedSubtitlePath}'[v]`;
            if (watermarkText) {
                const escapedText = this.escapeFilterPath(watermarkText);
                filter = `${baseFilter}${brollChain};[${videoLabel}]subtitles='${escapedSubtitlePath}'[vtmp];[vtmp]drawtext=text='${escapedText}':fontcolor=white@0.6:fontsize=36:x=(w-text_w)/2:y=h-th-80:box=1:boxcolor=black@0.4:boxborderw=10[v]`;
            }
            return filter;
        };

        const broll = brollSegments ?? [];
        const brollInputArgs = broll.flatMap((seg) => ["-i", seg.filePath]);

        // `useGpuDecode` é separado de `useGpu`: a retentativa após uma falha de
        // GPU (VRAM cheia, sessão NVDEC/NVENC esgotada, driver reiniciou) passa
        // `false` aqui mesmo com `useGpu` continuando `true`, porque o decode
        // também é GPU e poderia falhar pelo mesmo motivo — a rede de segurança
        // só protege de verdade se for inteiramente livre de GPU.
        const buildArgs = (codecArgs: string[], gpuFilters: boolean, useGpuDecode: boolean) => [
            "-y",
            "-threads",
            String(this.threads),
            // Decode-only por padrão: baixa o frame pra memória normal logo após
            // decodificar, então os filtros de CPU (crop, boxblur etc.) funcionam
            // sem nenhuma mudança. Com filtros em CUDA, o frame fica na GPU até o
            // hwdownload embutido no fim de `gpuBlurredBackgroundFilter`.
            ...(useGpuDecode ? (gpuFilters ? ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"] : ["-hwaccel", "cuda"]) : []),
            "-ss",
            String(start),
            "-t",
            String(duration),
            "-i",
            inputPath,
            ...brollInputArgs,
            "-filter_complex",
            buildFilter(gpuFilters),
            "-map",
            "[v]",
            "-map",
            "0:a?",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            ...codecArgs,
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-pix_fmt",
            "yuv420p",
            outputPath,
        ];

        try {
            await this.execFfmpeg(
                buildArgs(this.gpu.videoCodecArgs(useGpu, this.preset, this.threads), useGpuFilters, useGpu),
            );
        } catch (error) {
            // A GPU pode existir no boot e falhar depois (driver caiu, VRAM
            // cheia, outro processo tomou o encoder ou os filtros CUDA). Refaz o
            // corte inteiramente em CPU em vez de derrubar o render — sem isso um
            // soluço da placa quebraria todos os cortes do projeto.
            if (!useGpu) throw error;
            this.logger.warn({
                msg: "Render por GPU falhou; refazendo este corte em CPU (filtros e encode)",
                error: error instanceof Error ? error.message : String(error),
                usedGpuFilters: useGpuFilters,
            });
            await this.execFfmpeg(
                buildArgs(this.gpu.videoCodecArgs(false, this.preset, this.threads), false, false),
            );
        }
    }

    /**
     * Cadeia do fundo desfocado, gerada em BAIXA resolução e depois ampliada.
     *
     * `boxblur` não tem slice threading (roda praticamente single-thread), e
     * borrar 1080x1920 direto custava ~31s por corte de 30s — 97% do tempo de
     * render, medido. Era daí que vinha o consumo alto de CPU, não do decode
     * nem do encode, que somam ~2s (o encode já está no NVENC).
     *
     * Como o resultado é um fundo BORRADO, resolução alta é desperdício: o
     * blur destrói o detalhe de qualquer forma. Borrando em 1/4 da largura
     * (16x menos pixels), com o raio reduzido na mesma proporção e o mesmo
     * número de passagens, o resultado fica praticamente idêntico
     * (SSIM 0,989 medido contra o filtro antigo) e ~11x mais rápido.
     */
    private blurredBackground(radius: number, passes: number): string {
        const lowRadius = Math.max(1, Math.round(radius / BLUR_DOWNSCALE));
        return [
            `scale=${BLUR_WIDTH}:${BLUR_HEIGHT}:force_original_aspect_ratio=increase`,
            `crop=${BLUR_WIDTH}:${BLUR_HEIGHT}`,
            `boxblur=${lowRadius}:${passes}`,
            "scale=1080:1920",
        ].join(",");
    }

    /**
     * Equivalente do fundo desfocado inteiramente em frames CUDA — sem CPU
     * nenhuma até a legenda.
     *
     * Não existe `crop` para frames de hardware (testado: ffmpeg recusa com
     * "Function not implemented"), então em vez de scale-increase→crop→blur
     * uso um scale_cuda direto pro tamanho baixo, ignorando o aspect ratio
     * exato. Isso distorce levemente a imagem antes do blur — mas o próprio
     * propósito desta camada é ficar fora de foco atrás do vídeo principal,
     * então a distorção some junto com o blur; não é visível no resultado.
     */
    private cudaBlurredBackground(): string {
        return [`scale_cuda=${BLUR_WIDTH}:${BLUR_HEIGHT}`, "scale_cuda=1080:1920"].join(",");
    }

    /**
     * Layout padrão (BLURRED_BACKGROUND) inteiramente em CUDA, terminando em
     * `[vbase]` já em memória normal — o resto do filtergraph (b-roll,
     * legenda, marca d'água) continua igual, sem saber se o fundo veio da
     * CPU ou da GPU.
     *
     * Só serve para este layout: os outros usam `crop` de verdade (recortar
     * um enquadramento exato dentro do frame, não só redimensionar), que não
     * tem equivalente em frames CUDA.
     */
    private gpuBlurredBackgroundFilter(): string {
        return [
            `[0:v]${this.cudaBlurredBackground()}[bg]`,
            "[0:v]scale_cuda=980:1740:force_original_aspect_ratio=decrease[fg]",
            "[bg][fg]overlay_cuda=(W-w)/2:(H-h)/2[o]",
            // Volta pra memória normal aqui — subtitles (libass) não roda em
            // CUDA em nenhum ffmpeg existente, então este hwdownload é
            // inevitável em algum ponto da cadeia.
            "[o]hwdownload,format=nv12[vbase]",
        ].join(";");
    }

    private videoLayoutFilter(
        renderLayout: RenderLayout,
        smartCrop?: SmoothedCrop | null,
        dualCrop?: [SmoothedCrop, SmoothedCrop],
    ): string {
        if (renderLayout === "SMART_REFRAME") {
            if (smartCrop) {
                const cx = smartCrop.cx.toFixed(4);
                const cy = smartCrop.cy.toFixed(4);
                // Crop a 9:16 window centered on the detected face (X axis),
                // with vertical offset based on face Y so face stays in upper third
                return [
                    // Scale to tall square so we have room to crop both axes
                    `[0:v]scale=1920:1920:force_original_aspect_ratio=increase[scaled]`,
                    // Horizontal crop centered on face; vertical offset puts face at ~30% from top
                    `[scaled]crop=1080:1920:max(0\\,min(iw-1080\\,(iw*${cx})-540)):max(0\\,min(ih-1920\\,(ih*${cy})-576))[vbase]`,
                ].join(';');
            }
            return "[0:v]scale=1920:1920:force_original_aspect_ratio=increase,crop=1080:1920[vbase]";
        }

        if (renderLayout === "FILL_CROP") {
            return "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[vbase]";
        }

        if (renderLayout === "CENTER_FIT") {
            return "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black[vbase]";
        }

        if (renderLayout === "TOP_FRAME") {
            return [
                "color=c=black:s=1080x1920[canvas]",
                "[0:v]scale=1080:1280:force_original_aspect_ratio=decrease,pad=1080:1280:(ow-iw)/2:(oh-ih)/2:color=black[fg]",
                "[canvas][fg]overlay=0:110[vbase]",
            ].join(";");
        }

        if (renderLayout === "SMART_CENTER") {
            if (smartCrop) {
                // Keep face in upper third of the 9:16 frame (good for speaker content)
                const cx = smartCrop.cx.toFixed(4);
                const cy = smartCrop.cy.toFixed(4);
                return [
                    `[0:v]scale=1920:1920:force_original_aspect_ratio=increase[scaled]`,
                    `[scaled]crop=1080:1920:max(0\\,min(iw-1080\\,(iw*${cx})-540)):max(0\\,min(ih-1920\\,(ih*${cy})-384))[vbase]`,
                ].join(';');
            }
            return "[0:v]scale=1920:1920:force_original_aspect_ratio=increase,crop=1080:1920[vbase]";
        }

        if (renderLayout === "SPEAKER_CLOSEUP") {
            if (smartCrop) {
                // Tighter crop (closer zoom) centered on face
                const cx = smartCrop.cx.toFixed(4);
                const cy = smartCrop.cy.toFixed(4);
                return [
                    `[0:v]scale=2160:2160:force_original_aspect_ratio=increase[scaled]`,
                    `[scaled]crop=1080:1920:max(0\\,min(iw-1080\\,(iw*${cx})-540)):max(0\\,min(ih-1920\\,(ih*${cy})-576))[vbase]`,
                ].join(';');
            }
            return "[0:v]scale=1440:2560:force_original_aspect_ratio=increase,crop=1080:1920[vbase]";
        }

        if (renderLayout === "PODCAST_SPLIT_STATIC") {
            if (dualCrop) {
                const [L, R] = dualCrop;
                const lx = L.cx.toFixed(4); const ly = L.cy.toFixed(4);
                const rx = R.cx.toFixed(4); const ry = R.cy.toFixed(4);
                // Scale to 2160x2160, crop each speaker into 540x960, hstack
                return [
                    `[0:v]split=2[src0][src1]`,
                    `[src0]scale=2160:2160:force_original_aspect_ratio=increase[big0]`,
                    `[big0]crop=1080:1920:max(0\\,min(iw-1080\\,(iw*${lx})-540)):max(0\\,min(ih-1920\\,(ih*${ly})-576)),scale=540:960[left]`,
                    `[src1]scale=2160:2160:force_original_aspect_ratio=increase[big1]`,
                    `[big1]crop=1080:1920:max(0\\,min(iw-1080\\,(iw*${rx})-540)):max(0\\,min(ih-1920\\,(ih*${ry})-576)),scale=540:960[right]`,
                    `[left][right]hstack=inputs=2[vbase]`,
                ].join(";");
            }
            // Fallback: static side-by-side (both halves of same video)
            return [
                `[0:v]${this.blurredBackground(24, 8)}[bg]`,
                "[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[left]",
                "[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[right]",
                "[bg][left]overlay=0:0[bg_left]",
                "[bg_left][right]overlay=540:0[vbase]",
            ].join(";");
        }

        if (renderLayout === "SCREEN_PLUS_FACE") {
            return [
                `[0:v]${this.blurredBackground(12, 4)}[bg]`,
                "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[full]",
                "[bg][full]overlay=(W-w)/2:(H-h)/2[bg_full]",
                "[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,split[inset]",
                "[bg_full][inset]overlay=W-w-20:H-h-20[vbase]",
            ].join(";");
        }

        return [
            `[0:v]${this.blurredBackground(24, 8)}[bg]`,
            "[0:v]scale=980:1740:force_original_aspect_ratio=decrease[fg]",
            "[bg][fg]overlay=(W-w)/2:(H-h)/2[vbase]",
        ].join(";");
    }

    private escapeFilterPath(path: string): string {
        return path
            .replace(/\\/g, "/")
            .replace(/:/g, "\\:")
            .replace(/'/g, "\\'")
            .replace(/%/g, "\\%")
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
            .replace(/;/g, "\\;")
            .replace(/=/g, "\\=")
            .replace(/\s/g, "\\ ");
    }

    async thumbnail(inputPath: string, outputPath: string, start: number) {
        await this.ensureDir(outputPath);
        // `crop` não existe pra frames CUDA (testado), então só o decode vai
        // pra GPU aqui — decode-only não muda o filtro, é ganho sem risco.
        const useGpu = await this.gpu.isNvencAvailable();
        await this.execFfmpeg([
            "-y",
            "-threads",
            String(this.threads),
            ...(useGpu ? ["-hwaccel", "cuda"] : []),
            "-ss",
            String(start + 2),
            "-i",
            inputPath,
            "-vf",
            "scale=540:960:force_original_aspect_ratio=increase,crop=540:960",
            "-frames:v",
            "1",
            "-q:v",
            "3",
            outputPath,
        ]);
    }
}
