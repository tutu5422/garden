'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="glass rounded-2xl p-8 shadow-3d mb-4">
        <AlertCircle className="size-12 text-destructive/80 mx-auto" />
      </div>
      <h1 className="text-2xl font-bold mb-2 animate-fade-in-up">出了点问题</h1>
      <p className="text-muted-foreground mb-8 max-w-md animate-fade-in-up">
        页面加载出错，请刷新重试。如果问题持续存在，请联系管理员。
      </p>
      <Button onClick={reset} className="gap-2 glass shadow-3d btn-3d rounded-full px-6">
        <RefreshCw className="size-4" /> 重试
      </Button>
    </div>
  )
}
