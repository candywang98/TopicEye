'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import {
  BarChart3,
  Beaker,
  BrainCircuit,
  Clock3,
  Coins,
  FlaskConical,
  Gauge,
  History,
  KeyRound,
  Layers3,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Panel, cx } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateView';
import { AdminNoticeBanner, AdminPageShell, AdminPageHeader } from '@/components/admin-ui';
import { modelsApi } from '@/lib/api';
import type { LlmModelItem, ModelUsageSummary } from '@/lib/api';
import { type Tab, formatTokens, formatCurrency } from './_model-eval-utils';
import { StatTile, Surface } from './_components';
import { ModelsTab } from './ModelsTab';
import { EvaluateTab } from './EvaluateTab';
import { UsageTab } from './UsageTab';
import { HistoryTab } from './HistoryTab';

const TABS: Array<{ key: Tab; label: string; desc: string; icon: LucideIcon }> = [
  { key: 'models', label: '模型配置', desc: '路由、密钥与限流', icon: Settings2 },
  { key: 'evaluate', label: 'A/B 测评', desc: '同题对比与人工评分', icon: FlaskConical },
  { key: 'usage', label: '用量统计', desc: 'Token 与费用分析', icon: BarChart3 },
  { key: 'history', label: '测评历史', desc: '运行记录与评分结果', icon: History },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function ModelEvalPage() {
  const [tab, setTab] = useState<Tab>('models');
  const [models, setModels] = useState<LlmModelItem[]>([]);
  const [usage, setUsage] = useState<ModelUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchModels = useCallback(async () => {
    setModelsError(null);
    try {
      const res = await modelsApi.list();
      setModels(res.models);
    } catch (error) {
      setModelsError(errorMessage(error, '模型配置加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    setUsageError(null);
    setUsageLoading(true);
    try {
      const res = await modelsApi.usageSummary(30);
      setUsage(res);
    } catch (error) {
      setUsageError(errorMessage(error, '用量统计加载失败'));
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchModels(), fetchUsage()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchModels, fetchUsage]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const enabledCount = models.filter((m) => m.enabled).length;
  const runnableCount = models.filter((m) => m.enabled && (m.api_key_set || !m.api_base)).length;
  const routeGroups = new Set(models.map((m) => m.routing_group || 'default')).size;
  const firstRouteModel = [...models]
    .filter((m) => m.enabled)
    .sort((a, b) => (a.routing_group || 'default').localeCompare(b.routing_group || 'default') || a.routing_priority - b.routing_priority || a.id - b.id)[0];

  const modelsUnavailable = Boolean(modelsError && models.length === 0);
  const usageUnavailable = Boolean(usageError && !usage);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: Tab) => {
    const currentIndex = TABS.findIndex((item) => item.key === current);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex].key;
    setTab(nextTab);
    document.getElementById(`model-eval-${nextTab}-tab`)?.focus();
  };

  return (
    <AdminPageShell maxWidth={1480}>
      {/* Header */}
      <Panel className="overflow-hidden p-5 sm:p-6">
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <AdminPageHeader
              title="AI 引擎工作台"
              icon={BrainCircuit}
              description="管理内容分析、日报、周刊和分类任务使用的模型，定期做 A/B 测评，保留人工评分作为模型选择依据。"
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => void refreshAll()} disabled={refreshing} className="w-fit whitespace-nowrap">
            <RefreshCw size={14} strokeWidth={2.2} className={refreshing ? 'animate-spin' : undefined} />
            {refreshing ? '刷新中' : '刷新数据'}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3 2xl:grid-cols-6">
          <StatTile icon={Layers3} label="模型配置" value={modelsUnavailable ? '—' : models.length} hint={modelsUnavailable ? '等待重新加载' : `${enabledCount} 个启用`} tone="primary" />
          <StatTile icon={KeyRound} label="可测模型" value={modelsUnavailable ? '—' : runnableCount} hint={modelsUnavailable ? '状态未知' : '具备调用条件'} tone="teal" />
          <StatTile icon={ShieldCheck} label="路由组" value={modelsUnavailable ? '—' : routeGroups} hint={modelsUnavailable ? '状态未知' : '按组独立排序'} tone="amber" />
          <StatTile icon={Clock3} label="首选路由" value={firstRouteModel ? `#${firstRouteModel.routing_priority}` : '-'} hint={firstRouteModel?.name || '未设置'} />
          <StatTile icon={Gauge} label="30日 Token" value={usageUnavailable ? '—' : usage ? formatTokens(usage.total.tokens_total) : '-'} hint={usageUnavailable ? '等待重新加载' : `输入 ${formatTokens(usage?.total.tokens_input || 0)} · 输出 ${formatTokens(usage?.total.tokens_output || 0)}`} tone="purple" />
          <StatTile icon={Coins} label="费用预估" value={usageUnavailable ? '—' : usage ? formatCurrency(usage.total.estimated_cost) : '-'} hint={usageUnavailable ? '状态未知' : `${usage?.total.calls || 0} 次模型调用`} tone="primary" />
        </div>
      </Panel>

      {modelsError && models.length > 0 && (
        <AdminNoticeBanner tone="red">模型列表未能更新，当前显示上一次成功加载的数据：{modelsError}</AdminNoticeBanner>
      )}

      <div className="border-b border-gray-200" role="tablist" aria-label="AI 引擎视图">
        <div className="grid grid-cols-2 sm:flex">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`model-eval-${item.key}-tab`}
              aria-selected={active}
              aria-controls={`model-eval-${item.key}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(item.key)}
              onKeyDown={(event) => handleTabKeyDown(event, item.key)}
              className={cx(
                'flex min-w-0 flex-1 items-center gap-2.5 border-b-2 px-4 py-3 text-left transition',
                active
                  ? 'border-primary bg-primary-light/40 text-primary'
                  : 'border-transparent text-gray-500 hover:bg-white hover:text-gray-800',
              )}
            >
              <Icon size={16} className="shrink-0" strokeWidth={2.2} />
              <div className="min-w-0">
                <div className="whitespace-nowrap text-[13px] font-black">{item.label}</div>
                <div className={cx('mt-0.5 hidden whitespace-nowrap text-[10.5px] lg:block', active ? 'text-primary-text' : 'text-gray-400')}>{item.desc}</div>
              </div>
            </button>
          );
        })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`model-eval-${tab}-panel`}
        aria-labelledby={`model-eval-${tab}-tab`}
      >
        {loading ? (
          <Surface title="加载状态" icon={Beaker}>
            <LoadingState label="正在读取模型配置…" minHeight="220px" />
          </Surface>
        ) : (
          <>
            {tab === 'models' && (
              modelsUnavailable ? (
                <Surface title="模型配置" icon={Settings2}>
                  <ErrorState error={modelsError || '模型配置加载失败'} onRetry={() => void fetchModels()} />
                </Surface>
              ) : (
                <ModelsTab models={models} onRefresh={refreshAll} />
              )
            )}
            {tab === 'evaluate' && <EvaluateTab models={models} modelsError={modelsError} onOpenModels={() => setTab('models')} />}
            {tab === 'usage' && <UsageTab usage={usage} loading={usageLoading} error={usageError} onRefresh={fetchUsage} />}
            {tab === 'history' && <HistoryTab />}
          </>
        )}
      </div>
    </AdminPageShell>
  );
}
