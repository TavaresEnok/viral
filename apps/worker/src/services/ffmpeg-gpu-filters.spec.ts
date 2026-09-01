import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// execFile é promisificado no módulo, então o mock precisa respeitar o
// contrato de callback do Node (err, stdout, stderr).
const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn().mockResolvedValue(undefined) }));

function ok() {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
    cb(null, '', ''),
  );
}

function fail(message = 'CUDA_ERROR_OUT_OF_MEMORY') {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
    cb(new Error(message), '', message),
  );
}

/** Args do ffmpeg da N-ésima chamada a execFile (1-indexado, como em toHaveBeenNthCalledWith). */
function callArgs(n: number): string[] {
  return mockExecFile.mock.calls[n - 1][1] as string[];
}

async function newService(gpuAvailable: boolean) {
  vi.resetModules();
  const { FfmpegService } = await import('./ffmpeg.service.js');
  const gpu = {
    isNvencAvailable: vi.fn().mockResolvedValue(gpuAvailable),
    videoCodecArgs: vi.fn((useGpu: boolean) =>
      useGpu ? ['-c:v', 'av1_nvenc', '-cq', '31', '-b:v', '0'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'],
    ),
  };
  return new FfmpegService(gpu as never);
}

describe('FfmpegService — filtros em CUDA (pedido explícito: mais GPU mesmo que mais lento)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RENDER_GPU_FILTERS;
  });
  afterEach(() => {
    delete process.env.RENDER_GPU_FILTERS;
  });

  it('BLURRED_BACKGROUND com GPU: decodifica e filtra tudo em CUDA', async () => {
    ok();
    const service = await newService(true);
    await service.renderClip('/in.mp4', '/out.mp4', '/sub.ass', 0, 30, 'BLURRED_BACKGROUND' as never);

    const args = callArgs(1);
    expect(args).toEqual(expect.arrayContaining(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']));
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('scale_cuda=270:480');
    expect(filter).toContain('overlay_cuda');
    // Sem crop nenhum na cadeia — é o motivo de só este layout ir para CUDA.
    expect(filter).not.toContain('crop=');
    // A legenda só existe em CPU: o hwdownload precisa acontecer antes dela.
    expect(filter).toContain('hwdownload,format=nv12[vbase]');
    expect(filter.indexOf('hwdownload')).toBeLessThan(filter.indexOf('subtitles='));
  });

  it('layout com recorte de verdade (SMART_CENTER): filtros ficam na CPU, decode vai pra GPU de graça', async () => {
    ok();
    const service = await newService(true);
    await service.renderClip('/in.mp4', '/out.mp4', '/sub.ass', 0, 30, 'SMART_CENTER' as never);

    const args = callArgs(1);
    // Decode-only: sem hwaccel_output_format, os filtros de CPU (crop) continuam
    // funcionando sem nenhuma mudança.
    expect(args).toEqual(expect.arrayContaining(['-hwaccel', 'cuda']));
    expect(args).not.toContain('-hwaccel_output_format');
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('crop=1080:1920');
    expect(filter).not.toContain('scale_cuda');
  });

  it('sem GPU: nenhum flag de hwaccel, filtro 100% CPU como antes', async () => {
    ok();
    const service = await newService(false);
    await service.renderClip('/in.mp4', '/out.mp4', '/sub.ass', 0, 30, 'BLURRED_BACKGROUND' as never);

    const args = callArgs(1);
    expect(args).not.toContain('-hwaccel');
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('boxblur=6:8');
  });

  it('RENDER_GPU_FILTERS=false desliga os filtros CUDA sem desligar o encode NVENC', async () => {
    process.env.RENDER_GPU_FILTERS = 'false';
    ok();
    const service = await newService(true);
    await service.renderClip('/in.mp4', '/out.mp4', '/sub.ass', 0, 30, 'BLURRED_BACKGROUND' as never);

    const args = callArgs(1);
    expect(args).not.toContain('-hwaccel_output_format');
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'av1_nvenc']));
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('boxblur=6:8');
  });

  it('filtros CUDA falhando em runtime: refaz o mesmo corte inteiramente em CPU', async () => {
    let call = 0;
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      call += 1;
      if (call === 1) return cb(new Error('CUDA_ERROR_OUT_OF_MEMORY'), '', '');
      return cb(null, '', '');
    });
    const service = await newService(true);
    await service.renderClip('/in.mp4', '/out.mp4', '/sub.ass', 0, 30, 'BLURRED_BACKGROUND' as never);

    expect(mockExecFile).toHaveBeenCalledTimes(2);
    const retryArgs = callArgs(2);
    expect(retryArgs).not.toContain('-hwaccel');
    const filter = retryArgs[retryArgs.indexOf('-filter_complex') + 1];
    expect(filter).toContain('boxblur=6:8');
    expect(retryArgs).toEqual(expect.arrayContaining(['-c:v', 'libx264']));
  });
});
