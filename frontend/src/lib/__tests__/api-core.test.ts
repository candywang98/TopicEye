import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAbortError, request } from '@/lib/api/_core';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API request cancellation', () => {
  it('preserves AbortError so route-unmount cancellation can be ignored', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(request('/test')).rejects.toBe(abortError);
    expect(isAbortError(abortError)).toBe(true);
  });

  it('still marks ordinary fetch failures as network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection reset')));

    await expect(request('/test')).rejects.toMatchObject({
      message: 'connection reset',
      isNetworkError: true,
    });
  });
});
