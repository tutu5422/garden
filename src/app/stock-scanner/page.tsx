'use client'

import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { Search, X } from 'lucide-react'

/* ================================================================
   Types
   ================================================================ */

interface StockScore {
  code: string; name: string; industry: string
  close: number; pe_ttm: number | null; pb: number | null
  // Adj state: 'qfq' = real front-adjusted price; 'hfq_degraded' = backend fell back to raw hfq
  close_adj?: 'qfq' | 'hfq_degraded'
  close_ratio?: number
  close_hfq?: number  // raw hfq close, for debugging
  high_5y?: number | null  // 5y high (qfq) — single source of truth, same as stock_daily
  div_yield: number; consecutive_div_years?: number
  roe: number | null; liability_ratio?: number
  price_pct: number; pe_pct: number; pb_pct: number
  drawdown: number
  price_score: number; pe_score: number; pb_score: number
  div_score?: number; roe_score?: number
  ind_score: number; dd_score: number; div_consist_score?: number
  penalty?: number; penalty_reasons?: string[]
  composite: number; signal: 'strong' | 'focus' | 'watch' | 'none'
  is_cyclical?: boolean; ipo_years?: number | null
}

interface ScoresMeta {
  type: string; date: string; count: number; filtered_count: number
  scores: StockScore[]; top10: StockScore[]; generated_at: string
  error?: string  // for API error responses
}

/* ================================================================
   Helpers
   ================================================================ */

const SIGNAL_MAP: Record<string, { label: string; color: string; bg: string }> = {
  strong: { label: '🔴 强烈', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  focus:  { label: '🟡 重点', color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  watch:  { label: '🟢 关注', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  none:   { label: '—',     color: '#6b7280', bg: 'rgba(107,114,128,0.05)' },
}

const INDUSTRIES = [
  '银行', '房地产', '白酒', '食品饮料', '医药', '半导体', '软件',
  '新能源', '煤炭', '钢铁', '建材', '建筑', '电力', '石油', '汽车',
  '家电', '保险', '证券', '军工', '通信', '农业', '化工', '有色',
]

// 证监会行业分类（baostock）→ 前端筛选词。后端存的是 "J66货币金融服务"、
// "C26化学原料和化学制品制造业" 这类官方名，前端筛选词是申万风格简称，
// 用关键词包含匹配做双向映射。
const INDUSTRY_MAP: Record<string, string[]> = {
  '银行': ['货币金融', 'J66', '银行'],
  '房地产': ['房地产', '房地产业', 'K70'],
  '白酒': ['酒、饮料', '酒', '白酒'],
  '食品饮料': ['食品', '饮料', '农副食品', '酒'],
  '医药': ['医药', '制药', '卫生', '生物'],
  '半导体': ['半导体', '电子设备', '电子元件', '计算机、通信和其他电子'],
  '软件': ['软件', '信息技术服务', '互联网和相关服务', '计算机'],
  '新能源': ['电气机械', '电池', '光伏', '风能', '太阳能', '电力设备'],
  '煤炭': ['煤炭', 'B06'],
  '钢铁': ['黑色金属', '钢铁', 'C31'],
  '建材': ['非金属矿物', '建材', '水泥', '玻璃', '陶瓷'],
  '建筑': ['土木工程', '建筑装饰', '建筑安装', '建筑业', 'E'],
  '电力': ['电力、热力', '电力', '燃气', '水的生产', 'D44', 'D45'],
  '石油': ['石油', '石化', '油气', '燃料加工', '开采辅助'],
  '汽车': ['汽车', 'C36'],
  '家电': ['电气机械', '日用电器', '家电'],
  '保险': ['保险', 'J68'],
  '证券': ['资本市场', '证券', 'J67'],
  '军工': ['国防', '军工', '航空航天', '铁路、船舶'],
  '通信': ['通信', '电信', '互联网'],
  '农业': ['农、林、牧、渔', '农业', '农副食品', '畜牧业', '渔业'],
  '化工': ['化学原料', '化学制品', '化学纤维', '化工', '橡胶', '塑料', 'C26', 'C28'],
  '有色': ['有色金属', 'C32'],
}

/** 证监会分类名是否属于前端筛选词 */
function matchIndustry(ind: string, filter: string): boolean {
  if (!ind) return false
  if (ind.includes(filter)) return true
  return (INDUSTRY_MAP[filter] || []).some(k => ind.includes(k))
}

/** 证监会分类名 → 可读的行业短名（行业大盘 Tab 用） */
function displayIndustry(ind: string): string {
  if (!ind) return '其他'
  for (const [name, keys] of Object.entries(INDUSTRY_MAP)) {
    if (keys.some(k => ind.includes(k))) return name
  }
  return ind.replace(/^[A-Z]\d+/, '').substring(0, 8) || '其他'
}

/* ================================================================
   Stock Card
   ================================================================ */

function StockCard({ s, onClick }: { s: StockScore; onClick: () => void }) {
  const sig = SIGNAL_MAP[s.signal] || SIGNAL_MAP.none
  const pe = s.pe_ttm ? s.pe_ttm.toFixed(1) : '—'
  const dd = s.drawdown.toFixed(0)
  const div = s.div_yield > 0 ? `${s.div_yield.toFixed(1)}%` : '—'
  const roe = s.roe ? `${s.roe.toFixed(0)}%` : '—'

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl p-4 border border-white/10 bg-white/5
                 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-white text-sm">{s.name}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <span>{s.code}</span>
            {s.close > 0 && <span className="text-gray-300 font-medium">¥{s.close.toFixed(2)}</span>}
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: sig.color, borderColor: sig.color, background: sig.bg }}>
          {s.composite.toFixed(0)}分
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">PE</span><span className="text-gray-300">{pe}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">股息</span><span className="text-amber-400">{div}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">ROE</span><span className="text-gray-300">{roe}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">跌幅</span><span className="text-red-400">{dd}%↓</span></div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5 text-xs text-gray-500 truncate flex items-center gap-1">
        {s.industry?.substring(0, 20) || '—'}
        {s.is_cyclical && <span className="text-[10px] px-1 rounded bg-amber-500/10 text-amber-400">周期</span>}
      </div>
    </div>
  )
}

/* ================================================================
   Detail Modal with ECharts
   ================================================================ */

function StockDetail({ s, onClose }: { s: StockScore; onClose: () => void }) {
  const [klineRaw, setKlineRaw] = useState<{data?: {d:string;c_qfq:number;c_hfq:number;pe:number|null;pb:number|null;div?:number}[], high_5y?:number} | null>(null)
  const [timeRange, setTimeRange] = useState<'1y' | '3y' | '5y' | '10y' | 'all'>('all')
  
  const kline = klineRaw?.data || (Array.isArray(klineRaw) ? klineRaw as any[] : null)
  
  useEffect(() => {
    fetch(`https://storage.minitu.online/storage/stock-klines/${s.code}.json`)
      .then(r => r.json())
      .then(data => setKlineRaw(data))
      .catch(() => setKlineRaw(null))
  }, [s.code])

  // Time range → dataZoom
  const zoomRange = useMemo(() => {
    if (!kline || kline.length === 0) return { start: 0, end: 100 }
    const total = kline.length
    const ranges: Record<string, [number, number]> = {
      '1y': [Math.max(0, ((total - 252) / total) * 100), 100],
      '3y': [Math.max(0, ((total - 756) / total) * 100), 100],
      '5y': [Math.max(0, ((total - 1260) / total) * 100), 100],
      '10y': [Math.max(0, ((total - 2520) / total) * 100), 100],
      'all': [0, 100],
    }
    const [s, e] = ranges[timeRange] || [0, 100]
    return { start: s, end: e }
  }, [kline, timeRange])

  // K-line chart option — with PE valuation zones + dividend markers + high-water mark
  const klineOption = useMemo(() => {
    if (!kline || kline.length === 0) return null
    const dates = kline.map(k => k.d)
    const closes = kline.map(k => k.c_qfq)
    const pes = kline.map(k => k.pe)
    const high5y = klineRaw?.high_5y
    
    // PE valuation zones
    const peZones = pes.length > 0 ? [
      [{ yAxis: 0, itemStyle: { color: 'rgba(34,197,94,0.06)' } }, { yAxis: 15 }],
      [{ yAxis: 15, itemStyle: { color: 'rgba(234,179,8,0.04)' } }, { yAxis: 30 }],
      [{ yAxis: 30, itemStyle: { color: 'rgba(239,68,68,0.06)' } }, { yAxis: 'max' }],
    ] : []
    
    // Dividend markers
    const divMarkers: any[] = []
    kline.forEach((k, i) => {
      if ((k as any).div && (k as any).div > 0) {
        divMarkers.push({
          name: '分红',
          coord: [dates[i], closes[i]],
          value: `¥${(k as any).div.toFixed(2)}`,
          symbol: 'pin',
          symbolSize: 18,
          itemStyle: { color: '#f59e0b' },
        })
      }
    })
    
    // Historical high water mark
    const highMark = high5y ? {
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: 'rgba(239,68,68,0.4)', type: 'dashed' as const, width: 1 },
        label: { show: true, position: 'end' as const, formatter: `历史高 ¥${high5y.toFixed(2)}`, fontSize: 9, color: '#ef4444' },
        data: [{ yAxis: high5y }],
      }
    } : {}
    
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['收盘价', 'PE'], bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
      grid: { left: 55, right: 55, top: 10, bottom: 35 },
      xAxis: { type: 'category' as const, data: dates, 
        axisLabel: { show: true, fontSize: 9, color: '#6b7280', formatter: (v:string) => v.slice(5) },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
      yAxis: [
        { type: 'value' as const, name: '价格', nameTextStyle: { color: '#6b7280', fontSize: 9 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
          axisLabel: { color: '#6b7280', fontSize: 9 } },
        { type: 'value' as const, name: 'PE', nameTextStyle: { color: '#eab308', fontSize: 9 },
          splitLine: { show: false },
          axisLabel: { color: '#eab308', fontSize: 9 } },
      ],
      series: [
        { name: '收盘价', type: 'line', data: closes, yAxisIndex: 0,
          lineStyle: { color: '#22c55e', width: 1.5 },
          areaStyle: { color: { type: 'linear', x:0,y:0,x2:0,y2:1,
            colorStops: [{offset:0,color:'rgba(34,197,94,0.15)'},{offset:1,color:'rgba(34,197,94,0)'}] } },
          showSymbol: false,
          ...highMark,
          ...(divMarkers.length > 0 ? { markPoint: { data: divMarkers, symbol: 'pin', symbolSize: 20, label: { show: false } } } : {}),
        },
        { name: 'PE', type: 'line', data: pes, yAxisIndex: 1,
          lineStyle: { color: '#eab308', width: 1 }, showSymbol: false,
          ...(peZones.length > 0 ? { markArea: { silent: true, data: peZones } } : {}),
        },
      ],
      dataZoom: [{ type: 'inside', ...zoomRange }],
    }
  }, [kline, klineRaw, zoomRange])
  
  // Position bar (simpler version when no kline data)
  // Use stock_daily.high_5y as the single source — no ad-hoc recompute.
  const high5y = s.high_5y
  const estimatedHigh = high5y && s.close ? high5y : null
  const positionPct = Math.max(0, Math.min(100, s.price_pct))
  
  const rangeOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { left: 60, right: 30, top: 10, bottom: 30 },
    xAxis: { type: 'value' as const, min: 0, max: 100, show: false },
    yAxis: { type: 'category' as const, data: [''], show: false },
    series: [
      { type: 'bar', data: [100], barWidth: 20, itemStyle: { color: 'rgba(255,255,255,0.08)', borderRadius: 10 }, z: 1 },
      { type: 'bar', data: [20], barWidth: 20, itemStyle: { color: 'rgba(34,197,94,0.15)', borderRadius: 0 }, z: 2, barGap: '-100%' },
      { type: 'scatter', data: [[positionPct, 0]], symbolSize: 16, itemStyle: { color: positionPct < 20 ? '#22c55e' : positionPct < 50 ? '#eab308' : '#ef4444' }, z: 3 },
    ],
  }), [positionPct])

  const scoreItems = [
    { label: '价格分位', score: s.price_score, max: 20, detail: `${s.price_pct.toFixed(0)}%分位` },
    { label: 'PE分位', score: s.pe_score, max: 15, detail: s.pe_ttm && s.pe_ttm > 0 ? `PE ${s.pe_ttm.toFixed(1)}` : '' },
    { label: '股息率', score: s.div_score || 0, max: 15, detail: s.div_yield > 0 ? `${s.div_yield.toFixed(1)}%×${s.consecutive_div_years || 0}年` : '无分红' },
    { label: 'ROE', score: s.roe_score || 0, max: 10, detail: s.roe ? `${s.roe.toFixed(0)}%` : '—' },
    { label: '行业PE', score: s.ind_score, max: 15, detail: '' },
    { label: 'PB分位', score: s.pb_score, max: 10, detail: `${s.pb_pct.toFixed(0)}%分位` },
    { label: '距高跌幅', score: s.dd_score, max: 10, detail: `跌${s.drawdown.toFixed(0)}%` },
    { label: '分红连续', score: s.div_consist_score || 0, max: 5, detail: s.consecutive_div_years ? `${s.consecutive_div_years}年` : '' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-gray-900 p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — compact */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-white">{s.name} <span className="text-xs text-gray-500 font-normal">{s.code}</span></h2>
            <p className="text-xs text-gray-500">{s.industry}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">{s.composite.toFixed(0)}分</span>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="size-4" /></button>
          </div>
        </div>

        {/* Key metrics — one compact row */}
        <div className="grid grid-cols-8 gap-1.5 mb-3">
          {(() => {
            const isQfq = s.close_adj === 'qfq'
            return [
              { label: isQfq ? '价格(前复权)' : '价格(后复权·参考)', value: s.close?.toFixed(2), warn: !isQfq },
              { label: 'PE', value: s.pe_ttm?.toFixed(1) || '—' },
              { label: 'PB', value: s.pb?.toFixed(2) || '—' },
              { label: '股息', value: s.div_yield > 0 ? `${s.div_yield.toFixed(1)}%` : '—' },
              { label: 'ROE', value: s.roe ? `${s.roe.toFixed(0)}%` : '—' },
              { label: '负债', value: s.liability_ratio ? `${s.liability_ratio}%` : '—' },
              { label: '分红', value: s.consecutive_div_years ? `${s.consecutive_div_years}年` : '—' },
              { label: '跌幅', value: `${s.drawdown.toFixed(0)}%↓` },
            ]
          })().map((m, i) => (
            <div key={i} className={`text-center p-1.5 rounded-lg border ${m.warn ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-white/5'}`}>
              <div className={`text-[10px] leading-tight ${m.warn ? 'text-amber-400' : 'text-gray-500'}`}>{m.label}</div>
              <div className={`text-xs font-bold leading-tight mt-0.5 ${m.warn ? 'text-amber-300' : 'text-white'}`}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* K-line chart */}
        <div className="mb-3 rounded-xl border border-white/5 bg-white/5 p-3">
          {klineOption ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500">
                  📈 {s.name} 走势 + PE{' '}
                  {s.close_adj === 'qfq' ? (
                    <span className="text-amber-400/70">(前复权)</span>
                  ) : (
                    <span className="text-red-400/80">(后复权·无 qfq 数据)</span>
                  )}
                </span>
                <div className="flex items-center gap-0.5">
                  {(['1y','3y','5y','10y','all'] as const).map(r => (
                    <button key={r} onClick={() => setTimeRange(r)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                        timeRange === r ? 'bg-amber-500/20 text-amber-400' : 'text-gray-600 hover:text-gray-400'
                      }`}>
                      {r === 'all' ? '全部' : r}
                    </button>
                  ))}
                  {klineRaw?.high_5y && (
                    <span className={`text-[10px] ml-1 ${s.close_adj === 'qfq' ? 'text-red-400/60' : 'text-red-400/80'}`}>
                      高¥{klineRaw.high_5y.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <ReactECharts option={klineOption} style={{ height: 200 }} />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500">
                  📊 5年价格区间{' '}
                  {s.close_adj === 'qfq' ? (
                    <span className="text-amber-400/70">(前复权)</span>
                  ) : (
                    <span className="text-red-400/80">(后复权·无 qfq 数据)</span>
                  )}
                </span>
                {estimatedHigh && (
                  <span className="text-[10px] text-gray-600">
                    高 ¥{estimatedHigh.toFixed(2)} · 现 ¥{s.close.toFixed(2)} · {s.price_pct.toFixed(0)}%分位
                  </span>
                )}
              </div>
              {estimatedHigh ? (
                <>
                  <ReactECharts option={rangeOption} style={{ height: 50 }} />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                    <span>0% (最低)</span>
                    <span className={s.price_pct < 20 ? 'text-green-400' : 'text-gray-500'}>{s.price_pct < 20 ? '🟢 低位区' : ''}</span>
                    <span>100% (最高)</span>
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-gray-600 py-3 text-center">无 5y 高点数据</div>
              )}
            </>
          )}
        </div>

        {/* Score breakdown — compact 2-column */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 mb-2">📊 评分明细</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {scoreItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-16 flex-shrink-0">{item.label}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(item.score / item.max) * 100}%`, background: 'linear-gradient(90deg, #22c55e, #eab308)' }} />
                </div>
                <span className="text-[10px] text-gray-400 w-10 text-right flex-shrink-0">{item.score.toFixed(1)}</span>
                <span className="text-[10px] text-gray-600 w-14 truncate flex-shrink-0">{item.detail}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs">
            <span className="text-gray-400">综合</span>
            <span className="font-bold text-amber-400">{s.composite.toFixed(0)} / 100</span>
          </div>
          {(s.penalty && s.penalty > 0) && (
            <div className="mt-1 text-[10px] text-red-400">
              ⚠️ 扣分 {s.penalty}分: {s.penalty_reasons?.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   Main Page
   ================================================================ */

export default function StockScannerPage() {
  const [scores, setScores] = useState<StockScore[]>([])
  const [meta, setMeta] = useState<ScoresMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<StockScore | null>(null)
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [minScore, setMinScore] = useState(55)
  const [tab, setTab] = useState<'scanner' | 'industry'>('scanner')

  useEffect(() => {
    fetch('/api/stock/scores')
      .then(r => r.json())
      .then((data: ScoresMeta) => {
        if (data.error) { setError(data.error as string); return }
        setScores(data.scores || [])
        setMeta(data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = scores
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => s.name.includes(q) || s.code.includes(q))
    }
    if (industryFilter) {
      list = list.filter(s => matchIndustry(s.industry || '', industryFilter))
    }
    list = list.filter(s => s.composite >= minScore)
    return list.sort((a, b) => b.composite - a.composite)
  }, [scores, search, industryFilter, minScore])

  const counts = useMemo(() => ({
    strong: scores.filter(s => s.signal === 'strong').length,
    focus: scores.filter(s => s.signal === 'focus').length,
    watch: scores.filter(s => s.signal === 'watch').length,
  }), [scores])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 animate-pulse">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-red-400">加载失败: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">📊 A股低位扫描</h1>
          <p className="text-sm text-gray-500">
            数据更新: {meta?.date || '—'} · 覆盖 {meta?.count || scores.length} 只 ·
            过滤 {meta?.filtered_count || '—'} 只 · 中证800 ·{' '}
            {(() => {
              const degraded = scores.filter(x => x.close_adj === 'hfq_degraded').length
              if (degraded === 0) {
                return <span className="text-amber-400/80">价格均为前复权</span>
              }
              return (
                <span className="text-amber-400/80">
                  前复权 · <span className="text-red-400/80">{degraded} 只为后复权(参考)</span>
                </span>
              )
            })()}
          </p>
        </div>

        {/* Signal cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: '🔴 强烈', count: counts.strong, color: '#ef4444' },
            { label: '🟡 重点', count: counts.focus, color: '#eab308' },
            { label: '🟢 关注', count: counts.watch, color: '#22c55e' },
            { label: '📋 总计', count: scores.length, color: '#6b7280' },
          ].map((c, i) => (
            <div key={i} className="text-center p-3 rounded-xl border border-white/5 bg-white/5">
              <div className="text-xs text-gray-500">{c.label}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.count}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
          {[
            { id: 'scanner' as const, label: '🏷️ 市场扫描' },
            { id: 'industry' as const, label: '📈 行业大盘' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                tab === t.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'scanner' ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索股票代码或名称..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white
                             placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                />
              </div>
              <select
                value={industryFilter}
                onChange={e => setIndustryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-gray-300
                           focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
              >
                <option value="">全部行业</option>
                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
              <select
                value={minScore}
                onChange={e => setMinScore(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-gray-300
                           focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
              >
                <option value={0}>全部分数</option>
                <option value={70}>≥70分 (关注+)</option>
                <option value={55}>≥55分 (所有)</option>
              </select>
            </div>

            {/* Stock grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-600">无匹配结果</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filtered.map(s => (
                  <StockCard key={s.code} s={s} onClick={() => setSelected(s)} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Industry Overview Tab */
          <IndustryOverview scores={scores} />
        )}

        {/* Detail Modal */}
        {selected && <StockDetail s={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}

/* ================================================================
   Industry Overview
   ================================================================ */

function IndustryOverview({ scores }: { scores: StockScore[] }) {
  const industries = useMemo(() => {
    const map: Record<string, { pe_values: number[]; pb_values: number[]; count: number }> = {}
    for (const s of scores) {
      const ind = displayIndustry(s.industry || '') || '其他'
      if (!map[ind]) map[ind] = { pe_values: [], pb_values: [], count: 0 }
      if (s.pe_ttm && s.pe_ttm > 0) map[ind].pe_values.push(s.pe_ttm)
      if (s.pb && s.pb > 0) map[ind].pb_values.push(s.pb)
      map[ind].count++
    }
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        count: data.count,
        pe_median: data.pe_values.length ? median(data.pe_values) : 0,
        pb_median: data.pb_values.length ? median(data.pb_values) : 0,
      }))
      .sort((a, b) => a.pe_median - b.pe_median)
  }, [scores])

  const maxPE = Math.max(...industries.map(i => i.pe_median), 1)

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 mb-3">
        行业PE中位数排序（基于中证800成分股）· 仅作相对参考
      </div>
      {industries.map(ind => (
        <div key={ind.name} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-sm text-gray-300 w-20 truncate">{ind.name}</span>
          <span className="text-xs text-gray-600 w-10">{ind.count}只</span>
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (ind.pe_median / maxPE) * 100)}%`,
                background: ind.pe_median < 15 ? 'linear-gradient(90deg, #22c55e, #eab308)' :
                            ind.pe_median < 30 ? 'linear-gradient(90deg, #eab308, #f97316)' :
                            'linear-gradient(90deg, #f97316, #ef4444)'
              }}
            />
          </div>
          <span className="text-xs text-gray-400 w-16 text-right">PE {ind.pe_median.toFixed(1)}</span>
          <span className="text-xs text-gray-600 w-16 text-right">PB {ind.pb_median.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
