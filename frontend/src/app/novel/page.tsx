'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

const NovelPageClient = dynamic(() => import('./_NovelPageClient'), {
  ssr: false,
  loading: () => <PageSkeleton variant="dashboard" />,
});

export default function NovelPage() {
  return <SectionErrorBoundary title="网文雷达暂时无法显示"><NovelPageClient /></SectionErrorBoundary>;
}
