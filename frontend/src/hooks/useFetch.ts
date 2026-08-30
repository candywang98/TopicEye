'use client';

/**
 * 通用数据获取 hook，收敛各 page.tsx 重复的 useEffect + fetch + loading/error 三件套。
 *
 * 设计要点：
 * - `fetcher` 为 `(signal) => Promise<T>`，调用方用 useCallback 闭包绑定参数（分页、过滤等）。
 * - `deps` 变化时自动重新获取（替代手写 useEffect 依赖数组）。
 * - `enabled` 守卫：为 false 时跳过获取（用于鉴权等待等场景）。
 * - 返回 `refetch` 用于手动重新获取（重试按钮、下拉刷新等）。
 * - 新请求开始或组件卸载时取消旧请求，同时保留异步竞态保护。
 *
 * 不强制 error 文案：fetcher 内部抛出的 Error.message 直接作为 error。
 * 调用方可在 fetcher 内 catch 并抛出自定义 message（如「权益规划加载失败」）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '@/lib/api/_core';

export type UseFetchResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 手动重新获取（用最近一次 fetcher）。返回结果供调用方按需处理。 */
  refetch: () => Promise<T | null>;
  /** 直接设置 data（用于本地乐观更新、翻页局部替换等）。 */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
};

export function useFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  options: {
    /** 为 false 时不获取（且 loading 保持为 true 直到 enabled）。默认 true。 */
    enabled?: boolean;
    /** 初始 loading 状态。enabled=false 时建议传 false 避免「加载中」闪烁。 */
    initialLoading?: boolean;
  } = {},
): UseFetchResult<T> {
  const { enabled = true, initialLoading = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  // AbortController 负责停止网络请求；seq 继续防止已完成的旧结果覆盖新状态。
  const seqRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (): Promise<T | null> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(controller.signal);
      if (seqRef.current !== seq) return null; // 已被新请求取代
      setData(result);
      return result;
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err) || seqRef.current !== seq) return null;
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      return null;
    } finally {
      if (seqRef.current === seq) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  // deps 变化或 enabled 切换时自动获取
  useEffect(() => {
    if (!enabled) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  // 卸载时使后续回调失效
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      seqRef.current++;
    };
  }, []);

  return { data, loading, error, refetch: run, setData };
}
