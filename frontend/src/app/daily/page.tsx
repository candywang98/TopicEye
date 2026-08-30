'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

const DailyReportPageClient = dynamic(() => import('./_DailyReportPageClient'), {
  ssr: false,
  loading: () => <PageSkeleton variant="detail" />,
});

export default function DailyReportPage() {
  return <SectionErrorBoundary title="日报暂时无法显示"><DailyReportPageClient /></SectionErrorBoundary>;
}
