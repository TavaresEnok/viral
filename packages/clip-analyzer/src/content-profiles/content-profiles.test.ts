import { describe, expect, it } from 'vitest';

import { loadContentProfile, resolveContentProfileName } from './index.js';

describe('content profiles', () => {
  it('maps the current project content types', () => {
    expect(resolveContentProfileName('PODCAST')).toBe('podcast');
    expect(resolveContentProfileName('INTERVIEW')).toBe('podcast');
    expect(resolveContentProfileName('LIVE')).toBe('podcast');
    expect(resolveContentProfileName('CLASS')).toBe('educational');
    expect(resolveContentProfileName('TALK')).toBe('educational');
    expect(resolveContentProfileName('COMEDY')).toBe('comedy');
    expect(resolveContentProfileName('GAMING')).toBe('gaming');
    expect(resolveContentProfileName('MYSTERY')).toBe('mystery');
    expect(resolveContentProfileName('NEWS')).toBe('news');
    expect(resolveContentProfileName('OTHER')).toBeNull();
  });

  it('lets clip style override the generic content type', () => {
    expect(resolveContentProfileName('PODCAST', 'FUNNY')).toBe('comedy');
    expect(resolveContentProfileName('PODCAST', 'CONTROVERSIAL')).toBe('news');
    expect(resolveContentProfileName('OTHER', 'EDUCATIONAL')).toBe('educational');
  });

  it('loads the mapped profile text', async () => {
    await expect(loadContentProfile('OTHER')).resolves.toBe('');
    await expect(loadContentProfile('PODCAST', 'FUNNY')).resolves.toContain('PERFIL: COMÉDIA');
  });
});
