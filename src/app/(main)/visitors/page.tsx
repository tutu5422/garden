'use client'

import { useState, useEffect } from 'react'
import { getVisits, clearVisits, detectSuspicious, getStats, type SuspiciousActivity, type VisitStats } from '@/lib/visitor'
import { Trash2, Eye, Clock, Monitor, Shield, AlertTriangle, BarChart3, Smartphone, RefreshCw } from 'lucide-react'

export default function VisitorsPage() {
  const [visits, setVisits] = useState<any[]>([])
  const [suspicious, setSuspicious] = useState<SuspiciousActivity[]>([])
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [tab, setTab] = useState<'overview' | 'list' | 'suspicious'>('overview')

  useEffect(() => {
    setVisits(getVisits().reverse())
    setSuspicious(detectSuspicious())
    setStats(getStats())
  }, [])

  const refresh = () => {
    setVisits(getVisits().reverse())
    setSuspicious(detectSuspicious())
    setStats(getStats())
  }

  const handleClear = () => {
    if (confirm('确定清空所有访问记录？')) { clearVisits(); setVisits([]); setSuspicious([]); setStats(null) }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--skin-primary)' }}>📊 访客分析</h1>
        <div className="flex gap-1">
          <button onClick={refresh} className="p-2 rounded-lg hover:bg-white/20 transition-colors" title="刷新">
            <RefreshCw className="size-3.5" />
          </button>
          <button onClick={handleClear} className="p-2 rounded-lg hover:bg-white/20 transition-colors text-muted-foreground hover:text-destructive" title="清空">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex gap-1 mb-4 glass rounded-lg p-1">
        {(['overview', 'list', 'suspicious'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-white/20'}`}>
            {t === 'overview' ? '概览' : t === 'list' ? '记录' : suspicious.length > 0 ? `⚠️ 可疑 (${suspicious.length})` : '安全'}
          </button>
        ))}
      </div>

      {/* 概览 */}
      {tab === 'overview' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Eye, label: '总访问', value: stats.totalVisits },
              { icon: Clock, label: '今日', value: stats.todayVisits },
              { icon: Monitor, label: '访客数', value: stats.uniqueVisitors },
              { icon: BarChart3, label: '日均', value: stats.avgVisitsPerDay },
            ].map((s, i) => (
              <div key={i} className="glass rounded-xl p-3 text-center">
                <s.icon className="size-4 mx-auto mb-1 text-primary" />
                <p className="text-base font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* 24 小时热力图 */}
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-medium mb-2">24小时访问分布</p>
            <div className="flex items-end gap-0.5 h-16">
              {stats.hourlyHeatmap.map((val, h) => {
                const max = Math.max(...stats.hourlyHeatmap, 1)
                const height = Math.max(4, (val / max) * 100)
                const color = val > max * 0.7 ? 'var(--skin-primary)' : val > max * 0.3 ? '#7ba0be' : '#AFC8DA'
                return (
                  <div key={h} className="flex-1 relative group" style={{ height: `${height}%`, background: color, borderRadius: '2px 2px 0 0' }}>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100">{h}时({val})</span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-5">
              <span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>23时</span>
            </div>
          </div>

          {/* 设备分布 */}
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-medium mb-2">设备分布</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <Smartphone className="size-3.5" /> {stats.deviceBreakdown.mobile}
                <span className="text-[10px] text-muted-foreground">手机</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Monitor className="size-3.5" /> {stats.deviceBreakdown.desktop}
                <span className="text-[10px] text-muted-foreground">桌面</span>
              </div>
            </div>
          </div>

          {/* 热门页面 */}
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-medium mb-2">热门页面 TOP 5</p>
            {stats.topPages.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1 text-sm">
                <span className="truncate">{p.path}</span>
                <span className="text-xs text-muted-foreground shrink-0">{p.count}次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 访问记录列表 */}
      {tab === 'list' && (
        visits.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">暂无记录</div>
        ) : (
          <div className="space-y-1">
            {visits.slice(0, 200).map((v, i) => (
              <div key={i} className="glass rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground shrink-0 w-14">{v.time.slice(11, 19)}</span>
                <span className="flex-1 truncate">{v.path}</span>
                <span className="text-muted-foreground shrink-0 w-16 truncate">{v.tz?.split('/').pop() || ''}</span>
                <span>{/Mobile|Android|iPhone/i.test(v.lang || '') ? '📱' : '💻'}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* 可疑活动 */}
      {tab === 'suspicious' && (
        suspicious.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="size-10 mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-medium">未检测到可疑活动</p>
            <p className="text-xs text-muted-foreground mt-1">访客行为正常</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suspicious.map((s, i) => (
              <div key={i} className="glass rounded-xl p-4 space-y-2"
                style={{ borderLeft: '3px solid', borderColor: s.score >= 50 ? '#dc2626' : s.score >= 30 ? '#f59e0b' : '#3b82f6' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`size-4 ${s.score >= 50 ? 'text-red-500' : s.score >= 30 ? 'text-amber-500' : 'text-blue-500'}`} />
                    <span className="text-sm font-medium">
                      {s.score >= 50 ? '🔴 高危' : s.score >= 30 ? '🟡 可疑' : '🔵 注意'}
                    </span>
                    <span className="text-xs text-muted-foreground">评分 {s.score}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.count} 次访问</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <p>🕐 {s.timeSpan}</p>
                  <p>🌐 语言: {s.lang} · 时区: {s.tz}</p>
                  <p>📄 {s.paths.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
