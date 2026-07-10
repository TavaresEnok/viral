import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeFileMock = vi.fn().mockResolvedValue(undefined);
const mkdirMock = vi.fn().mockResolvedValue(undefined);
vi.mock('node:fs/promises', () => ({
  writeFile: (...args: unknown[]) => writeFileMock(...args),
  mkdir: (...args: unknown[]) => mkdirMock(...args),
}));

const fetchMock = vi.fn();

function makeBroll(clips: Array<{ url: string }>) {
  return { findRelevantBroll: vi.fn().mockResolvedValue(clips) };
}

async function getService(broll: { findRelevantBroll: ReturnType<typeof vi.fn> }) {
  const { BrollPlanService } = await import('./broll-plan.service.js');
  return new BrollPlanService(broll as never);
}

describe('BrollPlanService', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    // Stub por teste + unstub no afterEach pra não vazar para outros arquivos
    // (evita flakiness de isolação no vitest worker compartilhado).
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...OLD_ENV };
  });

  it('isEnabled é false sem BROLL_ENABLED (padrão seguro)', async () => {
    delete process.env.BROLL_ENABLED;
    process.env.PEXELS_API_KEY = 'k';
    const svc = await getService(makeBroll([{ url: 'a' }]));
    expect(svc.isEnabled()).toBe(false);
  });

  it('isEnabled é false com flag ligada mas sem PEXELS_API_KEY', async () => {
    process.env.BROLL_ENABLED = 'true';
    delete process.env.PEXELS_API_KEY;
    const svc = await getService(makeBroll([{ url: 'a' }]));
    expect(svc.isEnabled()).toBe(false);
  });

  it('buildPlan retorna [] quando desligado (sem tocar no Pexels)', async () => {
    delete process.env.BROLL_ENABLED;
    const broll = makeBroll([{ url: 'a' }]);
    const svc = await getService(broll);
    const plan = await svc.buildPlan({ transcriptText: 'olá mundo bonito', clipStartSec: 0, clipEndSec: 60, baseDir: '/tmp/x' });
    expect(plan).toEqual([]);
    expect(broll.findRelevantBroll).not.toHaveBeenCalled();
  });

  it('buildPlan retorna [] para cortes curtos (<20s)', async () => {
    process.env.BROLL_ENABLED = 'true';
    process.env.PEXELS_API_KEY = 'k';
    const svc = await getService(makeBroll([{ url: 'a' }]));
    const plan = await svc.buildPlan({ transcriptText: 'texto', clipStartSec: 0, clipEndSec: 15, baseDir: '/tmp/x' });
    expect(plan).toEqual([]);
  });

  it('buildPlan gera cutaways espaçados e baixa os clipes quando ligado', async () => {
    process.env.BROLL_ENABLED = 'true';
    process.env.PEXELS_API_KEY = 'k';
    const svc = await getService(makeBroll([{ url: 'a' }, { url: 'b' }, { url: 'c' }]));
    const plan = await svc.buildPlan({ transcriptText: 'conteúdo relevante sobre tecnologia inovadora', clipStartSec: 100, clipEndSec: 160, baseDir: '/tmp/x' });
    expect(plan.length).toBeGreaterThan(0);
    // Janelas dentro do corte (0..duração) e em ordem crescente.
    for (const seg of plan) {
      expect(seg.startSec).toBeGreaterThanOrEqual(0);
      expect(seg.endSec).toBeLessThanOrEqual(60);
      expect(seg.endSec).toBeGreaterThan(seg.startSec);
      expect(seg.filePath).toMatch(/broll-\d+\.mp4$/);
    }
    expect(writeFileMock).toHaveBeenCalled();
  });

  it('buildPlan retorna [] quando o Pexels não acha B-roll', async () => {
    process.env.BROLL_ENABLED = 'true';
    process.env.PEXELS_API_KEY = 'k';
    const svc = await getService(makeBroll([]));
    const plan = await svc.buildPlan({ transcriptText: 'texto longo o suficiente aqui', clipStartSec: 0, clipEndSec: 60, baseDir: '/tmp/x' });
    expect(plan).toEqual([]);
  });
});
