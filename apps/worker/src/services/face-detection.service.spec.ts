import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promisify } from 'node:util';

// child_process.execFile tem um util.promisify.custom próprio que resolve
// {stdout, stderr} — um mock comum (sem esse símbolo) faz o promisify() cair
// no comportamento genérico, que resolve só o 2º argumento do callback como
// valor único. Sem replicar o símbolo aqui, `const { stdout } = await
// execFileAsync(...)` no serviço real recebe stdout=undefined mesmo com o
// mock "funcionando" — foi exatamente isso que quebrou na primeira versão
// deste teste (TypeError: Cannot read properties of undefined).
const mockExecFile = vi.fn();
function execFileMock(...args: unknown[]) {
  return mockExecFile(...args);
}
(execFileMock as unknown as Record<symbol, unknown>)[promisify.custom] = (
  file: string,
  fileArgs: string[],
  options?: Record<string, unknown>,
) =>
  new Promise((resolve, reject) => {
    mockExecFile(file, fileArgs, options ?? {}, (err: Error | null, stdout: string, stderr: string) =>
      err ? reject(err) : resolve({ stdout, stderr }),
    );
  });
vi.mock('node:child_process', () => ({ execFile: execFileMock }));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-mp4-bytes')),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

const fetchMock = vi.fn();

function okFfmpeg() {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, '', ''));
}

function okLocalEngine(points: unknown[]) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
    cb(null, JSON.stringify(points), ''),
  );
}

async function newService() {
  vi.resetModules();
  const { FaceDetectionService } = await import('./face-detection.service.js');
  return new FaceDetectionService();
}

describe('FaceDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('FormData', class {
      append = vi.fn();
    } as never);
    delete process.env.REMOTE_ACCEL_ENABLED;
    delete process.env.REMOTE_ACCEL_BASE_URL;
    delete process.env.REMOTE_ACCEL_TOKEN;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('REMOTE_ACCEL_ENABLED desligado: vai direto pro binário local, sem tentar rede', async () => {
    okLocalEngine([{ time: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.2, confidence: 0.9 }]);
    const service = await newService();
    const result = await service.trackFaces('/in.mp4', 10, 30, 2);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('GPU remota disponível: extrai o recorte, envia, soma o offset absoluto do corte', async () => {
    process.env.REMOTE_ACCEL_ENABLED = 'true';
    process.env.REMOTE_ACCEL_BASE_URL = 'http://node-agent:9873';
    okFfmpeg();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        points: [{ time: 0.5, x: 0.4, y: 0.3, w: 0.2, h: 0.4, confidence: 0.8 }],
        backend: 'scrfd',
        device: 'cuda',
        sec: 1.2,
      }),
    });

    const service = await newService();
    const result = await service.trackFaces('/in.mp4', 100, 30, 2);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://node-agent:9873/v1/track-faces',
      expect.objectContaining({ method: 'POST' }),
    );
    // time=0.5 no recorte (que começa em t=0) + start=100 do corte no vídeo original.
    expect(result).toEqual([expect.objectContaining({ time: 100.5 })]);
  });

  it('GPU remota falha em runtime: cai pro binário local sem propagar o erro', async () => {
    process.env.REMOTE_ACCEL_ENABLED = 'true';
    okFfmpeg();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    // A segunda "onda" de chamadas a execFile (após a extração do recorte,
    // que já usou okFfmpeg) precisa virar o binário local com sucesso.
    let ffmpegCalls = 0;
    mockExecFile.mockImplementation((cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      if (cmd === 'ffmpeg') {
        ffmpegCalls += 1;
        return cb(null, '', '');
      }
      return cb(null, JSON.stringify([{ time: 0, x: 0.5, y: 0.5, w: 0.1, h: 0.1, confidence: 0.7 }]), '');
    });

    const service = await newService();
    const result = await service.trackFaces('/in.mp4', 0, 30, 2);

    expect(ffmpegCalls).toBe(1); // só a extração do recorte, antes de falhar
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(0); // veio do binário local, sem offset somado
  });

  it('binário local também falha: devolve [] em vez de derrubar o render', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
      cb(new Error('engine crashed'), '', ''),
    );
    const service = await newService();
    const result = await service.trackFaces('/in.mp4', 0, 30, 2);
    expect(result).toEqual([]);
  });
});
