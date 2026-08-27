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
