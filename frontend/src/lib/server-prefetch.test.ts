import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

import { prefetchInitialData } from './server-prefetch';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('prefetchInitialData resolution state', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    cookieGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks successful anonymous auth and empty feature flags as resolved', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ providers: [], local_no_login_enabled: false }))
      .mockResolvedValueOnce(jsonResponse({ flags: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await prefetchInitialData();

    expect(result).toMatchObject({
      user: null,
      userResolved: true,
      featureFlags: {},
      featureFlagsResolved: true,
      localMode: false,
      localModeResolved: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps deployment, user, and flags unresolved when SSR requests fail', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockRejectedValueOnce(new Error('backend unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await prefetchInitialData();

    expect(result.userResolved).toBe(false);
    expect(result.featureFlagsResolved).toBe(false);
    expect(result.localModeResolved).toBe(false);
  });

  it('prefetches the real workspace user without a cookie in local mode', async () => {
    const user = { id: 7, email: 'admin@topiceye.local', role: 'admin' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ providers: [], local_no_login_enabled: true }))
      .mockResolvedValueOnce(jsonResponse(user))
      .mockResolvedValueOnce(jsonResponse({ flags: {} }))
      .mockResolvedValueOnce(jsonResponse({ today_content: 2, today_picks: 1 }))
      .mockResolvedValueOnce(jsonResponse({ total: 3, items: [] }))
      .mockResolvedValueOnce(jsonResponse({ total: 4, items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await prefetchInitialData();

    expect(result.localMode).toBe(true);
    expect(result.user).toEqual(user);
    expect(result.userResolved).toBe(true);
    expect(result.counts).toEqual({ todayPicks: 1, sourceCount: 3, favoriteTotal: 4 });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ headers: { 'Content-Type': 'application/json' } });
  });
});
