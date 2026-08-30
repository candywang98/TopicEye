'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/providers/AppProvider';

// 路径 → 页面名映射（面包屑用）
const ADMIN_PAGE_LABELS: Record<string, string> = {
  '/admin': '概览',
  '/admin/sources': '信源管理',
  '/admin/contents': '内容管理',
  '/admin/content-events': '内容事件治理',
  '/admin/users': '用户管理',
  '/admin/model-eval': 'AI 引擎',
  '/admin/mother-topics': '系统母题模板库',
  '/admin/updates': '发版记录',
  '/admin/feedback': '反馈工作台',
  '/admin/settings': '系统设置',
};

function findPageLabel(pathname: string): string {
  // 精确匹配
  if (ADMIN_PAGE_LABELS[pathname]) return ADMIN_PAGE_LABELS[pathname];
  // 前缀匹配（子路径）
  const sorted = Object.keys(ADMIN_PAGE_LABELS).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(`${key}/`)) return ADMIN_PAGE_LABELS[key];
  }
  return '管理';
}

export default function AdminTopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const pathname = usePathname();
  const currentUser = useAuthStore((state) => state.currentUser);
  const pageLabel = findPageLabel(pathname);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenNavigation}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          aria-label="打开管理导航"
          title="打开管理导航"
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="管理后台面包屑">
          <span className="hidden font-bold text-amber-600 sm:inline">管理后台</span>
          <ChevronRight size={14} className="hidden shrink-0 text-gray-300 sm:block" strokeWidth={2.2} />
          <span className="truncate font-medium text-gray-700">{pageLabel}</span>
        </nav>
      </div>

      {/* Admin badge */}
      {currentUser && (
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-sm bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"
          title={currentUser.display_name || currentUser.email}
        >
          <ShieldCheck size={12} strokeWidth={2.4} />
          <span className="hidden max-w-40 truncate sm:inline">{currentUser.display_name || currentUser.email}</span>
        </div>
      )}
    </div>
  );
}
