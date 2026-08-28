import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// execFile é promisificado no módulo, então o mock precisa respeitar o
// contrato de callback do Node (err, stdout, stderr).
const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

function okEncode() {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
    cb(null, '', ''),
  );
}

function failEncode(message = 'Cannot load libnvidia-encode.so.1') {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
    cb(new Error(message), '', message),
  );
}

async function newService() {
  vi.resetModules();
  const { GpuCapabilityService } = await import('./gpu-capability.service.js');
  return new GpuCapabilityService();
}

describe('GpuCapabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VIDEO_ENCODER;
  });

  afterEach(() => {
    delete process.env.VIDEO_ENCODER;
    delete process.env.NVENC_CQ;
  });

  describe('detecção', () => {
    it('detecta GPU quando o encode de teste funciona', async () => {
      okEncode();
      const service = await newService();
      await expect(service.isNvencAvailable()).resolves.toBe(true);
    });

    it('cai para CPU quando o encode de teste falha (placa ausente/driver quebrado)', async () => {
      failEncode();
      const service = await newService();
      await expect(service.isNvencAvailable()).resolves.toBe(false);
    });

    it('não confia só no binário: executa um encode real de verificação', async () => {
      okEncode();
      const service = await newService();
      await service.isNvencAvailable();

      const [cmd, args] = mockExecFile.mock.calls[0];
      expect(cmd).toBe('ffmpeg');
      expect(args).toContain('h264_nvenc');
      // Descarta a saída: a sonda não pode escrever arquivo nenhum.
      expect(args).toContain('-f');
      expect(args).toContain('null');
    });

    it('cacheia o resultado (não sonda a GPU a cada corte)', async () => {
      okEncode();
      const service = await newService();
      await service.isNvencAvailable();
      await service.isNvencAvailable();
      await service.isNvencAvailable();
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('VIDEO_ENCODER=cpu força CPU sem nem sondar a GPU', async () => {
      process.env.VIDEO_ENCODER = 'cpu';
      okEncode();
      const service = await newService();
      await expect(service.isNvencAvailable()).resolves.toBe(false);
      expect(mockExecFile).not.toHaveBeenCalled();
    });
  });

  describe('nova tentativa após falha (regressão: container de 19h com GPU sã, mas sonda cacheou "sem GPU" para sempre)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      delete process.env.GPU_PROBE_RETRY_COOLDOWN_MS;
    });

    it('não sonda de novo antes do cooldown expirar (evita martelar um ffmpeg que já falhou)', async () => {
      process.env.GPU_PROBE_RETRY_COOLDOWN_MS = '60000';
      failEncode();
      const service = await newService();

      await expect(service.isNvencAvailable()).resolves.toBe(false);
      vi.advanceTimersByTime(30_000); // metade do cooldown
      await expect(service.isNvencAvailable()).resolves.toBe(false);

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('sonda de novo sozinho depois do cooldown — sem isso, um handle de GPU perdido travava o worker em CPU até restart manual', async () => {
      process.env.GPU_PROBE_RETRY_COOLDOWN_MS = '60000';
      failEncode();
      const service = await newService();
      await expect(service.isNvencAvailable()).resolves.toBe(false);

      vi.advanceTimersByTime(60_001);
      okEncode(); // a GPU "voltou a responder" (o caso real de produção)

      await expect(service.isNvencAvailable()).resolves.toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('sucesso não expira nunca, mesmo bem depois do cooldown de falha', async () => {
      process.env.GPU_PROBE_RETRY_COOLDOWN_MS = '1000';
      okEncode();
      const service = await newService();
      await expect(service.isNvencAvailable()).resolves.toBe(true);

      vi.advanceTimersByTime(10 * 60_000);
      await expect(service.isNvencAvailable()).resolves.toBe(true);

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('chamadas concorrentes durante uma sonda em andamento não disparam ffmpeg duas vezes', async () => {
      let resolveExec!: () => void;
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        resolveExec = () => cb(null, '', '');
      });
      const service = await newService();

      const first = service.isNvencAvailable();
      const second = service.isNvencAvailable();
      resolveExec();

      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(true);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('argumentos de codec', () => {
    it('usa NVENC com qualidade constante quando há GPU', async () => {
      const service = await newService();
      const args = service.videoCodecArgs(true, 'veryfast', 2);

      expect(args).toEqual(expect.arrayContaining(['-c:v', 'h264_nvenc', '-cq', '23']));
      // NVENC não entende -crf nem os presets do x264.
      expect(args).not.toContain('-crf');
      expect(args).not.toContain('veryfast');
    });

    it('usa libx264 com CRF e threads quando não há GPU', async () => {
      const service = await newService();
      const args = service.videoCodecArgs(false, 'veryfast', 3);

      expect(args).toEqual(
        expect.arrayContaining(['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-threads', '3']),
      );
      expect(args).not.toContain('h264_nvenc');
    });

    it('permite ajustar a qualidade do NVENC por env', async () => {
      process.env.NVENC_CQ = '19';
      const service = await newService();
      const args = service.videoCodecArgs(true, 'veryfast', 2);
      expect(args).toEqual(expect.arrayContaining(['-cq', '19']));
    });
  });
});
