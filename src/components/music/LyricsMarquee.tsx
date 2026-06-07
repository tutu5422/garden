'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useMusic } from '@/lib/music/MusicContext'
import { getLyrics, searchAndCacheLyrics } from '@/lib/music/lyrics-store'

export default function LyricsMarquee() {
  const ctx = useMusic()
  const [displayText, setDisplayText] = useState('')
  const [hasLyrics, setHasLyrics] = useState(false)
  const [duration, setDuration] = useState(12)
  const lastTrackId = useRef<string | null>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)

  const track = ctx?.currentTrack
  const playing = ctx?.playing
  const playlist = ctx?.playlist

  // 标记客户端挂载完成
  useEffect(() => { setMounted(true) }, [])

  const updateDuration = useCallback(() => {
    if (!textRef.current) return
    const w = textRef.current.scrollWidth
    // scrollWidth 包含两个副本，除以 2 得到单份宽度
    const single = w / 2
    const speed = hasLyrics ? 50 : 80
    const sec = Math.max(8, single / speed)
    setDuration(sec)
  }, [hasLyrics])

  // 同步歌词/标题到跑马灯
  useEffect(() => {
    if (!mounted) return
    if (!track || !playing) {
      setDisplayText('')
      setHasLyrics(false)
      return
    }

    if (lastTrackId.current === track.id && displayText) return
    lastTrackId.current = track.id

    // 先查缓存
    const cached = getLyrics(track.id)
    if (cached?.lyrics) {
      const text = cached.lyrics
        .split('\n')
        .filter(l => l.trim())
        .join('  ♪  ')
      setDisplayText(text)
      setHasLyrics(true)
      return
    }

    // 占位：显示歌曲信息
    const info = [track.title, track.artist, track.album].filter(Boolean).join(' — ')
    setDisplayText(info)
    setHasLyrics(false)

    // 后台搜索歌词
    searchAndCacheLyrics(track.id, track.title).then(result => {
      if (result?.lyrics) {
        const text = result.lyrics
          .split('\n')
          .filter(l => l.trim())
          .join('  ♪  ')
        setDisplayText(text)
        setHasLyrics(true)
      }
    })
  }, [track?.id, playing, mounted])

  // 文字更新后重新计算动画时长
  useEffect(() => {
    if (!displayText) return
    const t = setTimeout(updateDuration, 100)
    return () => clearTimeout(t)
  }, [displayText, updateDuration])

  if (!mounted) {
    // SSR / 首次渲染：占位 div 避免 hydration 结构差异
    return <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 overflow-hidden relative self-stretch" />
  }

  // 没有播放列表 → 提示
  if ((!playlist || playlist.length === 0) && !displayText) {
    return (
      <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 self-stretch">
        <span
          className="text-xs whitespace-nowrap font-medium select-none"
          style={{ color: 'var(--skin-text-secondary)', opacity: 0.35 }}
        >
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
          <span
            className="text-xs whitespace-nowrap font-medium select-none"
            style={{ color: 'var(--skin-text-secondary)', opacity: 0.25 }}
          >
            {playlist.length} 首歌曲就绪 · 点击右下角播放
          </span>
        )}
      </div>
    )
  }

  // 正在播放 → 跑马灯
  return (
    <div className="hidden md:flex flex-1 items-center mx-3 min-w-0 overflow-hidden relative self-stretch">
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
    </div>
  )
}
