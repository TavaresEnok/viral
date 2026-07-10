import { describe, it, expect } from 'vitest';

describe('validateJobPayload', () => {
  it('accepts valid PROCESS_PROJECT payload', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({ projectId: 'p1', userId: 'u1' });
    expect(result.valid).toBe(true);
  });

  it('accepts PROCESS_PROJECT with optional fields', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({
      projectId: 'p1',
      userId: 'u1',
      originalFilePath: '/path/to/video.mp4',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid RENDER_CLIP payload', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({
      jobType: 'RENDER_CLIP',
      projectId: 'p1',
      userId: 'u1',
      clipId: 'c1',
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toHaveProperty('clipId');
    }
  });

  it('rejects RENDER_CLIP without clipId', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({ jobType: 'RENDER_CLIP', projectId: 'p1', userId: 'u1' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('clipId');
    }
  });

  it('rejects null payload', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload(null);
    expect(result.valid).toBe(false);
  });

  it('rejects payload without projectId', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({ userId: 'u1' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('projectId');
    }
  });

  it('rejects payload without userId', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({ projectId: 'p1' });
    expect(result.valid).toBe(false);
  });

  it('rejects unknown jobType', async () => {
    const { validateJobPayload } = await import('./index.js');
    const result = validateJobPayload({ jobType: 'INVALID', projectId: 'p1', userId: 'u1' });
    expect(result.valid).toBe(false);
  });

  it('rejects non-object payload', async () => {
    const { validateJobPayload } = await import('./index.js');
    expect(validateJobPayload('string').valid).toBe(false);
    expect(validateJobPayload(123).valid).toBe(false);
  });
});
