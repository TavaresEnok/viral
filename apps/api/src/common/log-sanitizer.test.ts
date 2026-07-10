import { describe, it, expect } from 'vitest';

describe('sanitizeLogValue', () => {
  it('masks long sensitive strings in text', async () => {
    const { sanitizeLogValue } = await import('./log-sanitizer.helper.js');
    const result = sanitizeLogValue('api_key=sk-abc123xyz456def789ghi') as string;
    expect(result).not.toContain('sk-abc123xyz456def789ghi');
    expect(result).toContain('****');
  });

  it('leaves short strings unchanged', async () => {
    const { sanitizeLogValue } = await import('./log-sanitizer.helper.js');
    const result = sanitizeLogValue('hello');
    expect(result).toBe('hello');
  });

  it('masks fields named apiKey in objects', async () => {
    const { sanitizeLogValue } = await import('./log-sanitizer.helper.js');
    const result = sanitizeLogValue({ apiKey: 'sk-long-key-here-1234567890', projectId: 'proj-1' }) as Record<string, unknown>;
    expect(result.apiKey).toContain('****');
    expect(result.apiKey).not.toBe('sk-long-key-here-1234567890');
    expect(result.projectId).toBe('proj-1');
  });

  it('masks secret-like fields in objects', async () => {
    const { sanitizeLogValue } = await import('./log-sanitizer.helper.js');
    const result = sanitizeLogValue({ encryptionSecret: 'super-secret-value-here' }) as Record<string, unknown>;
    expect(result.encryptionSecret as string).toContain('****');
  });

  it('handles null and undefined', async () => {
    const { sanitizeLogValue } = await import('./log-sanitizer.helper.js');
    expect(sanitizeLogValue(null)).toBeNull();
    expect(sanitizeLogValue(undefined)).toBeUndefined();
  });

  it('handles arrays recursively', async () => {
    const { sanitizeLogValue } = await import('./log-sanitizer.helper.js');
    const result = sanitizeLogValue([{ token: 'abc12345token67890' }, { normal: 'data' }]) as Array<Record<string, unknown>>;
    expect((result[0].token as string)).toContain('****');
    expect(result[1].normal).toBe('data');
  });
});
