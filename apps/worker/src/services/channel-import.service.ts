import { Injectable, Logger } from "@nestjs/common";
import type { Prisma, SocialChannelPlatform } from "@viralforge/database";
import { youtubeDl } from "youtube-dl-exec";
import { PrismaService } from "./prisma.service.js";
import { assertPublicHttpUrl } from "./url-safety.helper.js";

export interface ChannelVideo {
    url: string;
    title: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
}

const PLATFORM_HOSTS: Record<SocialChannelPlatform, string[]> = {
    TIKTOK: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
    INSTAGRAM: ["instagram.com", "www.instagram.com"],
    KWAI: ["kwai.com", "www.kwai.com", "m.kwai.com", "kwai.com.br", "www.kwai.com.br"],
};

function positiveEnvInt(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Vídeos por página de listagem — evita que um canal com milhares de vídeos
 * estoure disco/tempo numa única chamada. O usuário vê esta página e pode
 * pedir "ver mais" para buscar a próxima (listAndSave usa o total já salvo
 * como offset via playlistStart do yt-dlp).
 */
function channelVideosPageSize(): number {
    return positiveEnvInt("CHANNEL_IMPORT_PAGE_SIZE", 50);
}

function channelListTimeoutMs(): number {
    return positiveEnvInt("CHANNEL_IMPORT_LIST_TIMEOUT_MS", 2 * 60 * 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * TikTok (e outros extractors) não preenchem o campo singular `thumbnail` no
 * modo flat-playlist — a miniatura real vem em `thumbnails: [{id, url}]`.
 * Prefere o item com id "cover" (capa gerada pela plataforma); sem isso, usa
 * o primeiro item da lista.
 */
function readThumbnailUrl(entry: Record<string, unknown>): string | undefined {
    const direct = readString(entry, "thumbnail");
    if (direct) return direct;

    const list = entry.thumbnails;
    if (!Array.isArray(list)) return undefined;
    const records = list.filter(isRecord);
    const cover = records.find((item) => readString(item, "id") === "cover");
    return readString(cover ?? records[0] ?? {}, "url");
}

/**
 * Erros de subprocesso (tinyspawn, usado por youtube-dl-exec) costumam vir com
 * `.message` vazio e o diagnóstico real em `.stderr`/`.code` — sem isso o
 * usuário via só "Falha ao listar canal: " sem nenhuma pista do que deu errado.
 */
function describeError(error: unknown): string {
    if (!isRecord(error)) return "Erro desconhecido ao listar canal";
    const message = readString(error, "message");
    if (message) return message;
    const stderr = readString(error, "stderr");
    if (stderr) return stderr.split("\n").filter(Boolean).slice(-1)[0] ?? stderr;
    const code = error.code;
    if (typeof code === "string") return `Falha ao executar o extrator (código ${code})`;
    return "Erro desconhecido ao listar canal";
}

@Injectable()
export class ChannelImportService {
    private readonly logger = new Logger(ChannelImportService.name);

    constructor(private readonly prisma: PrismaService) {}

    async listAndSave(requestId: string, jobId: string) {
        const log = (msg: string, extra?: Record<string, unknown>) =>
            this.logger.log({ msg, jobId, requestId, ...extra });

        const request = await this.prisma.channelImportRequest.findUnique({ where: { id: requestId } });
        if (!request) {
            log("Solicitação de importação não existe mais; job descartado sem retry");
            return;
        }

        // "Ver mais" reusa o mesmo request: o que já está salvo vira o offset
        // (playlistStart) da próxima página, e os resultados são acumulados.
        const existing = (request.videosJson as unknown as ChannelVideo[] | null) ?? [];

        await this.prisma.channelImportRequest.update({
            where: { id: requestId },
            data: { status: "LISTING", errorMessage: null },
        });

        try {
            log("Listando vídeos do canal", {
                platform: request.platform,
                channelUrl: request.channelUrl,
                offset: existing.length,
            });
            const page = await this.listChannel(request.platform, request.channelUrl, existing.length);

            if (!existing.length && !page.length) {
                throw new Error("Nenhum vídeo público encontrado nesse canal/perfil.");
            }

            const seen = new Set(existing.map((v) => v.url));
            const merged = [...existing, ...page.filter((v) => !seen.has(v.url))];
            // Página cheia => provavelmente há mais. Página incompleta ou vazia
            // (fim do canal, ou tudo já era duplicata) => não há mais.
            const hasMore = page.length >= channelVideosPageSize();

            await this.prisma.channelImportRequest.update({
                where: { id: requestId },
                data: {
                    status: "READY",
                    videosJson: merged as unknown as Prisma.InputJsonValue,
                    hasMore,
                    errorMessage: null,
                },
            });
            log(`Listagem concluída: +${page.length} vídeo(s) (total ${merged.length}), hasMore=${hasMore}`);
        } catch (error) {
            const message = describeError(error);
            await this.prisma.channelImportRequest.update({
                where: { id: requestId },
                data: { status: "FAILED", errorMessage: message },
            });
            log(`Falha ao listar canal: ${message}`, { stage: "FAILED" });
            throw error;
        }
    }

    private async listChannel(
        platform: SocialChannelPlatform,
        channelUrl: string,
        offset: number,
    ): Promise<ChannelVideo[]> {
        await assertPublicHttpUrl(channelUrl, PLATFORM_HOSTS[platform]);

        const pageSize = channelVideosPageSize();
        // playlistStart é 1-indexado no yt-dlp; offset=0 (primeira página) -> 1.
        const playlistStart = offset + 1;
        const playlistEnd = offset + pageSize;
        // flatPlaylist evita baixar metadata completa de cada vídeo (rápido);
        // dumpSingleJson faz o yt-dlp emitir um único JSON no stdout, que a lib
        // parseia automaticamente quando reconhece essas flags.
        const raw = await youtubeDl(
            channelUrl,
            {
                dumpSingleJson: true,
                flatPlaylist: true,
                noWarnings: true,
                playlistStart,
                playlistEnd,
            } as Parameters<typeof youtubeDl>[1],
            { timeout: channelListTimeoutMs() },
        );

        const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!isRecord(parsed)) {
            throw new Error("Resposta inesperada do extrator ao listar o canal");
        }

        // Perfil/canal -> { entries: [...] }. Single video URL (uso indevido do
        // formulário) -> objeto único, tratado como lista de 1 item.
        const rawEntries: unknown = Array.isArray(parsed.entries) ? parsed.entries : [parsed];

        const videos: ChannelVideo[] = [];
        for (const entry of rawEntries as unknown[]) {
            if (!isRecord(entry)) continue;
            const url = readString(entry, "url") ?? readString(entry, "webpage_url");
            if (!url) continue;
            videos.push({
                url,
                title: readString(entry, "title") ?? "Sem título",
                thumbnailUrl: readThumbnailUrl(entry),
                durationSeconds: readNumber(entry, "duration"),
            });
            if (videos.length >= pageSize) break;
        }

        return videos;
    }
}
