'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Shared route-segment error boundary UI.
 *
 * Each route segment's `error.tsx` re-exports this with an optional `label`
 * so users see context about which section failed (e.g. "笔记加载失败").
 */
export default function RouteError({
  error,
  reset,
  label,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  label?: string;
}) {
  useEffect(() => {
    console.error(`[${label || 'Route'} error]:`, error?.message || error);
  }, [error, label]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="glass rounded-2xl p-8 shadow-3d mb-4">
        <AlertCircle className="size-12 text-destructive/80 mx-auto" />
      </div>
      <h1 className="text-2xl font-bold mb-2 animate-fade-in-up">
        {label ? `${label}出了点问题` : '出了点问题'}
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md animate-fade-in-up">
        页面加载出错，请刷新重试。如果问题持续存在，请联系管理员。
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} className="gap-2 glass shadow-3d btn-3d rounded-full px-6">
          <RefreshCw className="size-4" /> 重试
        </Button>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 rounded-full px-6')}
        >
          <Home className="size-4" /> 返回首页
        </Link>
      </div>
    </div>
  );
}
