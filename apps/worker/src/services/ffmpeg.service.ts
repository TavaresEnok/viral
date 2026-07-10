import { Injectable } from "@nestjs/common";
import type { RenderLayout } from "@prisma/client";
import { execFile } from "node:child_process";
import { cpus } from "node:os";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { FaceTrackPoint, SmoothedCrop } from "./smart-crop.service.js";

const execFileAsync = promisify(execFile);

const FFMPEG_TIMEOUT_MS = parseInt(
    process.env.FFMPEG_TIMEOUT_MS ?? "600000",
    10,
);

function positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : fallback;
}

export type { FaceTrackPoint };

@Injectable()
export class FfmpegService {
    private readonly threads = positiveInt(
        process.env.FFMPEG_THREADS,
        Math.max(1, Math.floor(cpus().length / 4)),
    );
    private readonly preset = process.env.FFMPEG_PRESET ?? "veryfast";

    async ensureDir(path: string) {
        await mkdir(dirname(path), { recursive: true });
    }

    private async execFfprobe(args: string[]): Promise<{ stdout: string }> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FFMPEG_TIMEOUT_MS);
        try {
            return await execFileAsync("ffprobe", args, {
                signal: controller.signal,
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
        const baseFilter = this.videoLayoutFilter(renderLayout, smartCrop, dualCrop);

        // B-roll (EXPERIMENTAL): só entra com plano não-vazio (BROLL_ENABLED).
        // Quando vazio, `brollChain` é "" e `videoLabel` continua "vbase", então
        // o filtergraph e os inputs ficam IDÊNTICOS ao comportamento atual.
        const broll = brollSegments ?? [];
        const brollInputArgs = broll.flatMap((seg) => ["-i", seg.filePath]);
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

        await this.execFfmpeg([
            "-y",
            "-threads",
            String(this.threads),
            "-ss",
            String(start),
            "-t",
            String(duration),
            "-i",
            inputPath,
            ...brollInputArgs,
            "-filter_complex",
            filter,
            "-map",
            "[v]",
            "-map",
            "0:a?",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:v",
            "libx264",
            "-preset",
            this.preset,
            "-threads",
            String(this.threads),
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-pix_fmt",
            "yuv420p",
            outputPath,
        ]);
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
                "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:8[bg]",
                "[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[left]",
                "[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[right]",
                "[bg][left]overlay=0:0[bg_left]",
                "[bg_left][right]overlay=540:0[vbase]",
            ].join(";");
        }

        if (renderLayout === "SCREEN_PLUS_FACE") {
            return [
                "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=12:4[bg]",
                "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[full]",
                "[bg][full]overlay=(W-w)/2:(H-h)/2[bg_full]",
                "[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,split[inset]",
                "[bg_full][inset]overlay=W-w-20:H-h-20[vbase]",
            ].join(";");
        }

        return [
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:8[bg]",
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
        await this.execFfmpeg([
            "-y",
            "-threads",
            String(this.threads),
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
