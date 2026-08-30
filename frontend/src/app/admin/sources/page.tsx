'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

const SourcesPageClient = dynamic(() => import('./_SourcesPageClient'), {
  ssr: false,
  loading: () => <PageSkeleton variant="dashboard" />,
});

export default function SourcesPage() {
  return <SectionErrorBoundary title="信源管理暂时无法显示"><SourcesPageClient /></SectionErrorBoundary>;
}
