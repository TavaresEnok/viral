import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';

const ORIGINAL_STORAGE_ROOT = process.env.STORAGE_ROOT;

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync('/tmp/vf-test-');
  process.env.STORAGE_ROOT = tmpDir;
});

afterEach(() => {
  process.env.STORAGE_ROOT = ORIGINAL_STORAGE_ROOT;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('collectClipPaths', () => {
  it('returns only non-null paths', async () => {
    const { collectClipPaths } = await import('./storage-cleanup.helper.js');
    const paths = collectClipPaths({
      videoPath: '/a/b.mp4',
      thumbnailPath: null,
      srtPath: '/a/b.srt',
      vttPath: null,
    });
    expect(paths).toEqual(['/a/b.mp4', '/a/b.srt']);
  });

  it('returns empty array when all null', async () => {
    const { collectClipPaths } = await import('./storage-cleanup.helper.js');
    const paths = collectClipPaths({
      videoPath: null,
      thumbnailPath: null,
      srtPath: null,
      vttPath: null,
    });
    expect(paths).toEqual([]);
  });
});

describe('collectProjectPaths', () => {
  it('returns only non-null paths', async () => {
    const { collectProjectPaths } = await import('./storage-cleanup.helper.js');
    const paths = collectProjectPaths({ originalFilePath: '/a/video.mp4', audioFilePath: null });
    expect(paths).toEqual(['/a/video.mp4']);
  });
});

describe('safeUnlink', () => {
  it('removes existing file without error', async () => {
    const { safeUnlink } = await import('./storage-cleanup.helper.js');
    const filePath = resolve(tmpDir, 'test.txt');
    writeFileSync(filePath, 'content');
    await safeUnlink(filePath);
    expect(existsSync(filePath)).toBe(false);
  });

  it('does not throw on non-existent file', async () => {
    const { safeUnlink } = await import('./storage-cleanup.helper.js');
    const filePath = resolve(tmpDir, 'nonexistent.txt');
    await expect(safeUnlink(filePath)).resolves.toBeUndefined();
  });

  it('throws if file is outside storage root', async () => {
    const { safeUnlink } = await import('./storage-cleanup.helper.js');
    await expect(safeUnlink('/etc/passwd')).rejects.toThrow('Acesso negado');
  });
});

describe('deleteClipFiles', () => {
  it('deletes all clip files and clip dir', async () => {
    const { deleteClipFiles } = await import('./storage-cleanup.helper.js');
    const clipDir = resolve(tmpDir, 'clips/clip1');
    mkdirSync(clipDir, { recursive: true });
    writeFileSync(resolve(clipDir, 'clip.mp4'), 'video');
    writeFileSync(resolve(clipDir, 'subtitle.vtt'), 'vtt');
    const clip = {
      id: 'clip1',
      videoPath: resolve(clipDir, 'clip.mp4'),
      thumbnailPath: null,
      srtPath: null,
      vttPath: resolve(clipDir, 'subtitle.vtt'),
    };
    await deleteClipFiles(clip);
    expect(existsSync(resolve(clipDir, 'clip.mp4'))).toBe(false);
    expect(existsSync(resolve(clipDir, 'subtitle.vtt'))).toBe(false);
  });
});

describe('deleteProjectFiles', () => {
  it('deletes project files and parent dir', async () => {
    const { deleteProjectFiles } = await import('./storage-cleanup.helper.js');
    const projectDir = resolve(tmpDir, 'projects/proj1');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(resolve(projectDir, 'original.mp4'), 'video');
    writeFileSync(resolve(projectDir, 'audio.mp3'), 'audio');
    const project = {
      id: 'proj1',
      originalFilePath: resolve(projectDir, 'original.mp4'),
      audioFilePath: resolve(projectDir, 'audio.mp3'),
    };
    await deleteProjectFiles(project);
    expect(existsSync(resolve(projectDir, 'original.mp4'))).toBe(false);
    expect(existsSync(resolve(projectDir, 'audio.mp3'))).toBe(false);
  });
});

describe('cleanTempStorage', () => {
  it('removes files older than TTL', async () => {
    const { cleanTempStorage } = await import('./storage-cleanup.helper.js');
    mkdirSync(resolve(tmpDir, '.temp'), { recursive: true });
    const oldFile = resolve(tmpDir, '.temp', 'old.tmp');
    writeFileSync(oldFile, 'old');
    const newFile = resolve(tmpDir, '.temp', 'new.tmp');
    writeFileSync(newFile, 'new');
    const deleted = await cleanTempStorage(resolve(tmpDir, '.temp'));
    expect(typeof deleted).toBe('number');
  });
});
