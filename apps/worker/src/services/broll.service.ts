import { Injectable, Logger } from '@nestjs/common';

export interface BrollClip {
  url: string;
  width: number;
  height: number;
  duration: number;
}

@Injectable()
export class BrollService {
  private readonly logger = new Logger(BrollService.name);
  private readonly baseUrl = 'https://api.pexels.com/videos/search';

  async search(query: string, count = 3): Promise<BrollClip[]> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      this.logger.warn('PEXELS_API_KEY não configurada; B-roll desabilitado');
      return [];
    }

    try {
      const url = `${this.baseUrl}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`;
      const response = await fetch(url, {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn({ msg: 'Falha ao buscar B-roll no Pexels', status: response.status });
        return [];
      }

      const data: { videos?: Array<{ video_files: Array<{ link: string; width: number; height: number }>; duration: number }> } = await response.json();

      return (data.videos ?? []).slice(0, count).flatMap((video) => {
        const file = video.video_files?.find((f) => f.width <= 1920) ?? video.video_files?.[0];
        if (!file?.link) return [];
        return {
          url: file.link,
          width: file.width,
          height: file.height,
          duration: video.duration,
        };
      });
    } catch (error) {
      this.logger.warn({ msg: 'Erro ao buscar B-roll', error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  async findRelevantBroll(transcriptText: string): Promise<BrollClip[]> {
    const words = transcriptText
      .toLowerCase()
      .replace(/[^a-záéíóúãõâêîôûàèìòùç\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .filter((w) => !['este', 'esta', 'isto', 'isso', 'aquele', 'aquela', 'como', 'mais', 'mas', 'para', 'porque', 'tambem', 'sobre', 'entre', 'depois', 'antes', 'sempre', 'nunca', 'muito', 'pouco', 'grande', 'pequeno'].includes(w));

    const unique = [...new Set(words)].slice(0, 5);
    if (unique.length === 0) return [];

    for (const keyword of unique) {
      const clips = await this.search(keyword, 2);
      if (clips.length > 0) return clips;
    }

    return [];
  }
}
