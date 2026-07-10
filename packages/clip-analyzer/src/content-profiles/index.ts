import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

const contentTypeProfileMap: Record<string, string> = {
  PODCAST: 'podcast',
  INTERVIEW: 'podcast',
  LIVE: 'podcast',
  CLASS: 'educational',
  TALK: 'educational',
  COMEDY: 'comedy',
  GAMING: 'gaming',
  MYSTERY: 'mystery',
  NEWS: 'news',
};

const clipStyleProfileMap: Record<string, string> = {
  EDUCATIONAL: 'educational',
  CONTROVERSIAL: 'news',
  FUNNY: 'comedy',
};

export function resolveContentProfileName(contentType?: string, clipStyle?: string): string | null {
  const normalizedStyle = clipStyle?.toUpperCase();
  if (normalizedStyle && clipStyleProfileMap[normalizedStyle]) {
    return clipStyleProfileMap[normalizedStyle];
  }

  const normalizedType = contentType?.toUpperCase();
  if (normalizedType && contentTypeProfileMap[normalizedType]) {
    return contentTypeProfileMap[normalizedType];
  }

  return null;
}

export async function loadContentProfile(contentType?: string, clipStyle?: string): Promise<string> {
  const profileName = resolveContentProfileName(contentType, clipStyle);
  if (!profileName) return '';

  try {
    const profilePath = resolve(MODULE_DIR, `${profileName}.txt`);
    return await readFile(profilePath, 'utf8');
  } catch {
    return '';
  }
}
