'use client';

/**
 * Evaluate tab（模型 A/B 测评运行 + 人工评分）。
 *
 * 从 app/model-eval/page.tsx 抽出的 169 行组件，包含：
 * - 测评模型选择（多选 toolbar，自动过滤无 Key 模型）
 * - 4 种 prompt 类型选择（analysis / daily_report / weekly_digest / classification）
 * - handleRun 调用 modelsApi.runEvaluation + getEvalRun
 * - handleScore 人工评分 1-5（逐个 eval 结果手动打分）
 *
 * 状态：selected（已选模型 id Set）/ promptType / running（测评进行中）/
 * result（最近一次测评结果）/ scoringId（正在评分的 id）。
 *
 * 7 个 UI 原子（Surface / Panel / Toolbar / Button / StatusPill / StatTile /
 * TextInput / FieldLabel / InfoCell / SelectInput）从 _components.tsx 复用。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Layers3,
  Loader2,
  Play,
} from 'lucide-react';
import { Button, Panel, Toolbar, cx } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateView';
import { AdminNoticeBanner } from '@/components/admin-ui';
import { StatusPill, Surface } from './_components';
import { modelsApi } from '@/lib/api';
import type { EvalResult, LlmModelItem } from '@/lib/api';

export function EvaluateTab({
  models,
  modelsError,
  onOpenModels,
}: {
  models: LlmModelItem[];
  modelsError?: string | null;
  onOpenModels: () => void;
}) {
  const enabledModels = useMemo(() => models.filter((m) => m.enabled), [models]);
  const runnableModelIds = useMemo(
    () => new Set(enabledModels.filter((m) => m.api_key_set || !m.api_base).map((m) => m.id)),
    [enabledModels],
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [promptType, setPromptType] = useState('analysis');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ eval_run_id: string; results: EvalResult[] } | null>(null);
  const [scoringId, setScoringId] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => runnableModelIds.has(id))));
  }, [runnableModelIds]);

  const toggleModel = (id: number) => {
    if (!runnableModelIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRun = async () => {
    if (selected.size < 2) return;
    setRunning(true);
    setResult(null);
    setRunError(null);
    try {
      const res = await modelsApi.runEvaluation({
        model_ids: [...selected],
        prompt_type: promptType,
      });
      const detail = await modelsApi.getEvalRun(res.eval_run_id);
      setResult(detail);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '测评运行失败');
    } finally {
      setRunning(false);
    }
  };

  const handleScore = async (evalId: number, score: number) => {
    setScoringId(evalId);
    setRunError(null);
    try {
      await modelsApi.scoreEvaluation(evalId, score);
      if (result) {
        setResult({
          ...result,
          results: result.results.map((r) => (r.id === evalId ? { ...r, quality_score: score } : r)),
        });
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '人工评分保存失败');
    } finally {
      setScoringId(null);
    }
  };

  const promptTypes = [
    { value: 'analysis', label: '选题分析' },
    { value: 'daily_report', label: 'AI 日报' },
    { value: 'weekly_digest', label: 'AI 周刊' },
    { value: 'classification', label: '内容分类' },
  ];

  if (modelsError && models.length === 0) {
    return (
      <Surface title="A/B 测评" icon={FlaskConical}>
        <ErrorState error={`无法读取可测模型：${modelsError}`} />
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {runError && (
        <AdminNoticeBanner tone="red" onClose={() => setRunError(null)}>
          {runError}
        </AdminNoticeBanner>
      )}

      <Surface title="选择测评模型" icon={Layers3} hint={`${selected.size} / ${runnableModelIds.size} 已选`}>
        {enabledModels.length === 0 ? (
          <EmptyState
            panel={false}
            minHeight="180px"
            icon={Layers3}
            title="没有可参与测评的模型"
            desc="请先添加并启用至少两个模型，再回到这里进行同题对比。"
            actions={[{ label: '配置模型', onClick: onOpenModels, variant: 'primary' }]}
          />
        ) : (
          <>
            <div role="group" aria-label="选择参与测评的模型">
              <Toolbar>
                {enabledModels.map((m) => {
                  const runnable = runnableModelIds.has(m.id);
                  const active = selected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleModel(m.id)}
                      disabled={!runnable}
                      title={runnable ? undefined : '该模型缺少 API Key，暂不能参与测评'}
                      className={cx(
                        'rounded-sm border px-3 py-2 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
                        active ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-primary-border',
                      )}
                    >
                      {m.name}
                      {!runnable && <span className="ml-1 text-[10px]">(缺 Key)</span>}
                    </button>
                  );
                })}
              </Toolbar>
            </div>
            {selected.size < 2 && <div className="mt-2 text-xs font-bold text-amber">还需选择 {2 - selected.size} 个可调用模型</div>}
          </>
        )}
      </Surface>

      <Surface title="测评任务" icon={FlaskConical}>
        <div role="group" aria-label="选择测评任务类型" className="mb-4">
          <Toolbar>
            {promptTypes.map((pt) => (
              <button
                key={pt.value}
                type="button"
                aria-pressed={promptType === pt.value}
                onClick={() => setPromptType(pt.value)}
                className={cx(
                  'rounded-xs border px-3 py-1.5 text-[13px] font-bold transition',
                  promptType === pt.value ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-primary-border',
                )}
              >
                {pt.label}
              </button>
            ))}
          </Toolbar>
        </div>

        <Button type="button" variant="primary" onClick={handleRun} disabled={running || selected.size < 2} className="px-5 text-sm">
          {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2.2} />}
          {running ? '测评进行中' : '开始 A/B 测评'}
        </Button>
      </Surface>

      {result && (
        <Surface title="测评结果" icon={CheckCircle2} hint={result.eval_run_id}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {result.results.map((r) => (
              <Panel key={r.id} className={cx('flex flex-col gap-2 p-4', r.status === 'DONE' ? 'border-teal-border' : 'border-red-light')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-black text-gray-900">{r.model_name}</div>
                  <StatusPill tone={r.status === 'DONE' ? 'teal' : 'red'}>{r.status === 'DONE' ? '完成' : '失败'}</StatusPill>
                </div>
                <div className="text-xs text-gray-500">{r.status === 'DONE' ? `${r.duration_ms}ms` : r.error_message?.slice(0, 60)}</div>
                {r.tokens_input !== null && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                    Token: {r.tokens_input}
                    <ArrowRight size={12} strokeWidth={2} />
                    {r.tokens_output}
                  </div>
                )}
                {r.response_text && (
                  <div className="max-h-[200px] overflow-auto whitespace-pre-wrap rounded-xs bg-gray-50 p-2.5 text-xs leading-5 text-gray-700">
                    {r.response_text}
                  </div>
                )}
                {r.auto_score !== null && <div className="text-[11px] text-gray-500">自动评分: {r.auto_score}/5</div>}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-gray-500">人工评分:</span>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleScore(r.id, s)}
                      disabled={scoringId === r.id}
                      className={cx(
                        'h-7 w-7 rounded-xs border text-sm transition disabled:cursor-wait disabled:opacity-60',
                        r.quality_score === s ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 bg-white text-gray-500 hover:border-primary-border',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </Surface>
      )}
    </div>
  );
}
