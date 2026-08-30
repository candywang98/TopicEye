'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { contentCategoriesApi, contentsApi, viralApi } from '@/lib/api';
import type { ContentFilterParams } from '@/types';
import { queryKeys } from '@/lib/query-keys';

export function useTodayPicksQuery(params: {
  category?: string;
  content_type?: string;
  time_range?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.picks.list(params),
    queryFn: ({ signal }) => contentsApi.todayPicks(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useContentsListQuery(params: ContentFilterParams) {
  return useQuery({
    queryKey: queryKeys.contents.list(params),
    queryFn: ({ signal }) => contentsApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useContentCategoriesQuery() {
  return useQuery({
    queryKey: ['contents', 'categories'],
    queryFn: () => contentCategoriesApi.list(),
    staleTime: 10 * 60_000,
  });
}

export function useLowFollowerViralQuery(params: {
  page: number;
  hours: number;
  category?: string;
  page_size: number;
}) {
  return useQuery({
    queryKey: queryKeys.contents.viral(params),
    queryFn: ({ signal }) => viralApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function usePicksEvidenceQuery(ids: number[]) {
  return useQuery({
    queryKey: queryKeys.picks.evidence(ids),
    queryFn: () => contentsApi.getEvidenceBatch(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}
