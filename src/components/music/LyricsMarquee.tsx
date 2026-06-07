'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useMusic } from '@/lib/music/MusicContext'
import { getLyrics, searchAndCacheLyrics, refreshLyrics, parseLRC, type LRCLine } from '@/lib/music/lyrics-store'

export default function LyricsMarquee() {
  const ctx = useMusic()
  const [displayText, setDisplayText] = useState('')
  const [hasLyrics, setHasLyrics] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [duration, setDuration] = useState(12)
  const [currentLineIdx, setCurrentLineIdx] = useState(-1)
  const [lrcLines, setLrcLines] = useState<LRCLine[]>([])
  const lastTrackId = useRef<string | null>(null)
  const searchSeqRef = useRef(0)
  const textRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)

  const track = ctx?.currentTrack
  const playing = ctx?.playing
  const playlist = ctx?.playlist
  const currentTime = ctx?.currentTime ?? 0

  useEffect(() => { setMounted(true) }, [])

  // ── marquee 动画时长计算（仅 plain lyrics 模式）──
  const updateDuration = useCallback(() => {
    if (!textRef.current) return
    const w = textRef.current.scrollWidth
    const single = w / 2
    const speed = hasLyrics ? 50 : 80
    const sec = Math.max(8, single / speed)
    setDuration(sec)
  }, [hasLyrics])

  // ── 歌词加载 ──
  useEffect(() => {
    if (!mounted) return
    if (!track || !playing) {
      setDisplayText('')
      setHasLyrics(false)
      setLrcLines([])
      setCurrentLineIdx(-1)
      return
    }

    if (lastTrackId.current === track.id && displayText) return
    lastTrackId.current = track.id

    // 先查缓存
    const cached = getLyrics(track.id)
    if (cached?.lyrics) {
      const plain = cached.lyrics
        .split('\n')
        .filter(l => l.trim())
        .join('  ♪  ')
      setDisplayText(plain)
      setHasLyrics(true)

      // 尝试解析 LRC 同步歌词
      if (cached.syncedLyrics) {
        const lines = parseLRC(cached.syncedLyrics)
        setLrcLines(lines)
        setCurrentLineIdx(-1)
      } else {
        setLrcLines([])
      }
      return
    }

    // 无缓存 → 显示歌曲信息 + 后台搜索
    const info = [track.title, track.artist, track.album].filter(Boolean).join(' — ')
    setDisplayText(info)
    setHasLyrics(false)
    setLrcLines([])

    const seq = ++searchSeqRef.current
    searchAndCacheLyrics(track.id, track.title, track.artist).then(result => {
      if (seq !== searchSeqRef.current) return
      if (result?.lyrics) {
        const plain = result.lyrics
          .split('\n')
          .filter(l => l.trim())
          .join('  ♪  ')
        setDisplayText(plain)
        setHasLyrics(true)

        if (result.syncedLyrics) {
          const lines = parseLRC(result.syncedLyrics)
          setLrcLines(lines)
        }
      }
    })
  }, [track?.id, playing, mounted])

  // ── LRC 时间同步：根据 currentTime 找当前行 ──
  useEffect(() => {
    if (!playing || lrcLines.length === 0) return
    const i = findCurrentLine(lrcLines, currentTime)
    setCurrentLineIdx(i)
  }, [currentTime, playing, lrcLines])

  // ── marquee 时长更新 ──
  useEffect(() => {
    if (!displayText || lrcLines.length > 0) return
    const t = setTimeout(updateDuration, 100)
    return () => clearTimeout(t)
  }, [displayText, updateDuration, lrcLines])

  // ── 刷新歌词 ──
  const handleRefresh = useCallback(async () => {
    if (!track || isRefreshing) return
    setIsRefreshing(true)
    const oldLyrics = getLyrics(track.id)
    try {
      const result = await refreshLyrics(track.id, track.title, track.artist)
      if (result?.lyrics) {
        const plain = result.lyrics
          .split('\n')
          .filter(l => l.trim())
          .join('  ♪  ')
        setDisplayText(plain)
        setHasLyrics(true)
        if (result.syncedLyrics) {
          setLrcLines(parseLRC(result.syncedLyrics))
          setCurrentLineIdx(-1)
        } else {
          setLrcLines([])
        }
        if (oldLyrics?.lyrics === result.lyrics) {
          toast.info('歌词未变化 — 在播放器面板可手动修改搜索词')
        } else {
          toast.success('歌词已刷新')
        }
      } else {
        toast.info('未找到歌词，试试在播放器面板修改搜索词')
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [track, isRefreshing])

  // ── 渲染 ──

  // SSR 占位
  if (!mounted) {
    return <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 overflow-hidden relative self-stretch" />
  }

  // 无播放列表
  if ((!playlist || playlist.length === 0) && !displayText) {
    return (
      <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 self-stretch">
        <span className="text-xs whitespace-nowrap font-medium select-none"
              style={{ color: 'var(--skin-text-secondary)', opacity: 0.35 }}>
          🎵 上传音乐，播放时歌词将在此滚动
        </span>
      </div>
    )
  }

  // 有播放列表但未播放
  if (!displayText || !playing) {
    return (
      <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 self-stretch">
        {playlist && playlist.length > 0 && (
          <span className="text-xs whitespace-nowrap font-medium select-none"
                style={{ color: 'var(--skin-text-secondary)', opacity: 0.25 }}>
            {playlist.length} 首歌曲就绪 · 点击右下角播放
          </span>
        )}
      </div>
    )
  }

  // ── 模式选择 ──

  // A. 有 LRC 同步歌词 → 逐行显示
  if (lrcLines.length > 0) {
    // 找当前行 + 下一行预览
    const cur = lrcLines[currentLineIdx >= 0 ? currentLineIdx : 0]
    const next = currentLineIdx >= 0 && currentLineIdx + 1 < lrcLines.length
      ? lrcLines[currentLineIdx + 1]
      : null

    return (
      <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 self-stretch">
        <div className="flex flex-col justify-center w-full overflow-hidden">
          {cur && (
            <span
              className="text-sm font-bold whitespace-nowrap truncate transition-all duration-300"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--skin-primary)',
                letterSpacing: '0.03em',
              }}
            >
              {cur.text}
            </span>
          )}
          {next && (
            <span
              className="text-[11px] whitespace-nowrap truncate mt-0.5 transition-all duration-300"
              style={{
                color: 'var(--skin-text-secondary)',
                opacity: 0.35,
              }}
            >
              {next.text}
            </span>
          )}
        </div>
        {/* 刷新按钮 */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-2 p-1 transition-all shrink-0 hover:scale-110 active:scale-95 hover:text-[var(--skin-primary)]"
          style={{ color: 'var(--skin-text-secondary)', opacity: 0.45 }}
          title="重新搜索歌词"
        >
          <RefreshCw className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  // B. 纯文本歌词 → 滚动跑马灯
  return (
    <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 overflow-hidden relative self-stretch group/marquee">
      {/* 渐变遮罩 */}
      <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to right, var(--skin-surface), transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to left, var(--skin-surface), transparent)' }} />

      <div className="marquee-track w-full">
        <span
          ref={textRef}
          className={`marquee-text leading-none ${hasLyrics ? 'marquee-lyrics' : 'marquee-title'}`}
          style={{
            color: hasLyrics ? 'var(--skin-text-secondary)' : 'var(--skin-primary)',
            animationName: 'marquee-scroll',
            animationDuration: `${duration}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
          }}
        >
          {displayText}&nbsp;&nbsp;&nbsp;{displayText}
        </span>
      </div>

      {/* 刷新按钮（hasLyrics 时显示） */}
      {hasLyrics && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="absolute right-9 top-1/2 -translate-y-1/2 p-1 z-20 transition-all opacity-0 group-hover/marquee:opacity-100 hover:scale-110 active:scale-95 hover:text-[var(--skin-primary)]"
          style={{ color: 'var(--skin-text-secondary)', background: 'var(--skin-surface)', borderRadius: '4px' }}
          title="重新搜索歌词"
        >
          <RefreshCw className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  )
}

// 二分查找当前播放时间对应的歌词行
function findCurrentLine(lines: LRCLine[], currentTime: number): number {
  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= currentTime) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return Math.max(0, hi)
}
