'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, Panel } from '@/components/ui';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-full place-items-center bg-page p-6">
      <Panel className="w-full max-w-lg p-7 text-center">
        <AlertTriangle size={34} className="mx-auto text-red" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-black text-gray-900">当前页面加载失败</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {error.message || '页面遇到临时错误，应用导航仍可继续使用。'}
        </p>
        <Button type="button" variant="primary" onClick={reset} className="mt-5">
          <RotateCcw size={14} aria-hidden="true" />
          重新加载当前页面
        </Button>
      </Panel>
    </div>
  );
}
