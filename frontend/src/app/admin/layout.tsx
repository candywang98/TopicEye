'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { useAuthStore } from '@/providers/AppProvider';
import AdminSidebar from '@/components/AdminSidebar';
import AdminTopBar from '@/components/AdminTopBar';
import { Panel } from '@/components/ui';
import { useDialogFocus } from '@/components/useDialogFocus';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const authLoading = useAuthStore((state) => state.authLoading);
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = () => setMobileNavOpen(false);
  const { dialogRef, onKeyDown } = useDialogFocus<HTMLDivElement>(mobileNavOpen, closeMobileNav);

  useEffect(() => {
    if (!authLoading && !currentUser) router.replace('/login');
  }, [authLoading, currentUser, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // 加载中：显示骨架
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-page">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          正在加载管理后台
        </div>
      </div>
    );
  }

  // 未登录：effect 执行跳转，render 期间只显示过渡态
  if (!currentUser) {
    return (
      <div className="flex h-dvh items-center justify-center bg-page">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          跳转登录...
        </div>
      </div>
    );
  }

  // 非管理员：显示权限提示（Phase 4 替换为专属 403 页）
  if (currentUser.role !== 'admin') {
    return (
      <div className="flex h-dvh items-center justify-center bg-page p-6">
        <Panel className="max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <ShieldCheck size={24} className="text-amber-500" strokeWidth={2} />
          </div>
          <h2 className="mb-2 text-base font-bold text-gray-900">需要管理员权限</h2>
          <p className="mb-5 text-[13px] leading-6 text-gray-500">
            当前页面仅对管理员开放。如果你的账号需要管理权限，请联系系统管理员开通。
          </p>
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="rounded-sm border border-primary bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            返回首页
          </button>
        </Panel>
      </div>
    );
  }

  // 管理员：渲染 admin 专属壳
  return (
    <div className="flex h-dvh overflow-hidden">
      <AdminSidebar className="hidden lg:flex" />

      {mobileNavOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={closeMobileNav}
            aria-label="关闭管理导航"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="管理后台导航"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="relative h-full w-[220px] shadow-xl"
          >
            <button
              type="button"
              onClick={closeMobileNav}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="关闭管理导航"
              title="关闭管理导航"
            >
              <X size={17} />
            </button>
            <AdminSidebar className="h-full" onNavigate={closeMobileNav} />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-page">
        <AdminTopBar onOpenNavigation={() => setMobileNavOpen(true)} />
        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
