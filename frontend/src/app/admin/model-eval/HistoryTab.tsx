'use client';

/**
 * History tab（测评历史记录 + 展开查看单次结果）。
 *
 * 从 app/model-eval/page.tsx 抽出的 28 行组件：
 * - useEffect 拉取最近 30 次测评运行
 * - 每条记录可展开查看所有模型的 status / duration / quality_score / auto_score
 *
 * 状态：runs（EvalRun[]）/ loading / expandedRun（当前展开的 runId）/
 * runDetail（展开的 EvalResult[]）。
 *
 * 5 个 UI 原子（Surface / LoadingState / EmptyState / StatusPill / Button）从
 * _components.tsx 复用。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { modelsApi } from '@/lib/api';
import type { EvalResult, EvalRun } from '@/lib/api';
import { cx } from '@/components/ui';
import { promptTypeLabel } from './_model-eval-utils';
import { StatusPill, Surface } from './_components';

export function HistoryTab() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<{ runId: string; results: EvalResult[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequest = useRef(0);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await modelsApi.listEvalRuns(30);
      setRuns(res.runs);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '测评历史加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const loadDetail = async (runId: string) => {
    const requestId = ++detailRequest.current;
    setRunDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await modelsApi.getEvalRun(runId);
      if (detailRequest.current === requestId) {
        setRunDetail({ runId, results: detail.results });
      }
    } catch (requestError) {
      if (detailRequest.current === requestId) {
        setDetailError(requestError instanceof Error ? requestError.message : '测评详情加载失败');
      }
    } finally {
      if (detailRequest.current === requestId) setDetailLoading(false);
    }
  };

  const handleExpand = (runId: string) => {
    if (expandedRun === runId) {
      detailRequest.current += 1;
      setExpandedRun(null);
      setRunDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    setExpandedRun(runId);
    void loadDetail(runId);
  };

  if (loading) {
    return (
      <Surface title="测评历史" icon={History}>
        <LoadingState minHeight="220px" />
      </Surface>
    );
  }

  if (runs.length === 0) {
    if (error) {
      return (
        <Surface title="测评历史" icon={History}>
          <ErrorState error={error} onRetry={() => void loadRuns()} />
        </Surface>
      );
    }

    return (
      <Surface title="测评历史" icon={History}>
        <EmptyState panel={false} minHeight="220px" icon={History} title="暂无测评记录" desc="完成第一次 A/B 测评后，运行结果和人工评分会保存在这里。" />
      </Surface>
    );
  }

  return (
    <Surface title="测评历史" icon={History} hint={`${runs.length} 条记录`}>
      <div className="flex flex-col gap-2">
        {runs.map((run) => (
          <div key={run.eval_run_id}>
            <button
              type="button"
              onClick={() => handleExpand(run.eval_run_id)}
              aria-expanded={expandedRun === run.eval_run_id}
              aria-controls={`eval-run-${run.eval_run_id}`}
              className="flex w-full items-center justify-between gap-3 rounded-sm border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-primary-border"
            >
              <div className="min-w-0">
                <span className="text-[13px] font-black text-gray-900">{promptTypeLabel[run.prompt_type] || run.prompt_type}</span>
                <span className="ml-2 text-[11px] text-gray-400">
                  {run.model_count} 个模型 · {run.created_at?.slice(0, 19).replace('T', ' ')}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill tone="teal">{run.done_count} 成功</StatusPill>
                {run.fail_count > 0 && <StatusPill tone="red">{run.fail_count} 失败</StatusPill>}
                <ChevronDown size={15} className={cx('text-gray-400 transition-transform', expandedRun === run.eval_run_id && 'rotate-180')} />
              </div>
            </button>
            {expandedRun === run.eval_run_id && (
              <div id={`eval-run-${run.eval_run_id}`} className="rounded-b-sm border border-t-0 border-gray-200 bg-gray-50 px-4 py-2">
                {detailLoading && <LoadingState panel={false} minHeight="96px" label="正在加载测评详情…" />}
                {detailError && <ErrorState error={detailError} onRetry={() => void loadDetail(run.eval_run_id)} />}
                {runDetail?.runId === run.eval_run_id && runDetail.results.map((r) => (
                  <div key={r.id} className="flex flex-wrap gap-3 border-b border-gray-100 py-2 last:border-b-0">
                    <span className="min-w-20 text-[13px] font-bold text-gray-800">{r.model_name}</span>
                    <span className={cx('text-xs', r.status === 'DONE' ? 'text-teal' : 'text-red')}>
                      {r.status} · {r.duration_ms}ms
                    </span>
                    {r.quality_score && <span className="text-xs text-primary">人工: {r.quality_score}/5</span>}
                    {r.auto_score !== null && <span className="text-xs text-gray-400">自动: {r.auto_score}/5</span>}
                    {r.error_message && <span className="text-[11px] text-red" title={r.error_message}>错误</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Surface>
  );
}
