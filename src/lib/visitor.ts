'use client'

export interface Visit {
  id: string
  time: string
  path: string
  lang: string
  tz: string
  screen: string
  fingerprint: string
}

const KEY = 'garden_visits'

// 生成简化的浏览器指纹
function fingerprint(): string {
  try {
    const parts = [
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen.width + 'x' + screen.height,
      navigator.hardwareConcurrency || '',
    ]
    return parts.join('|')
  } catch { return 'unknown' }
}

export function recordVisit() {
  if (typeof window === 'undefined') return
  try {
    const visits: Visit[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    visits.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      path: window.location.pathname,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: screen.width + 'x' + screen.height,
      fingerprint: fingerprint(),
    })
    if (visits.length > 1000) visits.splice(0, visits.length - 1000)
    localStorage.setItem(KEY, JSON.stringify(visits))
  } catch {}
}

export function getVisits(): Visit[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function clearVisits() { localStorage.removeItem(KEY) }

// 分析：检测可疑访问模式
export interface SuspiciousActivity {
  fingerprint: string
  lang: string
  tz: string
  count: number
  timeSpan: string // 起止时间
  paths: string[]
  score: number // 可疑分数
  reason: string
}

export function detectSuspicious(): SuspiciousActivity[] {
  const visits = getVisits()
  const now = Date.now()
  const results: SuspiciousActivity[] = []

  // 按指纹分组
  const byFingerprint = new Map<string, Visit[]>()
  for (const v of visits) {
    const list = byFingerprint.get(v.fingerprint) || []
    list.push(v)
    byFingerprint.set(v.fingerprint, list)
  }

  for (const [fp, list] of byFingerprint) {
    let score = 0
    const reasons: string[] = []
    const times = list.map(v => new Date(v.time).getTime())

    // 1分钟内超过 10 次访问 → 高可疑
    const recentCount = list.filter(v => now - new Date(v.time).getTime() < 60000).length
    if (recentCount > 10) { score += 50; reasons.push('高频访问(>10次/分钟)') }
    else if (recentCount > 5) { score += 20; reasons.push('较高频访问(>5次/分钟)') }

    // 同一页面反复刷新
    const uniquePaths = new Set(list.map(v => v.path)).size
    const duplicateRate = 1 - uniquePaths / list.length
    if (list.length > 20 && duplicateRate > 0.8) {
      score += 30; reasons.push('重复刷新同一页面')
    }

    // 短时间内大量不同页面（爬虫特征）
    if (list.length > 30 && uniquePaths > 15) {
      const firstTime = Math.min(...times)
      const lastTime = Math.max(...times)
      if (lastTime - firstTime < 120000) {
        score += 40; reasons.push('短时间内大量扫描(爬虫特征)')
      }
    }

    // 异常屏幕尺寸（可能是自动化工具）
    const screens = new Set(list.map(v => v.screen))
    if (screens.has('0x0') || screens.has('undefinedxundefined')) {
      score += 25; reasons.push('无头浏览器/自动化工具')
    }

    if (score >= 20) {
      results.push({
        fingerprint: fp,
        lang: list[0].lang,
        tz: list[0].tz,
        count: list.length,
        timeSpan: `${new Date(Math.min(...times)).toLocaleString('zh-CN')} ~ ${new Date(Math.max(...times)).toLocaleString('zh-CN')}`,
        paths: [...new Set(list.map(v => v.path))].slice(0, 5),
        score,
        reason: reasons.join('；'),
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

// 分析：访问统计
export interface VisitStats {
  totalVisits: number
  todayVisits: number
  uniqueVisitors: number
  avgVisitsPerDay: number
  topPages: { path: string; count: number }[]
  hourlyHeatmap: number[] // 24 小时分布
  deviceBreakdown: { mobile: number; desktop: number; unknown: number }
}

export function getStats(): VisitStats {
  const visits = getVisits()
  const today = new Date().toISOString().slice(0, 10)
  const todayVisits = visits.filter(v => v.time.startsWith(today))

  const uniqueFingerprints = new Set(visits.map(v => v.fingerprint)).size

  // 路径统计
  const pathCounts = new Map<string, number>()
  visits.forEach(v => pathCounts.set(v.path, (pathCounts.get(v.path) || 0) + 1))
  const topPages = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  // 24 小时分布
  const hourly = new Array(24).fill(0)
  visits.forEach(v => {
    const h = new Date(v.time).getHours()
    hourly[h]++
  })

  // 设备分布
  const device = { mobile: 0, desktop: 0, unknown: 0 }
  visits.forEach(v => {
    if (v.screen.includes('x')) {
      const [w] = v.screen.split('x').map(Number)
      if (w < 1024) device.mobile++
      else device.desktop++
    } else device.unknown++
  })

  // 平均每日访问
  const days = new Set(visits.map(v => v.time.slice(0, 10))).size || 1

  return {
    totalVisits: visits.length,
    todayVisits: todayVisits.length,
    uniqueVisitors: uniqueFingerprints,
    avgVisitsPerDay: Math.round(visits.length / days),
    topPages,
    hourlyHeatmap: hourly,
    deviceBreakdown: device,
  }
}
