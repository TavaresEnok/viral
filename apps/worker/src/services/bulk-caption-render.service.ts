import { Injectable, Logger } from "@nestjs/common";
import type { Clip } from "@prisma/client";
import type { TranscriptSegment } from "@viralforge/clip-analyzer";
import { PrismaService } from "./prisma.service.js";
import { RenderingService } from "./rendering.service.js";

/**
 * Renderiza um item do editor em massa: um vídeo cru + legenda DIGITADA
 * manualmente (não vem de transcrição/IA). Não pertence a nenhum Project.
 *
 * Reaproveita RenderingService.renderClip (o mesmo motor de RENDER_CLIP), que
 * só lê id/start/end/duration do parâmetro `clip` — por isso um objeto
 * sintético (não um Clip real do banco) é suficiente. A legenda estática vira
 * um único segmento cobrindo o vídeo inteiro, sem timing por palavra.
 */
@Injectable()
export class BulkCaptionRenderService {
    private readonly logger = new Logger(BulkCaptionRenderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly rendering: RenderingService,
    ) {}

    async renderItem(itemId: string, jobId: string) {
        const log = (msg: string, extra?: Record<string, unknown>) =>
            this.logger.log({ msg, jobId, itemId, ...extra });

        const item = await this.prisma.quickCaptionItem.findUnique({
            where: { id: itemId },
            include: { batch: true },
        });
        if (!item) {
            log("Item não existe mais; job descartado sem retry");
            return;
        }
        if (!item.originalFilePath) {
            throw new Error("Item sem vídeo enviado");
        }
        if (!item.captionText.trim()) {
            throw new Error("Item sem legenda digitada");
        }
        if (!item.durationSeconds || item.durationSeconds <= 0) {
            throw new Error("Duração do vídeo desconhecida");
        }

        await this.prisma.quickCaptionItem.update({
            where: { id: itemId },
            data: { status: "RENDERING", errorMessage: null },
        });

        try {
            log("Renderizando item do editor em massa", {
                layout: item.batch.renderLayout,
                theme: item.batch.captionTheme,
            });

            // Estrutural: só id/start/end/duration são lidos por renderClip.
            const syntheticClip = {
                id: item.id,
                start: 0,
                end: item.durationSeconds,
                duration: item.durationSeconds,
            } as unknown as Clip;

            const segments: TranscriptSegment[] = [
                { start: 0, end: item.durationSeconds, text: item.captionText },
            ];

            const result = await this.rendering.renderClip(item.originalFilePath, syntheticClip, segments, {
                captionTheme: item.batch.captionTheme,
                renderLayout: item.batch.renderLayout,
            });

            await this.prisma.quickCaptionItem.update({
                where: { id: itemId },
                data: {
                    status: "COMPLETED",
                    videoPath: result.videoPath,
                    thumbnailPath: result.thumbnailPath,
                    errorMessage: null,
                },
            });
            log("Item renderizado com sucesso");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro desconhecido no render";
            await this.prisma.quickCaptionItem.update({
                where: { id: itemId },
                data: { status: "FAILED", errorMessage: message },
            });
            log(`Falha ao renderizar item: ${message}`, { stage: "FAILED" });
            throw error;
        }
    }
}
