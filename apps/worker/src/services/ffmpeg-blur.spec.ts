import { describe, expect, it } from 'vitest';
import { FfmpegService } from './ffmpeg.service.js';

/**
 * Trava a característica de performance do fundo desfocado.
 *
 * `boxblur` roda praticamente single-thread. Aplicá-lo direto em 1080x1920
 * custava ~31s por corte de 30s — 97% do tempo de render medido, e a real
 * origem do consumo alto de CPU (decode + encode somam ~2s, com o encode já
 * no NVENC). Gerar o borrão em 1/4 da largura e ampliar depois é ~11x mais
 * rápido, com SSIM 0,989 contra o filtro antigo.
 *
 * Se alguém "simplificar" isso de volta para borrar em resolução cheia, a
 * regressão volta em silêncio — só apareceria como CPU alta em produção.
 */
describe('FfmpegService — fundo desfocado em baixa resolução', () => {
  // A GPU não é exercitada aqui: só a montagem do filtergraph.
  const service = new FfmpegService({} as never);

  function layoutFilter(layout: string): string {
    return (
      service as unknown as { videoLayoutFilter: (l: string) => string }
    ).videoLayoutFilter(layout);
  }

  it('BLURRED_BACKGROUND borra em baixa resolução, não em 1080x1920', () => {
    const filter = layoutFilter('BLURRED_BACKGROUND');

    // Reduz antes de borrar...
    expect(filter).toContain('scale=270:480');
    // ...borra com raio proporcional (24/4)...
    expect(filter).toContain('boxblur=6:8');
    // ...e só então volta para a resolução final.
    expect(filter).toContain('scale=1080:1920');
  });

  it('nunca aplica boxblur diretamente em 1080x1920 (a regressão cara)', () => {
    for (const layout of ['BLURRED_BACKGROUND', 'SCREEN_PLUS_FACE', 'PODCAST_SPLIT_STATIC']) {
      const filter = layoutFilter(layout);
      expect(filter).not.toMatch(/crop=1080:1920,boxblur/);
    }
  });

  it('preserva o número de passagens do blur (mantém o mesmo aspecto visual)', () => {
    // Raio cai 4x junto com a resolução, mas as passagens continuam as mesmas.
    expect(layoutFilter('BLURRED_BACKGROUND')).toContain('boxblur=6:8');
    expect(layoutFilter('SCREEN_PLUS_FACE')).toContain('boxblur=3:4');
  });

  it('o fundo desfocado continua terminando em 1080x1920 para casar com o overlay', () => {
    const filter = layoutFilter('BLURRED_BACKGROUND');
    const bgChain = filter.split(';')[0];
    expect(bgChain).toMatch(/scale=1080:1920\[bg\]$/);
  });
});
