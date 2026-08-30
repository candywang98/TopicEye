import { describe, expect, it } from 'vitest';
import { createAuthStore } from './authStore';

function createInitialState(overrides: Partial<Parameters<typeof createAuthStore>[0]> = {}) {
  return {
    user: null,
    userResolved: true,
    featureFlags: {},
    featureFlagsResolved: true,
    localMode: false,
    localModeResolved: true,
    ...overrides,
  };
}

describe('createAuthStore prefetch resolution', () => {
  it('treats resolved anonymous user and successful empty flags as complete', () => {
    const state = createAuthStore(createInitialState()).getState();

    expect(state.authLoading).toBe(false);
    expect(state.featuresLoading).toBe(false);
    expect(state.enabledFeatures).toEqual({});
    expect(state.localModeLoading).toBe(false);
  });

  it('keeps failed or unresolved prefetches loading for client retry', () => {
    const state = createAuthStore(createInitialState({
      userResolved: false,
      featureFlagsResolved: false,
      localModeResolved: false,
    })).getState();

    expect(state.authLoading).toBe(true);
    expect(state.featuresLoading).toBe(true);
    expect(state.localModeLoading).toBe(true);
  });

  it('preserves the resolved local workspace mode', () => {
    const state = createAuthStore(createInitialState({ localMode: true })).getState();

    expect(state.localMode).toBe(true);
    expect(state.localModeLoading).toBe(false);
  });
});
