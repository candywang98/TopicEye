'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { motherTopicsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function useMotherTopicsQuery(activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.motherTopics.list(activeOnly),
    queryFn: () => motherTopicsApi.list(activeOnly),
  });
}

export function useMotherTopicCandidatesQuery(params: {
  topic_id?: number;
  min_score: number;
  page: number;
  page_size: number;
}) {
  return useQuery({
    queryKey: queryKeys.motherTopics.candidates(params),
    queryFn: ({ signal }) => motherTopicsApi.candidates(params, { signal }),
    placeholderData: keepPreviousData,
  });
}
