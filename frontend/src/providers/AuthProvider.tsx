'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from 'zustand';
import { getAuthToken, getAuthTokenExpiresAt, setAuthToken, setAuthTokenExpiresAt, authApi, settingsApi } from '@/lib/api';
import { canAccessPath, requiredAccessForPath } from '@/lib/navigation';
import type { AuthUser } from '@/types';
import { createAuthStore, type AuthStore, type AuthState, type AuthContextType } from '@/stores/authStore';

// ── Context: holds the per-instance store ─────────────────────

const AuthStoreContext = createContext<AuthStore | null>(null);

// ── Hooks ─────────────────────────────────────────────────────

/**
 * 细粒度 selector hook（新代码推荐使用）。
 * 只在选中的 state slice 变化时 re-render。
 *
 * @example
 * const currentUser = useAuthStore(s => s.currentUser);
 * const logout = useAuthStore(s => s.logout);
 */
export function useAuthStore<T>(selector: (s: AuthState) => T): T {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error('useAuthStore must be used within AuthProvider');
  return useStore(store, selector);
}

/**
 * 布局兼容 hook：订阅整个 auth store。业务组件应优先使用 selector。
 */
export function useAuthContext(): AuthContextType {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error('useAuthContext must be used within AuthProvider');
  return useStore(store);
}

/**
 * 获取 AuthStore 实例（非响应式，用于跨 store 依赖注入）。
 * 仅在 Provider 内部使用。
 */
export function useAuthStoreApi(): AuthStore {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error('useAuthStoreApi must be used within AuthProvider');
  return store;
}

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({
  children,
  initialUser,
  initialUserResolved,
  initialFeatureFlags,
  initialFeatureFlagsResolved,
  initialLocalMode,
  initialLocalModeResolved,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
  initialUserResolved: boolean;
  initialFeatureFlags: Record<string, boolean>;
  initialFeatureFlagsResolved: boolean;
  initialLocalMode: boolean;
  initialLocalModeResolved: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // per-instance store（useRef 保证 SSR 安全：每个请求/组件实例独立 store）
  const storeRef = useRef<AuthStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAuthStore({
      user: initialUser,
      userResolved: initialUserResolved,
      featureFlags: initialFeatureFlags,
      featureFlagsResolved: initialFeatureFlagsResolved,
      localMode: initialLocalMode,
      localModeResolved: initialLocalModeResolved,
    });
  }
  const store = storeRef.current;

  // 读取响应式 state（用于路由守卫 effect）
  const authLoading = useStore(store, (s) => s.authLoading);
  const featuresLoading = useStore(store, (s) => s.featuresLoading);
  const localModeLoading = useStore(store, (s) => s.localModeLoading);
  const localMode = useStore(store, (s) => s.localMode);
  const currentUser = useStore(store, (s) => s.currentUser);
  const enabledFeatures = useStore(store, (s) => s.enabledFeatures);

  // SSR 失败与「成功但未登录」必须区分。失败时在客户端持续重试，并让路由守卫
  // 保持暂停；只有部署模式与用户身份都得到明确结果后才解除 loading。
  useEffect(() => {
    if (initialUserResolved && initialLocalModeResolved) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const scheduleRetry = () => {
      if (cancelled) return;
      retryCount += 1;
      retryTimer = setTimeout(resolveAuth, Math.min(1000 * retryCount, 10000));
    };

    const resolveAuth = async () => {
      let resolvedLocalMode = store.getState().localMode;
      if (!initialLocalModeResolved && store.getState().localModeLoading) {
        try {
          const config = await authApi.oauthProviders();
          if (cancelled) return;
          resolvedLocalMode = config.local_no_login_enabled === true;
          store.setState({ localMode: resolvedLocalMode, localModeLoading: false });
        } catch {
          scheduleRetry();
          return;
        }
      }

      if (initialUserResolved || !store.getState().authLoading) return;
      const token = getAuthToken();
      if (!token && !resolvedLocalMode) {
        store.setState({ currentUser: null, authLoading: false });
        return;
      }

      try {
        // 启动时只在普通登录 session 即将过期时主动 refresh。
        if (token) {
          const expiresAtStr = getAuthTokenExpiresAt();
          const shouldRefresh =
            !expiresAtStr || new Date(expiresAtStr) < new Date(Date.now() + 7 * 86400000);
          if (shouldRefresh) {
            try {
              const refreshed = await authApi.refresh();
              if (!cancelled) setAuthTokenExpiresAt(refreshed.expires_at);
            } catch {
              // 继续走 me()；它会给出最终身份结果或触发下一轮网络重试。
            }
          }
        }
        const user = await authApi.me();
        if (!cancelled) store.setState({ currentUser: user, authLoading: false });
      } catch (err) {
        const isAuthFail =
          err instanceof Error && (err as Error & { isAuthError?: boolean }).isAuthError;
        if (isAuthFail) {
          if (token) setAuthToken(null);
          if (!cancelled) store.setState({ currentUser: null, authLoading: false });
          return;
        }
        scheduleRetry();
      }
    };

    void resolveAuth();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [initialLocalModeResolved, initialUserResolved, store]);

  // 成功返回的空 flags 是已解析状态；网络/服务错误则保持 loading 并重试。
  useEffect(() => {
    if (initialFeatureFlagsResolved) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const loadFeatureFlags = async () => {
      try {
        const { flags } = await settingsApi.getFeatureFlags();
        if (!cancelled) {
          store.setState({ enabledFeatures: flags || {}, featuresLoading: false });
        }
      } catch {
        if (cancelled) return;
        retryCount += 1;
        retryTimer = setTimeout(loadFeatureFlags, Math.min(1000 * retryCount, 10000));
      }
    };

    void loadFeatureFlags();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [initialFeatureFlagsResolved, store]);

  // 路由守卫：等待所有预取结果明确后再判断，避免 SSR 失败时误跳登录页。
  useEffect(() => {
    if (authLoading || featuresLoading || localModeLoading) return;
    if (localMode && (pathname === '/login' || pathname === '/plans')) {
      router.replace('/');
      return;
    }
    if (canAccessPath(pathname, currentUser, enabledFeatures)) return;
    router.replace(
      requiredAccessForPath(pathname, enabledFeatures) === 'admin' && currentUser
        ? '/'
        : '/login',
    );
  }, [authLoading, featuresLoading, localModeLoading, localMode, currentUser, enabledFeatures, pathname, router]);

  return <AuthStoreContext.Provider value={store}>{children}</AuthStoreContext.Provider>;
}

// Re-export types for backward compat
export type { AuthContextType };
