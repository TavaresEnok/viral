import { Logger } from '@nestjs/common';
import { extname } from 'node:path';

const logger = new Logger('VideoUploadValidation');

const VIDEO_MAGIC_BYTES: { ext: string; bytes: number[]; offset: number }[] = [
  { ext: '.mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { ext: '.mov', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { ext: '.mkv', bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0 },
  { ext: '.webm', bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0 },
];

/** Confere os bytes mágicos do arquivo contra a extensão declarada — evita spoofing por extensão. */
export async function isValidVideoMagicBytes(filePath: string): Promise<boolean> {
  const { open } = await import('node:fs/promises');
  const fileHandle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    await fileHandle.read(buffer, 0, 16, 0);
    const extension = extname(filePath).toLowerCase();
    const magic = VIDEO_MAGIC_BYTES.find((m) => m.ext === extension);
    if (!magic) return false;
    for (let i = 0; i < magic.bytes.length; i++) {
      if (buffer[magic.offset + i] !== magic.bytes[i]) return false;
    }
    return true;
  } finally {
    await fileHandle.close();
  }
}

/** Confere que o arquivo é um vídeo legível de verdade (não só a extensão/magic bytes corretos). */
export async function isValidVideoWithFfprobe(filePath: string): Promise<boolean> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 10000 },
    );
    return stdout.trim() === 'video';
  } catch (error) {
    logger.warn(`FFprobe rejeitou arquivo: ${filePath}. Erro: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/** Duração do vídeo em segundos, via ffprobe. Lança se não conseguir determinar. */
export async function probeVideoDurationSeconds(filePath: string): Promise<number> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { timeout: 10000 },
  );
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Não foi possível determinar a duração do vídeo');
  }
  return duration;
}
