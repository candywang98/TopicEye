'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BrainCircuit,
  GitMerge,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MessageSquareWarning,
  Newspaper,
  RadioTower,
  Rocket,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '@/components/ui';
import { useAuthStore } from '@/providers/AppProvider';

interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

// admin 全量导航（含不在 NAV_SPACES 里的 /admin/contents、/admin/mother-topics）
const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'dashboard', label: '概览', href: '/admin', icon: LayoutDashboard },
  { id: 'monitor', label: '监控大盘', href: '/dashboard', icon: Activity },
  { id: 'sources', label: '信源管理', href: '/admin/sources', icon: RadioTower },
  { id: 'contents', label: '内容管理', href: '/admin/contents', icon: Newspaper },
  { id: 'content-events', label: '内容事件治理', href: '/admin/content-events', icon: GitMerge },
  { id: 'users', label: '用户管理', href: '/admin/users', icon: Users },
  { id: 'model-eval', label: 'AI 引擎', href: '/admin/model-eval', icon: BrainCircuit },
  { id: 'mother-topics', label: '系统母题模板库', href: '/admin/mother-topics', icon: BookOpen },
  { id: 'updates', label: '发版记录', href: '/admin/updates', icon: Rocket },
  { id: 'prompts', label: 'Prompt 管理', href: '/admin/prompts', icon: ScrollText },
  { id: 'scoring-dashboard', label: '评分看板', href: '/admin/scoring-dashboard', icon: BarChart3 },
  { id: 'evidence', label: '可信线索', href: '/admin/evidence', icon: ShieldCheck },
  { id: 'feedback', label: '反馈工作台', href: '/admin/feedback', icon: MessageSquareWarning },
  { id: 'webhook-logs', label: 'Webhook 日志', href: '/admin/webhook-logs', icon: Send },
  { id: 'settings', label: '系统设置', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.currentUser);
  const authLoading = useAuthStore((state) => state.authLoading);
  const localMode = useAuthStore((state) => state.localMode);
  const logout = useAuthStore((state) => state.logout);
  const [navigation, setNavigation] = React.useState<{ href: string; fromPath: string } | null>(null);
  const [, startNavigation] = React.useTransition();

  const pendingHref = navigation?.fromPath === pathname ? navigation.href : null;

  React.useEffect(() => {
    if (!pendingHref) return;
    const timeout = window.setTimeout(() => setNavigation(null), 30_000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  const navigate = (href: string) => {
    if (pendingHref) return;
    setNavigation({ href, fromPath: pathname });
    onNavigate?.();
    startNavigation(() => router.push(href));
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    if (logout) {
      void logout();
    }
  };

  return (
    <div className={cx('relative flex h-dvh w-[220px] shrink-0 select-none flex-col bg-slate-900 text-slate-300', className)}>
      {/* Brand */}
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500">
            <ShieldCheck size={16} className="text-slate-900" strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight text-white">
              管理后台
            </div>
            <div className="mt-px text-[10px] tracking-[0.08em] text-slate-500">
              ADMIN CONSOLE
            </div>
          </div>
        </div>
      </div>

      {/* Back to user side */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={Boolean(pendingHref)}
          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          返回用户侧
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const pending = pendingHref === item.href;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-busy={pending || undefined}
              disabled={Boolean(pendingHref) && !item.href.startsWith('/dashboard')}
              onClick={() => {
                if (item.href.startsWith('/dashboard')) {
                  window.open(item.href, '_blank');
                  onNavigate?.();
                } else if (!active) {
                  navigate(item.href);
                } else {
                  onNavigate?.();
                }
              }}
              className={cx(
                'mb-0.5 flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm transition',
                active
                  ? 'bg-amber-500/15 font-semibold text-amber-400'
                  : 'font-normal text-slate-400 hover:bg-slate-800 hover:text-white',
                pendingHref && !pending ? 'cursor-wait opacity-60' : '',
              )}
            >
              {pending ? (
                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom User Area */}
      <div className="border-t border-slate-800 px-3 pb-4 pt-3">
        {currentUser && (
          <div className="flex items-center justify-between gap-2 px-3">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-300">
                {currentUser.display_name || currentUser.email}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-500">
                <ShieldCheck size={10} strokeWidth={2.4} />
                {localMode ? '本地工作区' : '管理员'}
              </div>
            </div>
            {!localMode && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={authLoading}
                aria-label="退出登录"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-800 hover:text-red-400"
                title="退出登录"
              >
                <LogOut size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
