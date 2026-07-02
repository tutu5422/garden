'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import { resolveAudioUrl } from './audio-cache'

// ========== 类型 ==========

export interface Track {
  id: string
  title: string
  artist?: string
  album?: string
  url: string // public VPS Storage URL
  storagePath?: string // VPS storage path for cross-device sync
  lyrics?: string          // 纯文本歌词（无时间戳）
  syncedLyrics?: string    // 原始 LRC 格式（含时间戳）
  lyricsSource?: 'searched' | 'manual'
  lyricsHidden?: boolean
  // 扩展字段（存储在 localStorage 扩展元数据中）
  favorited?: boolean
  addedAt?: string
  trackNumber?: number
  discNumber?: number
  albumArtist?: string
  genre?: string
  year?: number
  coverUrl?: string
}

export type LoopMode = 'none' | 'one' | 'all' | 'shuffle'

interface MusicContextType {
  playlist: Track[]
  currentIndex: number
  playing: boolean
  volume: number
  muted: boolean
  loopMode: LoopMode
  currentTrack: Track | null
  currentTime: number
  duration: number
  lyricsVersion: number
  notifyLyricsUpdated: () => void
  play: (index?: number) => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  next: () => void
  prev: () => void
  setVolume: (v: number) => void
  setMuted: (m: boolean) => void
  cycleLoopMode: () => void
  addTrack: (track: Track) => void
  addTracks: (tracks: Track[]) => void
  removeTrack: (id: string) => void
  clearPlaylist: () => void
  playTracks: (tracks: Track[], startIndex?: number) => void
  updateTrackLyrics: (trackId: string, lyricsData: { lyrics?: string; syncedLyrics?: string; lyricsSource?: 'searched' | 'manual'; lyricsHidden?: boolean }) => void
}

const MusicContext = createContext<MusicContextType | null>(null)

export function useMusic() {
  const ctx = useContext(MusicContext)
  return ctx
}

// ========== 本地存储 ==========

const STORAGE_KEY = 'minitu_music'

// ========== 播放状态持久化（页面刷新后继续播放）==========
const PLAYBACK_KEY = 'minitu_playback'
interface PlaybackState {
  currentIndex: number
  currentTime: number
  playing: boolean
  volume: number
  muted: boolean
  loopMode: LoopMode
}
function readPlayback(): PlaybackState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PLAYBACK_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function writePlayback(patch: Partial<PlaybackState>) {
  if (typeof window === 'undefined') return
  try {
    const current = JSON.parse(localStorage.getItem(PLAYBACK_KEY) || 'null') || {}
    const merged = { ...current, ...patch }
    localStorage.setItem(PLAYBACK_KEY, JSON.stringify(merged))
  } catch {}
}

function readMeta(): Track[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeMeta(tracks: Track[]) {
  if (typeof window === 'undefined') return
  try {
    const meta = tracks.map(t => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      url: t.url, storagePath: t.storagePath,
      lyrics: t.lyrics, syncedLyrics: t.syncedLyrics,
      lyricsSource: t.lyricsSource, lyricsHidden: t.lyricsHidden,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
    // Fire-and-forget sync to cloud
    syncPlaylistToCloud(tracks)
  } catch { toast.error('存储空间不足') }
}

// 后台同步到 VPS
function syncPlaylistToCloud(tracks: Track[]) {
  if (typeof window === 'undefined') return
  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'music_playlist',
        action: 'upsert',
        data: {
          tracks: tracks.map(t => ({
            id: t.id, title: t.title, artist: t.artist, album: t.album,
            url: t.url, storagePath: t.storagePath,
            lyrics: t.lyrics, syncedLyrics: t.syncedLyrics,
            lyricsSource: t.lyricsSource, lyricsHidden: t.lyricsHidden,
          })),
          created_at: new Date().toISOString(),
        },
      }),
    }).catch(() => {})
  } catch { /* silent */ }
}

// 从云端拉取播放列表，同时把歌词还原到 localStorage
async function loadPlaylistFromCloud(): Promise<Track[]> {
  try {
    const res = await fetch('/api/sync', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    const tracks = (data.musicPlaylist || []) as Track[]

    // 把云端歌词还原到 lyric store localStorage
    try {
      const lyricsStore: Record<string, unknown> = JSON.parse(localStorage.getItem('minitu_lyrics') || '{}')
      let updated = false
      for (const t of tracks) {
        if (t.lyrics && !lyricsStore[t.id]) {
          lyricsStore[t.id] = {
            lyrics: t.lyrics,
            syncedLyrics: t.syncedLyrics || undefined,
            source: t.lyricsSource || 'manual',
            searchedAt: Date.now(),
            hidden: t.lyricsHidden || false,
          }
          updated = true
        }
      }
      if (updated) localStorage.setItem('minitu_lyrics', JSON.stringify(lyricsStore))
    } catch {}

    return tracks
  } catch { return [] }
}

export { loadPlaylistFromCloud }

// ========== Provider ==========

// ========== 模块级 Audio（脱离 React 生命周期，页面切换不中断）==========
let globalAudio: HTMLAudioElement | null = null
function getAudio(): HTMLAudioElement {
  if (!globalAudio) {
    globalAudio = new Audio()
    ;(globalAudio as any).playsInline = true
    globalAudio.preload = 'auto'
  }
  return globalAudio
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.6)
  const [muted, setMutedState] = useState(false)
  const [loopMode, setLoopMode] = useState<LoopMode>('all')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [lyricsVersion, setLyricsVersion] = useState(0)
  const shuffleOrderRef = useRef<number[]>([])
  const seekTargetRef = useRef<number | null>(null)     // 刷新恢复：seek 目标
 const seekToRef = useRef<number | null>(null)    // 用户拖拽 seek 目标
  const shouldAutoPlayRef = useRef(false)                // 刷新恢复：是否需要自动播放
  const hasRestoredRef = useRef(false)                   // 防止覆盖已恢复的状态
  const loadTrackSeqRef = useRef(0)                      // 防竞态：切歌序列号
  const currentTrackIdRef = useRef<string | null>(null)  // 当前已加载曲目 ID
  const loadAndPlayRef = useRef(false)                   // play() 标记：加载完成后自动播放
  const playingRef = useRef(false)                       // 实时 playing 状态，避免闭包过期

  // 初始化：合并本地 + 云端数据（云端优先）
  useEffect(() => {
    const loadTracks = async () => {
      const localMeta = readMeta()
      const cloudTracks = await loadPlaylistFromCloud()

      // Cloud as source of truth
      const merged = new Map<string, Track>()
      for (const t of cloudTracks) merged.set(t.id, t)
      for (const t of localMeta) {
        if (!merged.has(t.id)) merged.set(t.id, t)
      }
      const allTracks = Array.from(merged.values())

      // Rewrite if cloud had data
      if (cloudTracks.length > 0) {
        try {
          const clean = allTracks.map(t => ({
            id: t.id, title: t.title, artist: t.artist, album: t.album,
            url: t.url, storagePath: t.storagePath,
          }))
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
        } catch {}
      }

      setPlaylist(allTracks)

      // 恢复播放状态（页面刷新后继续播放）
      if (!hasRestoredRef.current && allTracks.length > 0) {
        hasRestoredRef.current = true
        const saved = readPlayback()
        if (saved) {
          const idx = Math.min(saved.currentIndex, allTracks.length - 1)
          setCurrentIndex(idx)
          setVolumeState(saved.volume ?? 0.6)
          setMutedState(saved.muted ?? false)
          setLoopMode(saved.loopMode ?? 'all')
          seekTargetRef.current = saved.currentTime || 0
          shouldAutoPlayRef.current = saved.playing
        }
      }
    }
    loadTracks()
  }, [])

  // 初始化 Audio（绑定事件，模块级 Audio 已创建）
  useEffect(() => {
    const audio = getAudio()
    audio.volume = volume
    const onError = () => { toast.error('无法播放此音频'); setPlaying(false) }
    const onTimeUpdate = () => { setCurrentTime(audio.currentTime || 0) }
    const onDurationChange = () => { setDuration(audio.duration || 0) }
    const onLoadedMeta = () => {
      const dur = audio.duration || 0
      setDuration(dur)
      if (seekTargetRef.current !== null) {
        audio.currentTime = Math.min(seekTargetRef.current, dur)
        seekTargetRef.current = null
      }
      if (shouldAutoPlayRef.current) {
        shouldAutoPlayRef.current = false
        audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
      }
    }
    audio.addEventListener('error', onError)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('loadedmetadata', onLoadedMeta)

    const saveTimer = setInterval(() => {
      if (!audio.paused) writePlayback({ currentTime: audio.currentTime })
    }, 5000)

    return () => {
      audio.removeEventListener('error', onError)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('loadedmetadata', onLoadedMeta)
      clearInterval(saveTimer)
      // 不断开播放——音频跨页面持续
    }
  }, [])

  const notifyLyricsUpdated = useCallback(() => {
    setLyricsVersion(v => v + 1)
  }, [])

  const currentTrack = playlist[currentIndex] || null

  // 同步 playingRef 避免闭包过期
  useEffect(() => { playingRef.current = playing }, [playing])

  // 播放结束处理
  useEffect(() => {
    const audio = getAudio()
    if (!audio) return
    const onEnded = () => {
      if (loopMode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}) }
      else if (loopMode === 'shuffle') handleShuffleNext()
      else if (loopMode === 'all') handleNext()
      else setPlaying(false)
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [loopMode, currentIndex, playlist])

  // 切换曲目（含音频缓存检查）
  useEffect(() => {
    if (!getAudio() || playlist.length === 0) return
    const track = playlist[currentIndex]
    if (!track) return

    // 同一曲目已加载，跳过
    if (currentTrackIdRef.current === track.id) return
    currentTrackIdRef.current = track.id

    const cacheKey = track.storagePath || track.id
    const seq = ++loadTrackSeqRef.current

    const setupAudio = () => {
      const audio = getAudio()!

      // 直接用网络 URL，不 await 缓存（避免打断移动端手势链）
      audio.src = track.url
      audio.load()

      // 用户触发的播放：等音频缓冲就绪
      if (loadAndPlayRef.current && seq === loadTrackSeqRef.current) {
        loadAndPlayRef.current = false
        if (playingRef.current) {
          const doRealPlay = () => {
            if (seq !== loadTrackSeqRef.current) return
            audio.play().catch(() => setPlaying(false))
          }
          // 移动端需要等缓冲，桌面端 readyState 通常已就绪
          if (audio.readyState >= 3) {
            doRealPlay()
          } else {
            const onReady = () => {
              audio.removeEventListener('canplaythrough', onReady)
              doRealPlay()
            }
            audio.addEventListener('canplaythrough', onReady)
            // 3 秒兜底
            setTimeout(() => {
              audio.removeEventListener('canplaythrough', onReady)
              doRealPlay()
            }, 3000)
          }
        }
      }

      // 后台缓存，下次播放自动使用
      resolveAudioUrl(cacheKey, track.url).catch(() => {})
    }

    setupAudio()
  }, [currentIndex, playlist])

  // 音量
  useEffect(() => {
    if (getAudio()) getAudio().volume = muted ? 0 : volume
  }, [volume, muted])

  // shuffle 重建
  useEffect(() => {
    if (loopMode === 'shuffle') shuffleOrderRef.current = []
  }, [loopMode])

  const play = useCallback((index?: number) => {
    if (playlist.length === 0) return
    const idx = index ?? currentIndex
    const isNewTrack = idx !== currentIndex
    if (isNewTrack) {
      loadAndPlayRef.current = true
      playingRef.current = true  // 提前同步 ref，避免 track-loading effect 读到旧值
      setCurrentIndex(idx)
    } else {
      getAudio()?.play().catch(() => setPlaying(false))
    }
    setPlaying(true)
    writePlayback({ currentIndex: idx, playing: true })
  }, [playlist, currentIndex])

  const pause = useCallback(() => { getAudio()?.pause(); setPlaying(false); writePlayback({ playing: false }) }, [])

  /** 播放指定曲目列表，不持久化到 localStorage/cloud（用于"播放全部"临时队列） */
  const playTracks = useCallback((tracks: Track[], startIndex?: number) => {
    if (tracks.length === 0) return
    loadAndPlayRef.current = true
    playingRef.current = true
    setPlaylist(tracks)
    setCurrentIndex(startIndex ?? 0)
    setPlaying(true)
    writePlayback({ currentIndex: startIndex ?? 0, playing: true })
    // 注意：故意不调 writeMeta —— 不把临时队列写入本地存储和云端
  }, [])

  const seek = useCallback((time: number) => {
    if (!getAudio()) return
    const dur = getAudio().duration
    if (!isFinite(dur)) return
    const t = Math.max(0, Math.min(time, dur))
    getAudio().currentTime = t
    setCurrentTime(t)
    writePlayback({ currentTime: t })
  }, [])
  const togglePlay = useCallback(() => {
    if (!getAudio() || playlist.length === 0) return
    if (playing) { getAudio().pause(); setPlaying(false); writePlayback({ playing: false }) }
    else {
      const audio = getAudio()
      // 确保 src 已设置（切歌 effect 可能还没跑完）
      if (!audio.src || audio.src === window.location.href) {
        const track = playlist[currentIndex]
        if (track) {
          audio.src = track.url
          audio.load()
        }
      }
      audio.play().then(() => { setPlaying(true); writePlayback({ playing: true }) }).catch(() => { toast.error('播放失败'); setPlaying(false) })
    }
  }, [playing, playlist, currentIndex])

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return
    const nxt = (currentIndex + 1) % playlist.length
    loadAndPlayRef.current = true
    playingRef.current = true
    setCurrentIndex(nxt)
    writePlayback({ currentIndex: nxt, currentTime: 0 })
  }, [playlist, currentIndex])

  const handleShuffleNext = useCallback(() => {
    if (playlist.length === 0) return
    if (shuffleOrderRef.current.length === 0) {
      const order = Array.from({ length: playlist.length }, (_, i) => i).filter(i => i !== currentIndex)
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
      shuffleOrderRef.current = [currentIndex, ...order]
    }
    const pos = shuffleOrderRef.current.indexOf(currentIndex)
    const nxt = shuffleOrderRef.current[(pos + 1) % shuffleOrderRef.current.length]
    loadAndPlayRef.current = true
    playingRef.current = true
    setCurrentIndex(nxt)
    writePlayback({ currentIndex: nxt, currentTime: 0 })
  }, [playlist, currentIndex])

  const next = useCallback(() => { loopMode === 'shuffle' ? handleShuffleNext() : handleNext() }, [loopMode, handleNext, handleShuffleNext])

  const prev = useCallback(() => {
    if (playlist.length === 0) return
    const p = (currentIndex - 1 + playlist.length) % playlist.length
    loadAndPlayRef.current = true
    playingRef.current = true
    setCurrentIndex(p)
    writePlayback({ currentIndex: p, currentTime: 0 })
  }, [playlist, currentIndex])

  const setVolume = useCallback((v: number) => { const val = Math.max(0, Math.min(1, v)); setVolumeState(val); writePlayback({ volume: val }) }, [])
  const setMuted = useCallback((m: boolean) => { setMutedState(m); writePlayback({ muted: m }) }, [])
  const cycleLoopMode = useCallback(() => {
    const modes: LoopMode[] = ['all', 'one', 'shuffle', 'none']
    const newMode = modes[(modes.indexOf(loopMode) + 1) % modes.length]
    setLoopMode(newMode)
    writePlayback({ loopMode: newMode })
  }, [loopMode])

  const addTrack = useCallback(async (track: Track) => {
    setPlaylist(prev => {
      if (prev.some(t => t.id === track.id)) return prev
      const updated = [...prev, track]
      writeMeta(updated)
      return updated
    })
  }, [])

  const addTracks = useCallback(async (tracks: Track[]) => {
    setPlaylist(prev => {
      const existing = new Set(prev.map(t => t.id))
      const newTracks = tracks.filter(t => !existing.has(t.id))
      if (newTracks.length === 0) return prev
      const updated = [...prev, ...newTracks]
      writeMeta(updated)
      return updated
    })
  }, [])

  const removeTrack = useCallback((id: string) => {
    const track = playlist.find(t => t.id === id)
    if (track?.storagePath) {
      fetch('/api/music/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: track.storagePath }),
      }).catch(() => {})
    }
    setPlaylist(prev => {
      const updated = prev.filter(t => t.id !== id)
      writeMeta(updated)
      if (currentIndex >= updated.length) setCurrentIndex(Math.max(0, updated.length - 1))
      return updated
    })
  }, [currentIndex, playlist])

  const clearPlaylist = useCallback(() => {
    setPlaylist([]); setCurrentIndex(0); setPlaying(false)
    getAudio()?.pause()
  }, [])

  const updateTrackLyrics = useCallback((trackId: string, lyricsData: { lyrics?: string; syncedLyrics?: string; lyricsSource?: 'searched' | 'manual'; lyricsHidden?: boolean }) => {
    setPlaylist(prev => {
      const idx = prev.findIndex(t => t.id === trackId)
      if (idx === -1) return prev
      const updated = [...prev]
      updated[idx] = { ...updated[idx], ...lyricsData }
      writeMeta(updated)
      return updated
    })
  }, [])

  return (
    <MusicContext.Provider value={{
      playlist, currentIndex, playing, volume, muted, loopMode, currentTrack,
      currentTime, duration, lyricsVersion, notifyLyricsUpdated,
      play, pause, togglePlay, seek, next, prev, setVolume, setMuted, cycleLoopMode,
      addTrack, addTracks, removeTrack, clearPlaylist, playTracks, updateTrackLyrics,
    }}>
      {children}
    </MusicContext.Provider>
  )
}
