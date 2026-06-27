'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Cloud, Upload, RefreshCw, LogOut } from 'lucide-react'
import { syncToCloud } from '@/lib/db/sync'
import { getLocalResources } from '@/lib/db/local-store'
import { toast } from 'sonner'

export default function ProfilePage() {
  const [syncing, setSyncing] = useState(false)
  const localCount = getLocalResources().length

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncToCloud()
      toast.success(`同步完成：${result.notes} 篇笔记，${result.collections} 个合集`)
    } catch (e: any) {
      toast.error(e.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch { /* ignore */ }
    toast.success('已退出登录')
    window.location.href = '/login'
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--skin-primary)' }}>个人中心</h1>

      {/* 云端同步 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="size-4 text-emerald-500" />
            云端同步
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            <p className="text-sm">已通过站点密码登录</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1">
                {syncing ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {syncing ? '同步中...' : `同步本地数据 (${localCount} 篇)`}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleSignOut} className="gap-1">
                <LogOut className="size-3.5" /> 退出登录
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 本地统计 */}
      <Card>
        <CardHeader><CardTitle className="text-base">本地数据</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>📝 笔记：{localCount} 篇</p>
          <p>📚 分类：默认5个 + 自定义</p>
          <p>💾 数据位置：浏览器 localStorage</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">关于秘密花园</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>版本：v1.0</p>
          <p>技术：Next.js + Tailwind + VPS PostgREST</p>
        </CardContent>
      </Card>
    </div>
  )
}
