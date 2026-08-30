import type { Metadata } from 'next';
import { DM_Sans, DM_Mono, Noto_Serif_SC } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';
import SkipToContent from '@/components/SkipToContent';
import { prefetchInitialData, type PrefetchData } from '@/lib/server-prefetch';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-dm-mono',
});

// 衬线 display 字体：用于页面大标题，与 DM Sans body 形成对比，
// 强化「编辑 / 出版物」气质，跳出 sans 后台的售货员感。
const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['600', '700', '900'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: '选题雷达 · 创作者选题情报站',
  description: 'AI 驱动的创作者选题推荐平台，帮你发现下一个爆款选题',
};

const CLIENT_NAV_FALLBACK: PrefetchData = {
  user: null,
  userResolved: false,
  featureFlags: {},
  featureFlagsResolved: false,
  counts: null,
  localMode: false,
  localModeResolved: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const isClientNavigation = requestHeaders.get('rsc') === '1';

  // 仅文档首屏需要 SSR 预取。软导航时根 Provider 已挂载，重复请求 auth/me、
  // feature flags 与三个计数既不会重新初始化 store，还会阻塞页面切换。
  const initialData = isClientNavigation
    ? CLIENT_NAV_FALLBACK
    : await prefetchInitialData();

  return (
    <html lang="zh-CN" className={`${dmSans.variable} ${dmMono.variable} ${notoSerif.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SkipToContent />
        <ClientLayout initialData={initialData}>{children}</ClientLayout>
      </body>
    </html>
  );
}
