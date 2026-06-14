'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useMusic } from '@/lib/music/MusicContext'
import { getLyrics, searchAndCacheLyrics, parseLRC, type LRCLine } from '@/lib/music/lyrics-store'

interface LyricsMarqueeProps {
  className?: string
}

export default function LyricsMarquee({ className }: LyricsMarqueeProps) {
  const ctx = useMusic()
  const [displayText, setDisplayText] = useState('')
  const [hasLyrics, setHasLyrics] = useState(false)
  const [marqueeDuration, setMarqueeDuration] = useState(12)
  const [currentLineIdx, setCurrentLineIdx] = useState(-1)
  const [lrcLines, setLrcLines] = useState<LRCLine[]>([])
  const [selfSynced, setSelfSynced] = useState(false)
  const lastTrackId = useRef<string | null>(null)
  const lastVersion = useRef<number>(0)
  const searchSeqRef = useRef(0)
  const selfSyncedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)

  const track = ctx?.currentTrack
  const playing = ctx?.playing
  const playlist = ctx?.playlist
  const currentTime = ctx?.currentTime ?? 0
  const songDuration = ctx?.duration ?? 0
  const lyricsVersion = ctx?.lyricsVersion ?? 0
  const updateTrackLyrics = ctx?.updateTrackLyrics

  useEffect(() => { setMounted(true) }, [])

  // 将纯文本歌词转为均匀分布的伪 LRC 行
  const makePseudoLrc = (text: string): { lines: LRCLine[]; timer: boolean } => {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length === 0) return { lines: [], timer: false }
    if (songDuration > 0) {
      const interval = songDuration / lines.length
      return {
        lines: lines.map((t, i) => ({ time: i * interval, text: t })),
        timer: false,
      }
    }
    // 时长未知 — 每行 4 秒定时推进
    return {
      lines: lines.map((t, i) => ({ time: i * 4, text: t })),
      timer: true,
    }
  }

  // 加载歌词
  useEffect(() => {
    if (!mounted) return
    if (!track || !playing) {
      setDisplayText('')
      setHasLyrics(false)
      setLrcLines([])
      setCurrentLineIdx(-1)
      setSelfSynced(false)
      return
    }

    const sameTrack = lastTrackId.current === track.id
    const versionChanged = lyricsVersion !== lastVersion.current
    lastVersion.current = lyricsVersion

    if (sameTrack && !versionChanged && displayText) return
    lastTrackId.current = track.id

    const cached = getLyrics(track.id)

    // 有歌词且未隐藏 → 显示歌词
    if (cached?.lyrics && !cached?.hidden) {
      setHasLyrics(true)
      setDisplayText('')

      if (cached.syncedLyrics) {
        setLrcLines(parseLRC(cached.syncedLyrics))
        setCurrentLineIdx(-1)
        setSelfSynced(false)
      } else {
        const { lines, timer } = makePseudoLrc(cached.lyrics)
        setLrcLines(lines)
        setCurrentLineIdx(timer ? 0 : -1)
        setSelfSynced(timer)
      }
      return
    }

    // 歌词已隐藏 / 无歌词 → 显示歌名 + 歌手
    if (cached?.hidden) {
      const info = [track.title, track.artist].filter(Boolean).join(' — ')
      setDisplayText(info)
      setHasLyrics(false)
      setLrcLines([])
      setSelfSynced(false)
      return
    }

    const info = [track.title, track.artist, track.album].filter(Boolean).join(' — ')
    setDisplayText(info)
    setHasLyrics(false)
    setLrcLines([])
    setSelfSynced(false)

    // 自动搜索歌词
    const seq = ++searchSeqRef.current
    searchAndCacheLyrics(track.id, track.title, track.artist).then(result => {
      if (seq !== searchSeqRef.current) return
      if (result?.lyrics && !result?.hidden) {
        setHasLyrics(true)
        setDisplayText('')
        if (result.syncedLyrics) {
          setLrcLines(parseLRC(result.syncedLyrics))
          setCurrentLineIdx(-1)
          setSelfSynced(false)
        } else {
          const { lines, timer } = makePseudoLrc(result.lyrics)
          setLrcLines(lines)
          setCurrentLineIdx(timer ? 0 : -1)
          setSelfSynced(timer)
        }
        // 同步歌词到云端
        updateTrackLyrics?.(track.id, {
          lyrics: result.lyrics,
          syncedLyrics: result.syncedLyrics,
          lyricsSource: result.source,
          lyricsHidden: result.hidden || false,
        })
        }
    })
  }, [track?.id, playing, mounted, lyricsVersion])

  // 真实 LRC — 按音频时间同步
  useEffect(() => {
    if (!playing || lrcLines.length === 0 || selfSynced) return
    setCurrentLineIdx(findCurrentLine(lrcLines, currentTime))
  }, [currentTime, playing, lrcLines, selfSynced])

  // 纯文本歌词 — 定时推进（4s/行）
  useEffect(() => {
    if (!playing || !selfSynced || lrcLines.length === 0) return
    if (selfSyncedTimer.current) clearInterval(selfSyncedTimer.current)
    selfSyncedTimer.current = setInterval(() => {
      setCurrentLineIdx(prev => {
        if (prev + 1 < lrcLines.length) return prev + 1
        return prev
      })
    }, 4000)
    return () => {
      if (selfSyncedTimer.current) { clearInterval(selfSyncedTimer.current); selfSyncedTimer.current = null }
    }
  }, [playing, selfSynced, lrcLines.length])

  // 跑马灯时长计算
  useEffect(() => {
    if (!displayText || lrcLines.length > 0) return
    const t = setTimeout(() => {
      if (!textRef.current) return
      const w = textRef.current.scrollWidth
      const single = w / 2
      const speed = hasLyrics ? 50 : 80
      setMarqueeDuration(Math.max(8, single / speed))
    }, 100)
    return () => clearTimeout(t)
  }, [displayText, hasLyrics, lrcLines])

  const rootCls = cn('hidden md:flex items-center mx-3 min-w-0 self-stretch', className)

  if (!mounted) return <div className={rootCls} />

  // 空播放列表
  if ((!playlist || playlist.length === 0) && !displayText) {
    return (
      <div className={cn(rootCls, 'justify-end')}>
        <span className="text-xs whitespace-nowrap font-medium select-none text-right"
              style={{ color: 'var(--skin-text-secondary)', opacity: 0.35 }}>
          🎵 上传音乐，播放时歌词将在此滚动
        </span>
      </div>
    )
  }

  // ==================== LRC 逐行显示（统一模式） ====================
  if (lrcLines.length > 0) {
    const idx = currentLineIdx >= 0 ? currentLineIdx : 0
    const cur = lrcLines[idx]
    const next = idx + 1 < lrcLines.length ? lrcLines[idx + 1] : null

    return (
      <div className={cn(rootCls, 'justify-end')}>
        <div className="flex flex-col justify-center w-full overflow-hidden items-end gap-1">
          {cur && (
            <span
              key={`cur-${idx}`}
              className="text-sm font-bold whitespace-nowrap truncate lyrics-line-enter text-right"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--skin-primary)',
                letterSpacing: '0.04em',
              }}
            >
              {cur.text}
            </span>
          )}
          {next && (
            <span
              key={`next-${idx}`}
              className="text-[11px] whitespace-nowrap truncate lyrics-line-next text-right"
              style={{
                color: 'var(--skin-text-secondary)',
                opacity: 0.3,
              }}
            >
              {next.text}
            </span>
          )}
        </div>
      </div>
    )
  }

  // 未播放 / 无内容
  if (!displayText || !playing) {
    return (
      <div className={cn(rootCls, 'justify-end')}>
        {playlist && playlist.length > 0 && (
          <span className="text-xs whitespace-nowrap font-medium select-none text-right"
                style={{ color: 'var(--skin-text-secondary)', opacity: 0.25 }}>
            {playlist.length} 首歌曲就绪 · 点击右下角播放
          </span>
        )}
      </div>
    )
  }

  // ==================== 跑马灯（无歌词时显示歌名） ====================
  return (
    <div className={cn(rootCls, 'overflow-hidden relative justify-end')}>
      <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to right, var(--skin-surface), transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to left, var(--skin-surface), transparent)' }} />
      <div className="marquee-track w-full text-right">
        <span ref={textRef}
              className="marquee-text leading-none marquee-title"
              style={{
                color: 'var(--skin-primary)',
                animationName: 'marquee-scroll',
                animationDuration: `${marqueeDuration}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}>
          {displayText}&nbsp;&nbsp;&nbsp;{displayText}
        </span>
      </div>
    </div>
  )
}

function findCurrentLine(lines: LRCLine[], currentTime: number): number {
  let lo = 0, hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= currentTime) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(0, hi)
}
