/**
 * SSR 数据预取工具。
 *
 * 在 Next.js Server Component（layout.tsx）中执行，读取 HttpOnly auth cookie，
 * 并行请求后端 API 获取首屏所需数据，消除客户端 useEffect 串行拉取导致的白屏。
 *
 * 设计要点：
 * - 所有 fetch 均设 3s 超时 + 错误兜底，后端不可达时返回 null，不阻塞渲染。
 * - auth cookie（topiceye_auth）是 HttpOnly，JS 不可读，但 Server Component
 *   通过 next/headers 的 cookies() 可读取，直接转发给后端。
 * - cache: 'no-store' 确保用户敏感数据不被 CDN/边缘缓存。
 */

import { cookies } from 'next/headers';
import type { AuthUser } from '@/types';

// 后端 API 绝对地址（Server Component 中不能走 Next.js rewrite 代理，需要直接访问后端）
const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8102';
const API_BASE = `${BACKEND_URL}/api/v1`;

// Cookie 名称（与后端 config.py AUTH_COOKIE_NAME 保持一致）
const AUTH_COOKIE_NAME = 'topiceye_auth';

// 超时：3 秒，后端不可达时不阻塞 SSR
const FETCH_TIMEOUT_MS = 3000;

export interface PrefetchCounts {
  todayPicks: number;
  sourceCount: number;
  favoriteTotal: number;
}

export interface PrefetchData {
  user: AuthUser | null;
  userResolved: boolean;
  featureFlags: Record<string, boolean>;
  featureFlagsResolved: boolean;
  counts: PrefetchCounts | null;
  localMode: boolean;
  localModeResolved: boolean;
}

interface PrefetchResult<T> {
  value: T | null;
  resolved: boolean;
}

async function fetchWithTimeout(
  url: string,
  cookieHeader: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store' as RequestCache,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonResult<T>(
  endpoint: string,
  cookieHeader: string,
  resolvedEmptyStatuses: number[] = [],
): Promise<PrefetchResult<T>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, cookieHeader);
    if (resolvedEmptyStatuses.includes(response.status)) {
      return { value: null, resolved: true };
    }
    if (!response.ok) return { value: null, resolved: false };
    if (response.status === 204) return { value: null, resolved: true };
    const text = await response.text();
    if (!text) return { value: null, resolved: true };
    return { value: JSON.parse(text) as T, resolved: true };
  } catch {
    return { value: null, resolved: false };
  }
}

/**
 * 在 Server Component 中执行首屏数据预取。
 *
 * 读取 HttpOnly auth cookie，并行请求：
 * 1. /auth/me              — 用户信息（解锁路由守卫，消除 authLoading 白屏）
 * 2. /settings/feature-flags — 功能开关（解锁路由守卫第二条件）
 * 3. /contents/today-count   — 侧边栏今日精选计数
 * 4. /sources?page_size=1    — 信源总数（管理员）或 /sources/me（普通用户）
 * 5. /favorites?page=1&page_size=1 — 收藏总数
 *
 * 3-5 依赖用户信息（需要知道是否是管理员），因此在 /auth/me 完成后再发起。
 * 所有错误均静默降级为 null，客户端 Provider 会 fallback 到 useEffect 拉取。
 */
export async function prefetchInitialData(): Promise<PrefetchData> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const cookieHeader = authToken ? `${AUTH_COOKIE_NAME}=${authToken}` : '';

  // 先解析公开部署模式；本地免登录开启时，即使没有 cookie 也要向后端请求真实工作区用户。
  const authConfigResult = await fetchJsonResult<{
    providers: string[];
    local_no_login_enabled?: boolean;
  }>('/auth/oauth/providers', cookieHeader);
  const localMode = authConfigResult.value?.local_no_login_enabled === true;

  // 第一批：auth/me + feature-flags 并行（不依赖用户信息）。
  // 生产环境没有 cookie 时可以直接确定为未登录；部署模式请求失败则保守地交给客户端重试。
  const userRequest: Promise<PrefetchResult<AuthUser>> = authToken || localMode
    ? fetchJsonResult<AuthUser>('/auth/me', cookieHeader, [401, 403])
    : Promise.resolve({
        value: null,
        resolved: authConfigResult.resolved,
      });
  const [userResult, featureFlagsResult] = await Promise.all([
    userRequest,
    fetchJsonResult<{ flags: Record<string, boolean> }>('/settings/feature-flags', cookieHeader),
  ]);
  const user = userResult.value;

  // 第二批：侧边栏计数（依赖 user 判断管理员走不同端点）
  let counts: PrefetchCounts | null = null;
  if (user) {
    const isAdminUser = user.role === 'admin';
    const [todayCount, sourcesResult, favoritesResult] = await Promise.all([
      fetchJsonResult<{ today_content: number; today_picks: number }>(
        '/contents/today-count',
        cookieHeader,
      ),
      fetchJsonResult<{ total?: number; items?: unknown[] }>(
        isAdminUser ? '/sources?page=1&page_size=1' : '/sources/me?page=1&page_size=1',
        cookieHeader,
      ),
      fetchJsonResult<{ total?: number; items?: unknown[] }>(
        '/favorites?page=1&page_size=1',
        cookieHeader,
      ),
    ]);

    counts = {
      todayPicks: todayCount.value?.today_picks ?? 0,
      sourceCount: sourcesResult.value?.total ?? sourcesResult.value?.items?.length ?? 0,
      favoriteTotal: favoritesResult.value?.total ?? 0,
    };
  }

  return {
    user,
    userResolved: userResult.resolved,
    featureFlags: featureFlagsResult.value?.flags ?? {},
    featureFlagsResolved: featureFlagsResult.resolved,
    counts,
    localMode,
    localModeResolved: authConfigResult.resolved,
  };
}
