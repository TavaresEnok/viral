import { Injectable, Logger } from "@nestjs/common";
import type { CaptionTheme, RenderLayout } from "@prisma/client";
import type { TranscriptSegment } from "@viralforge/clip-analyzer";
import type { Clip } from "@prisma/client";
import { dirname, resolve } from "node:path";
import { FfmpegService } from "./ffmpeg.service.js";
import { RemoteRenderingService } from "./remote-rendering.service.js";
import { SubtitleService } from "./subtitle.service.js";
import { RemotionRenderService } from "./remotion-render.service.js";
import type { WordSegment } from "@viralforge/render-engine";
import { FaceDetectionService } from "./face-detection.service.js";
import { SmartCropService, type SmoothedCrop } from "./smart-crop.service.js";
import { BrollPlanService } from "./broll-plan.service.js";

const SMART_LAYOUTS: RenderLayout[] = ["SMART_REFRAME", "SMART_CENTER", "SPEAKER_CLOSEUP"];
const DUAL_FACE_LAYOUTS: RenderLayout[] = ["PODCAST_SPLIT_STATIC"];

type RenderOptions = {
    captionTheme: CaptionTheme;
    renderLayout: RenderLayout;
    words?: WordSegment[];
    remoteMediaId?: string | null;
    disableRemote?: boolean;
    watermarkText?: string;
    /** Render only the first N seconds of the clip for fast preview. */
    previewSeconds?: number;
    /** Enable automatic emoji/SFX overlays (Remotion engine only). */
    autoOverlays?: boolean;
};

export type RenderClipResult = {
    videoPath: string;
    thumbnailPath: string;
    srtPath: string;
    vttPath: string;
    renderEngine: string;
    renderDurationMs: number;
    /**
     * Face track usado no render LOCAL. É null quando o node remoto atendeu:
     * ele faz o próprio tracking, então não existe crop local a reportar.
     */
    smartCrop: SmoothedCrop | null;
};

@Injectable()
export class RenderingService {
    private readonly logger = new Logger(RenderingService.name);

    constructor(
        private readonly ffmpeg: FfmpegService,
        private readonly remote: RemoteRenderingService,
        private readonly subtitles: SubtitleService,
        private readonly remotion: RemotionRenderService,
        private readonly faceDetection: FaceDetectionService,
        private readonly smartCrop: SmartCropService,
        private readonly brollPlan: BrollPlanService,
    ) {}

    async prepareRemoteInput(inputPath: string): Promise<string | null> {
        if (!this.remote.isEnabled()) return null;
        try {
            return await this.remote.uploadMedia(inputPath);
        } catch (error) {
            this.logger.warn({
                msg: "Remote render input upload failed; local fallback will be used",
                error: error instanceof Error ? error.message : error,
            });
            return null;
        }
    }

    async releaseRemoteInput(
        remoteMediaId: string | null | undefined,
    ): Promise<void> {
        await this.remote.deleteMedia(remoteMediaId);
    }

    async renderClip(
        inputPath: string,
        clip: Clip,
        segments: TranscriptSegment[],
        options: RenderOptions,
    ): Promise<RenderClipResult> {
        const projectDir = dirname(inputPath);
        const baseDir = resolve(projectDir, "clips", clip.id);
        const srtPath = resolve(baseDir, "subtitle.srt");
        const vttPath = resolve(baseDir, "subtitle.vtt");
        const assPath = resolve(baseDir, "subtitle.ass");
        const videoPath = resolve(baseDir, "clip.mp4");
        const thumbnailPath = resolve(baseDir, "thumb.jpg");
        // Preview mode: clamp render end so only first N seconds are rendered.
        // The resulting short clip occupies the same videoPath; a subsequent
        // full render will replace it.
        const renderEnd = typeof options.previewSeconds === 'number'
            ? Math.min(clip.end, clip.start + options.previewSeconds)
            : clip.end;

        await this.subtitles.writeSubtitles(
            segments,
            clip.start,
            renderEnd,
            srtPath,
            vttPath,
            assPath,
            options.captionTheme,
            options.words,
        );

        const startedAt = Date.now();
        let renderEngine = "ffmpeg";
        const shouldUseRemotion = process.env.RENDER_ENGINE === "remotion";
        let ownedRemoteMediaId: string | null = null;

        // Face tracking para layouts smart; dual-face para PODCAST_SPLIT_STATIC.
        //
        // PREGUIÇOSO DE PROPÓSITO: o node remoto faz o PRÓPRIO face tracking e
        // não recebe estes valores, então rodar a detecção aqui antes do branch
        // remoto era decode + inferência jogados fora em todo corte smart (o
        // caminho de produção, REMOTE_RENDER_ENABLED=true). Agora só roda quando
        // o render local realmente vai usar o resultado.
        let resolvedSmartCrop: SmoothedCrop | null = null;
        let resolvedDualCrop: [SmoothedCrop, SmoothedCrop] | undefined;
        let faceTrackingResolved = false;

        const resolveFaceTracking = async () => {
            if (faceTrackingResolved) return;
            faceTrackingResolved = true;
            if (!SMART_LAYOUTS.includes(options.renderLayout) && !DUAL_FACE_LAYOUTS.includes(options.renderLayout)) {
                return;
            }
            const clipDir = this.smartCrop.clipDir(inputPath, clip.id);
            const cachedFaces = await this.smartCrop.loadCache(clipDir);
            let faces: import('./smart-crop.service.js').FaceTrackPoint[];
            if (!cachedFaces) {
                this.logger.debug(`Running face detection for clip ${clip.id} (${options.renderLayout})`);
                faces = await this.faceDetection.trackFaces(inputPath, clip.start, clip.duration, 2);
                if (faces.length > 0) {
                    await this.smartCrop.saveCache(clipDir, faces);
                }
            } else {
                this.logger.debug(`Using cached face track for clip ${clip.id} (${cachedFaces.length} points)`);
                faces = cachedFaces;
            }

            if (DUAL_FACE_LAYOUTS.includes(options.renderLayout)) {
                const clusters = this.smartCrop.clusterFaces(faces, 2);
                if (clusters.length === 2) {
                    resolvedDualCrop = [clusters[0], clusters[1]];
                    this.logger.debug({ msg: `Dual face crop resolved for ${options.renderLayout}`, left: clusters[0].cx, right: clusters[1].cx });
                } else {
                    this.logger.warn({ msg: `Could not detect 2 faces for dual layout, using static fallback`, clipId: clip.id, layout: options.renderLayout });
                }
            } else {
                resolvedSmartCrop = this.smartCrop.smooth(faces);
                if (!resolvedSmartCrop) {
                    this.logger.warn({ msg: `No faces detected for smart layout, using fallback crop`, clipId: clip.id, layout: options.renderLayout });
                }
            }
        };

        if (
            !shouldUseRemotion &&
            !options.disableRemote &&
            this.remote.isEnabled()
        ) {
            try {
                const remoteMediaId =
                    options.remoteMediaId ??
                    (ownedRemoteMediaId =
                        await this.remote.uploadMedia(inputPath));
                if (remoteMediaId) {
                    const remoteResult = await this.remote.renderClip(
                        remoteMediaId,
                        assPath,
                        videoPath,
                        clip.start,
                        renderEnd,
                        options.renderLayout,
                    );
                    await this.remote.thumbnail(
                        remoteMediaId,
                        thumbnailPath,
                        clip.start,
                    );
                    renderEngine = remoteResult.renderEngine;
                    return {
                        videoPath,
                        thumbnailPath,
                        srtPath,
                        vttPath,
                        renderEngine,
                        renderDurationMs: Date.now() - startedAt,
                        smartCrop: resolvedSmartCrop,
                    };
                }
            } catch (error) {
                this.logger.warn({
                    msg: `Remote render failed for clip ${clip.id}, falling back to local FFmpeg`,
                    clipId: clip.id,
                    error: error instanceof Error ? error.message : error,
                });
            } finally {
                if (ownedRemoteMediaId) {
                    await this.remote.deleteMedia(ownedRemoteMediaId);
                }
            }
        }

        // Daqui pra baixo o render é local (Remotion ou ffmpeg) e consome o
        // face tracking de verdade — agora sim vale pagar a detecção.
        await resolveFaceTracking();

        const clipForRender = { ...clip, end: renderEnd };

        // Plano de B-roll (EXPERIMENTAL, ffmpeg only). Retorna [] quando
        // BROLL_ENABLED != true — nesse caso o render fica idêntico ao atual.
        const brollSegments = this.brollPlan.isEnabled()
            ? await this.brollPlan
                  .buildPlan({
                      transcriptText: segments
                          .filter((s) => s.end > clip.start && s.start < renderEnd)
                          .map((s) => s.text)
                          .join(" "),
                      clipStartSec: clip.start,
                      clipEndSec: renderEnd,
                      baseDir,
                  })
                  .catch(() => [])
            : [];

        if (shouldUseRemotion) {
            try {
                await this.remotion.renderClip(
                    inputPath,
                    videoPath,
                    clipForRender,
                    segments,
                    options.words,
                    { ...options, smartCrop: resolvedSmartCrop, autoOverlays: options.autoOverlays },
                );
                renderEngine = "remotion";
            } catch (error) {
                this.logger.warn({
                    msg: `Remotion failed for clip ${clip.id}, falling back to FFmpeg`,
                    clipId: clip.id,
                    error: error instanceof Error ? error.message : error,
                });
                await this.ffmpeg.renderClip(
                    inputPath,
                    videoPath,
                    assPath,
                    clip.start,
                    renderEnd,
                    options.renderLayout,
                    resolvedSmartCrop,
                    options.watermarkText,
                    resolvedDualCrop,
                    brollSegments,
                );
            }
        } else {
            await this.ffmpeg.renderClip(
                inputPath,
                videoPath,
                assPath,
                clip.start,
                renderEnd,
                options.renderLayout,
                resolvedSmartCrop,
                options.watermarkText,
                resolvedDualCrop,
                brollSegments,
            );
        }

        await this.ffmpeg
            .thumbnail(inputPath, thumbnailPath, clip.start)
            .catch((error) => {
                this.logger.warn({
                    msg: "Thumbnail generation failed, continuing without it",
                    clipId: clip.id,
                    error: error instanceof Error ? error.message : error,
                });
            });

        return {
            videoPath,
            thumbnailPath,
            srtPath,
            vttPath,
            renderEngine,
            renderDurationMs: Date.now() - startedAt,
            smartCrop: resolvedSmartCrop,
        };
    }
}
