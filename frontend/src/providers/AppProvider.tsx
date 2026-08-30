'use client';

import React from 'react';
import { AuthProvider } from './AuthProvider';
import { FavoritesProvider } from './FavoritesProvider';
import { ReaderProvider } from './ReaderProvider';
import type { PrefetchData } from '@/lib/server-prefetch';
import { QueryProvider } from './QueryProvider';

// ── AppProvider: composes Auth → Favorites → Reader ───────────

export function AppProvider({ children, initialData }: { children: React.ReactNode; initialData: PrefetchData }) {
  // initialData 只用于首次挂载。App Router 软导航可能重新流式传入根布局 props，
  // 但不能因此重置或重新触发已经初始化完成的客户端 stores。
  const [stableInitialData] = React.useState(initialData);

  return (
    <QueryProvider>
      <AuthProvider
        initialUser={stableInitialData.user}
        initialUserResolved={stableInitialData.userResolved}
        initialFeatureFlags={stableInitialData.featureFlags}
        initialFeatureFlagsResolved={stableInitialData.featureFlagsResolved}
        initialLocalMode={stableInitialData.localMode}
        initialLocalModeResolved={stableInitialData.localModeResolved}
      >
        <FavoritesProvider initialCounts={stableInitialData.counts}>
          <ReaderProvider>
            {children}
          </ReaderProvider>
        </FavoritesProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

// Re-export individual hooks for new code that wants granular access
export { useAuthContext } from './AuthProvider';
export { useFavoritesContext } from './FavoritesProvider';
export { useReaderContext } from './ReaderProvider';

// Re-export store hooks with selector support for new code
export { useAuthStore } from './AuthProvider';
export { useFavoritesStore } from './FavoritesProvider';
export { useReaderStore } from './ReaderProvider';
