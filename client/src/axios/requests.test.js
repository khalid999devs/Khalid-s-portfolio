import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('request configuration', () => {
  it('normalizes an explicitly configured API origin', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test///');

    const { reqFileWrapper, serverOrigin } = await import('./requests');

    expect(serverOrigin).toBe('https://api.example.test');
    expect(reqFileWrapper('uploads/image.webp')).toBe(
      'https://api.example.test/uploads/image.webp'
    );
  });

  it('rejects executable and protocol-relative media URLs', async () => {
    const { reqFileWrapper } = await import('./requests');

    expect(reqFileWrapper('javascript:alert(1)')).toBeNull();
    expect(reqFileWrapper('data:text/html,unsafe')).toBeNull();
    expect(reqFileWrapper('//evil.example.test/payload')).toBeNull();
  });

  it('accepts valid absolute HTTP(S) media URLs without rewriting them', async () => {
    const { reqFileWrapper } = await import('./requests');

    expect(reqFileWrapper('https://cdn.example.test/image.webp')).toBe(
      'https://cdn.example.test/image.webp'
    );
    expect(reqFileWrapper('')).toBeNull();
    expect(reqFileWrapper(null)).toBeNull();
  });
});
