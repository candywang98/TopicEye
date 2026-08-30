'use client';

import { favoritesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { FavoriteStatus, FavoriteTargetType } from '@/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useFavoritesBoardQuery(params: {
  target_type: FavoriteTargetType | '';
  status: FavoriteStatus | '';
  keyword?: string;
  page_size: number;
}) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.favorites.list(params),
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) => favoritesApi.list({ ...params, page: pageParam }, { signal }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + (page.items?.length || 0), 0);
      return loaded < (lastPage.total || 0) ? pages.length + 1 : undefined;
    },
  });
  const data = useMemo(() => {
    if (!query.data) return undefined;
    return {
      items: query.data.pages.flatMap((page) => page.items || []),
      total: query.data.pages[0]?.total || 0,
    };
  }, [query.data]);
  return { ...query, data };
}
