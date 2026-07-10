import { Logger } from '@nestjs/common';
import { unlink, rm, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { assertPathInsideStorage } from './safe-path.helper.js';

const TEMP_TTL_MS = 24 * 60 * 60 * 1000;

export function collectClipPaths(clip: {
  videoPath: string | null;
  thumbnailPath: string | null;
  srtPath: string | null;
  vttPath: string | null;
}): string[] {
  return [clip.videoPath, clip.thumbnailPath, clip.srtPath, clip.vttPath]
    .filter((p): p is string => p !== null);
}

export function collectProjectPaths(project: {
  originalFilePath: string | null;
  audioFilePath: string | null;
}): string[] {
  return [project.originalFilePath, project.audioFilePath]
    .filter((p): p is string => p !== null);
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    const safe = assertPathInsideStorage(filePath);
    await unlink(safe);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw err;
  }
}

export async function safeRmdir(dirPath: string): Promise<void> {
  try {
    const safe = assertPathInsideStorage(dirPath);
    await rm(safe, { recursive: true, force: true });
  } catch (err: unknown) {
    const logger = new Logger('StorageCleanup');
    logger.warn(`Could not remove directory ${dirPath}: ${err instanceof Error ? err.message : err}`);
  }
}

export async function deleteClipFiles(clip: {
  id: string;
  videoPath: string | null;
  thumbnailPath: string | null;
  srtPath: string | null;
  vttPath: string | null;
}): Promise<void> {
  const paths = collectClipPaths(clip);
  await Promise.all(paths.map((p) => safeUnlink(p)));

  const clipDir = clip.videoPath
    ? dirname(assertPathInsideStorage(clip.videoPath))
    : null;
  if (clipDir) {
    await safeRmdir(clipDir);
  }
}

export async function deleteProjectFiles(project: {
  originalFilePath: string | null;
  audioFilePath: string | null;
}): Promise<void> {
  const paths = collectProjectPaths(project);
  await Promise.all(paths.map((p) => safeUnlink(p)));

  const projectDir = project.originalFilePath
    ? dirname(assertPathInsideStorage(project.originalFilePath))
    : null;
  if (projectDir) {
    await safeRmdir(projectDir);
  }
}

export async function cleanTempStorage(tempDir: string): Promise<number> {
  const logger = new Logger('TempCleanup');
  let deleted = 0;
  let files: string[];
  try {
    files = await readdir(tempDir);
  } catch {
    return 0;
  }

  const now = Date.now();
  await Promise.all(
    files.map(async (file) => {
      const filePath = resolve(tempDir, file);
      try {
        const safe = assertPathInsideStorage(filePath);
        const { stat } = await import('node:fs/promises');
        const stats = await stat(safe);
        if (now - stats.mtimeMs > TEMP_TTL_MS) {
          await unlink(safe);
          deleted += 1;
        }
      } catch {
        // skip files that can't be stat'd or removed
        logger.warn(`Could not clean temp file: ${filePath}`);
      }
    }),
  );
  return deleted;
}
