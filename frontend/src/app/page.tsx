'use client';

import CategoryChip from '@/components/CategoryChip';
import ContentAnalysisPanel from '@/components/ContentAnalysisPanel';
import Header from '@/components/Header';
import { Button, Toolbar, cx } from '@/components/ui';
import { useContentCategoriesQuery, useContentsListQuery } from '@/hooks/queries/useContentQueries';
import { useContentFavoriteStates } from '@/hooks/useContentFavoriteStates';
import { contentsApi } from '@/lib/api';
import {
  formatTimelineDate,
  isToday,
  parseUTC
} from '@/lib/datetime';
import { queryKeys } from '@/lib/query-keys';
import { explainRecommendation } from '@/lib/recommendation';
import { startContentWorkflow } from '@/lib/workflow';
import { useAuthStore, useFavoritesStore } from '@/providers/AppProvider';
import type { ContentAnalysis, ContentItem, PaginatedResponse, RecommendLevel } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RECOMMEND_FILTERS,
  TIME_RANGE_HOURS,
  formatShanghaiToday,
  getContentTime,
  getItemTags
} from './_app-utils';
import {
  ContentTimeline,
  Spinner,
  TimelineSummary
} from './_components';

const INITIAL_CONTENT_LIMIT = 40;
const CONTENT_LOAD_STEP = 40;

export default function HomePage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.currentUser);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const refreshCounts = useFavoritesStore((state) => state.refreshCounts);
  const reportContentTotal = useFavoritesStore((state) => state.reportContentTotal);
  const queryClient = useQueryClient();
  const [contentLimit, setContentLimit] = useState(INITIAL_CONTENT_LIMIT);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [categoryExpanded, setCategoryExpanded] = useState(false);
  const [activeRecommendLevel, setActiveRecommendLevel] = useState<RecommendLevel | '全部'>('全部');
  const [activeTag, setActiveTag] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTimeRange, setActiveTimeRange] = useState('24h');
  const [activeSourceType, setActiveSourceType] = useState('全部');
  const [selectedAnalysis, setSelectedAnalysis] = useState<ContentAnalysis | null>(null);
  const [workflowPendingId, setWorkflowPendingId] = useState<number | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const categoriesQuery = useContentCategoriesQuery();
  const contentParams = useMemo(() => ({
    page_size: contentLimit,
    hours: TIME_RANGE_HOURS[activeTimeRange],
    source_type: activeSourceType === '全部' ? undefined : activeSourceType,
    category: activeCategory === '全部' ? undefined : activeCategory,
    q: searchQuery.trim() || undefined,
    include_trend_sources: false,
  }), [activeCategory, activeSourceType, activeTimeRange, contentLimit, searchQuery]);
  const contentsQuery = useContentsListQuery(contentParams);
  const items = useMemo(() => contentsQuery.data?.items ?? [], [contentsQuery.data?.items]);
  const totalAvailable = contentsQuery.data?.total ?? items.length;
  const loading = contentsQuery.isLoading;
  const loadingMore = contentsQuery.isFetching && !contentsQuery.isLoading;

  const categoryOptions = useMemo(() => {
    const names = (categoriesQuery.data?.categories ?? [])
      .map((category) => category.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const merged = new Set(['全部', ...names]);
    items.forEach((item) => { if (item.category) merged.add(item.category); });
    return ['全部', ...Array.from(merged).filter((name) => name !== '全部')];
  }, [categoriesQuery.data, items]);

  useEffect(() => {
    reportContentTotal(totalAvailable);
  }, [reportContentTotal, totalAvailable]);

  useEffect(() => {
    if (contentsQuery.error) setError(contentsQuery.error instanceof Error ? contentsQuery.error.message : '获取内容失败');
  }, [contentsQuery.error]);

  const resetContentLimit = useCallback(() => {
    setContentLimit(INITIAL_CONTENT_LIMIT);
  }, []);

  const handleLoadMore = useCallback(() => {
    setContentLimit((limit) => limit + CONTENT_LOAD_STEP);
  }, []);

  const handleIgnore = useCallback(async (id: number) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    try {
      await contentsApi.ignore(id);
      queryClient.setQueryData(queryKeys.contents.list(contentParams), (current: PaginatedResponse<ContentItem> | undefined) => current ? {
        ...current,
        items: current.items.filter((item) => item.id !== id),
        total: Math.max(0, current.total - 1),
      } : current);
      refreshCounts?.();
    } catch (err) {
      console.error('Ignore failed:', err);
    }
  }, [contentParams, currentUser, queryClient, refreshCounts, router]);

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      getItemTags(item).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return [
      '全部',
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
        .slice(0, 16)
        .map(([tag]) => tag),
    ];
  }, [items]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const result = items.filter((item) => {
      if (activeCategory !== '全部' && item.category !== activeCategory) return false;
      if (activeRecommendLevel !== '全部' && explainRecommendation(item.analysis).level !== activeRecommendLevel) return false;
      if (activeTag !== '全部' && !getItemTags(item).includes(activeTag)) return false;
      // Search is now server-side (q parameter); no client-side title filtering
      return true;
    });
    // Sort by published_at descending
    result.sort((a, b) => {
      const ta = parseUTC(getContentTime(a)).getTime() || 0;
      const tb = parseUTC(getContentTime(b)).getTime() || 0;
      return tb - ta;
    });
    return result;
  }, [items, activeCategory, activeRecommendLevel, activeTag]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, Array<{ item: ContentItem; level: RecommendLevel }>>();
    filtered.forEach((item) => {
      const key = formatTimelineDate(getContentTime(item));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({
        item,
        level: explainRecommendation(item.analysis).level,
      });
    });
    return Array.from(groups.entries()).map(([dateLabel, entries]) => ({ dateLabel, entries }));
  }, [filtered]);
  const visibleContentIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const contentFavoriteState = useContentFavoriteStates(visibleContentIds);

  const handleStartWorkflow = useCallback(async (item: ContentItem, isFavorited: boolean) => {
    setWorkflowPendingId(item.id);
    setError(null);
    try {
      await startContentWorkflow({
        contentId: item.id,
        title: item.title,
        isFavorited,
        toggleFavorite,
        router,
      });
      contentFavoriteState.refresh();
      refreshCounts?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '推进选题失败');
    } finally {
      setWorkflowPendingId(null);
    }
  }, [contentFavoriteState, refreshCounts, router, toggleFavorite]);

  const levelSummary = useMemo(() => {
    const groups: Array<{ level: RecommendLevel; title: string; items: ContentItem[] }> = [
      { level: '强烈建议写', title: '主编推荐', items: [] },
      { level: '值得观察', title: '值得观察', items: [] },
      { level: '适合深挖', title: '适合深挖', items: [] },
      { level: '适合蹭热点', title: '热点观察', items: [] },
      { level: '不建议追', title: '低优先级', items: [] },
      { level: '信号不足', title: '待补信号', items: [] },
    ];
    const fallback = groups[5];
    filtered.forEach((item) => {
      const level = explainRecommendation(item.analysis).level;
      (groups.find((g) => g.level === level) || fallback).items.push(item);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [filtered]);

  // Stats
  const totalCount = totalAvailable || items.length;
  const todayCount = useMemo(() => items.filter((i) => isToday(getContentTime(i))).length, [items]);
  const clientOnlyFilterActive = activeRecommendLevel !== '全部' || activeTag !== '全部';
  const displayedTotalCount = clientOnlyFilterActive ? filtered.length : totalCount;

  // Today's date
  const dateStr = formatShanghaiToday();

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setShowBackToTop(el.scrollTop > window.innerHeight * 0.5);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="fade-in h-full overflow-y-auto px-10 py-8">
      {/* Header */}
      <Header
        title="今日选题"
        date={dateStr}
        stats={[
          { label: '总内容', value: displayedTotalCount, color: 'var(--color-primary-text)' },
          { label: '今日新增', value: todayCount, color: 'var(--color-teal-text)' },
        ]}
      />

      {/* Search bar */}
      <div className="mb-4 max-w-[820px]">
        <input
          type="text"
          placeholder="搜索标题、摘要、标签、AI分析..."
          value={searchQuery}
          onChange={(e) => {
            resetContentLimit();
            setSearchQuery(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-gray-900 outline-none transition focus:border-primary"
        />
      </div>

      {/* Filter row: time range + source type */}
      <div className="mb-3 max-w-[820px]">
        <Toolbar className="gap-3">
          {/* Time range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">时间</span>
            {['24h', '48h', '7d', '全部'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => {
                  resetContentLimit();
                  setActiveTimeRange(range);
                }}
                className={cx(
                  'rounded-xs px-2.5 py-1 text-xs transition',
                  activeTimeRange === range
                    ? 'bg-primary-light font-semibold text-primary-text'
                    : 'bg-gray-50 font-normal text-gray-500 hover:bg-gray-100',
                )}
              >
                {range === '全部' ? '全部' : range === '24h' ? '24小时' : range === '48h' ? '48小时' : '近7天'}
              </button>
            ))}
          </div>
          {/* Divider */}
          <div className="h-5 w-px bg-gray-200" />
          {/* Source type */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">来源</span>
            {['全部', 'RSS', 'RSSHub', '网站', 'Reddit', 'Zhihu'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  resetContentLimit();
                  setActiveSourceType(type);
                }}
                className={cx(
                  'rounded-xs px-2.5 py-1 text-xs transition',
                  activeSourceType === type
                    ? 'bg-primary-light font-semibold text-primary-text'
                    : 'bg-gray-50 font-normal text-gray-500 hover:bg-gray-100',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </Toolbar>
      </div>

      {/* Filters - Category (first row + expand) */}
      <div className="mb-3 max-w-[820px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-gray-500">分类</span>
          {(categoryExpanded
            ? categoryOptions
            : categoryOptions.slice(0, 6)
          ).map((c) => (
            <CategoryChip
              key={c}
              name={c}
              active={activeCategory === c}
              onClick={() => {
                resetContentLimit();
                setActiveCategory(c);
                setActiveTag('全部');
              }}
            />
          ))}
          {categoryOptions.length > 6 && (
            <button
              type="button"
              onClick={() => setCategoryExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-normal text-gray-500 transition hover:border-primary-border hover:text-primary-text"
            >
              {categoryExpanded ? '收起' : `更多 ${categoryOptions.length - 6}`}
              {categoryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 max-w-[820px]">
        <Toolbar className="gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">推荐</span>
            {RECOMMEND_FILTERS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setActiveRecommendLevel(level)}
                className={cx(
                  'rounded-xs px-2.5 py-1 text-xs transition',
                  activeRecommendLevel === level
                    ? 'bg-primary-light font-semibold text-primary-text'
                    : 'bg-gray-50 font-normal text-gray-500 hover:bg-gray-100',
                )}
              >
                {level === '全部' ? '全部' : level}
              </button>
            ))}
          </div>
        </Toolbar>
      </div>

      <div className="mb-7 max-w-[820px]">
        <Toolbar className="gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">标签</span>
            {tagOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={cx(
                  'rounded-xs px-2.5 py-1 text-xs transition',
                  activeTag === tag
                    ? 'bg-teal-light font-semibold text-teal-text'
                    : 'bg-gray-50 font-normal text-gray-500 hover:bg-gray-100',
                )}
              >
                {tag === '全部' ? '全部' : `#${tag}`}
              </button>
            ))}
          </div>
        </Toolbar>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-5 max-w-[820px] rounded-lg border border-red bg-red-light px-5 py-4 text-sm text-red">
          加载失败：{error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="max-w-[820px] py-[60px] text-center">
          <Spinner />
          <div className="mt-3 text-[13px] text-gray-400">加载中...</div>
        </div>
      )}

      {/* Editorial content flow */}
      {!loading && !error && (
        <div className="grid items-start gap-6 pb-[60px] xl:grid-cols-[minmax(0,820px)_260px]">
          <div className="min-w-0">
            <ContentTimeline
              groups={timelineGroups}
              isFavorited={contentFavoriteState.isFavorited}
              onToggleFav={async (id) => {
                const wasFav = contentFavoriteState.isFavorited(id);
                await toggleFavorite(id);
                contentFavoriteState.refresh();
                contentsApi.trackEvidenceInteraction(id, wasFav ? 'unfavorite' : 'favorite');
              }}
              onIgnore={handleIgnore}
              onShowAnalysis={(a) => setSelectedAnalysis(a)}
              onStartWorkflow={handleStartWorkflow}
              workflowPendingId={workflowPendingId}
            />
            {items.length < totalAvailable && (
              <div className="mt-6 text-center">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? '加载中…' : `加载更多（还有 ${totalAvailable - items.length} 条）`}
                </Button>
                <div className="mt-2 text-[11px] text-gray-400">首屏优先展示最新内容，按需继续展开。</div>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="py-[60px] text-center text-sm text-gray-400">
                当前筛选条件下没有内容
              </div>
            )}
          </div>
          <TimelineSummary
            groups={levelSummary}
            total={filtered.length}
            availableTotal={clientOnlyFilterActive ? undefined : totalCount}
          />
        </div>
      )}

      {/* Back to top button */}
      {showBackToTop && !selectedAnalysis && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 grid h-11 w-11 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-lg transition hover:border-primary-border hover:text-primary"
          aria-label="回到顶部"
        >
          <ArrowUp size={20} strokeWidth={2.2} />
        </button>
      )}

      {/* Analysis panel overlay */}
      {selectedAnalysis && (
        <>
          <div
            onClick={() => setSelectedAnalysis(null)}
            className="fixed inset-0 z-[999] bg-black/20"
          />
          <ContentAnalysisPanel
            analysis={selectedAnalysis}
            onClose={() => setSelectedAnalysis(null)}
          />
        </>
      )}
    </div>
  );
}
