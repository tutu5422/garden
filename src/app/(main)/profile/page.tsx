'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Cloud, CloudOff, Upload, RefreshCw, LogIn } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { syncToCloud } from '@/lib/db/sync'
import { getLocalResources } from '@/lib/db/local-store'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { user, isLocal, signOut } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const localCount = getLocalResources().length

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncToCloud()
      toast.success(`同步完成：${result.notes} 篇笔记`)
    } catch (e: any) {
      toast.error(e.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--skin-primary)' }}>个人中心</h1>

      {/* 云端状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isLocal ? <CloudOff className="size-4 text-muted-foreground" /> : <Cloud className="size-4 text-emerald-500" />}
            云端同步
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLocal ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>⚙️ 尚未配置云端数据库</p>
              <ol className="list-decimal list-inside text-xs space-y-1">
                <li>在 <a href="https://supabase.com" target="_blank" className="text-primary hover:underline">supabase.com</a> 创建免费项目</li>
                <li>执行项目中的 supabase-schema.sql</li>
                <li>将 URL 和 Key 填入 .env.local</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              {user ? (
                <>
                  <p className="text-sm">✅ 已登录：<span className="text-muted-foreground">{user.email}</span></p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1">
                      {syncing ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      {syncing ? '同步中...' : `同步本地数据 (${localCount} 篇)`}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => signOut()}>
                      退出登录
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">登录后可将数据同步到云端</p>
                  <Link href="/login" className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg hover:opacity-90 transition-all" style={{ background: 'var(--skin-primary)' }}>
                    <LogIn className="size-3.5" /> 去登录
                  </Link>
                </div>
              )}
            </div>
          )}
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
          <p>技术：Next.js + Tailwind + Supabase</p>
        </CardContent>
      </Card>
    </div>
  )
}
