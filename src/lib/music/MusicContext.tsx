'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'

// ========== 类型 ==========

export interface Track {
  id: string
  title: string
  artist?: string
  album?: string
  url: string // public Supabase Storage URL
  storagePath?: string // Supabase storage path for cross-device sync
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
  play: (index?: number) => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  setVolume: (v: number) => void
  setMuted: (m: boolean) => void
  cycleLoopMode: () => void
  addTrack: (track: Track) => void
  addTracks: (tracks: Track[]) => void
  removeTrack: (id: string) => void
  clearPlaylist: () => void
}

const MusicContext = createContext<MusicContextType | null>(null)

export function useMusic() {
  const ctx = useContext(MusicContext)
  return ctx
}

// ========== 本地存储 ==========

const STORAGE_KEY = 'minitu_music'

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
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
    // Fire-and-forget sync to cloud
    syncPlaylistToCloud(tracks)
  } catch { toast.error('存储空间不足') }
}

// 后台同步到 Supabase
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
          })),
          created_at: new Date().toISOString(),
        },
      }),
    }).catch(() => {})
  } catch { /* silent */ }
}

// 从云端拉取播放列表
async function loadPlaylistFromCloud(): Promise<Track[]> {
  try {
    const res = await fetch('/api/sync', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return (data.musicPlaylist || []) as Track[]
  } catch { return [] }
}

export { loadPlaylistFromCloud }

// ========== Provider ==========

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.6)
  const [muted, setMutedState] = useState(false)
  const [loopMode, setLoopMode] = useState<LoopMode>('all')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shuffleOrderRef = useRef<number[]>([])

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
    }
    loadTracks()
  }, [])

  // 初始化 Audio
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.volume = volume
      audioRef.current.addEventListener('error', () => {
        toast.error('无法播放此音频')
        setPlaying(false)
      })
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0)
      })
      audioRef.current.addEventListener('durationchange', () => {
        setDuration(audioRef.current?.duration || 0)
      })
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0)
      })
    }
    return () => { audioRef.current?.pause() }
  }, [])

  const currentTrack = playlist[currentIndex] || null

  // 播放结束处理
  useEffect(() => {
    const audio = audioRef.current
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

  // 切换曲目
  useEffect(() => {
    if (!audioRef.current || playlist.length === 0) return
    const track = playlist[currentIndex]
    if (!track) return
    if (audioRef.current.src !== track.url) {
      audioRef.current.src = track.url
      audioRef.current.load()
    }
    if (playing) audioRef.current.play().catch(() => setPlaying(false))
  }, [currentIndex, playlist])

  // 音量
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume
  }, [volume, muted])

  // shuffle 重建
  useEffect(() => {
    if (loopMode === 'shuffle') shuffleOrderRef.current = []
  }, [loopMode])

  const play = useCallback((index?: number) => {
    if (playlist.length === 0) return
    const idx = index ?? currentIndex
    setCurrentIndex(idx)
    setPlaying(true)
    setTimeout(() => audioRef.current?.play().catch(() => setPlaying(false)), 50)
  }, [playlist, currentIndex])

  const pause = useCallback(() => { audioRef.current?.pause(); setPlaying(false) }, [])
  const togglePlay = useCallback(() => {
    if (!audioRef.current || playlist.length === 0) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => { toast.error('播放失败'); setPlaying(false) }) }
  }, [playing, playlist])

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return
    const nxt = (currentIndex + 1) % playlist.length
    setCurrentIndex(nxt)
    if (playing) setTimeout(() => audioRef.current?.play().catch(() => {}), 100)
  }, [playlist, currentIndex, playing])

  const handleShuffleNext = useCallback(() => {
    if (playlist.length === 0) return
    if (shuffleOrderRef.current.length === 0) {
      const order = Array.from({ length: playlist.length }, (_, i) => i).filter(i => i !== currentIndex)
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
      shuffleOrderRef.current = [currentIndex, ...order]
    }
    const pos = shuffleOrderRef.current.indexOf(currentIndex)
    setCurrentIndex(shuffleOrderRef.current[(pos + 1) % shuffleOrderRef.current.length])
    if (playing) setTimeout(() => audioRef.current?.play().catch(() => {}), 100)
  }, [playlist, currentIndex, playing])

  const next = useCallback(() => { loopMode === 'shuffle' ? handleShuffleNext() : handleNext() }, [loopMode, handleNext, handleShuffleNext])

  const prev = useCallback(() => {
    if (playlist.length === 0) return
    const p = (currentIndex - 1 + playlist.length) % playlist.length
    setCurrentIndex(p)
    if (playing) setTimeout(() => audioRef.current?.play().catch(() => {}), 100)
  }, [playlist, currentIndex, playing])

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), [])
  const setMuted = useCallback((m: boolean) => setMutedState(m), [])
  const cycleLoopMode = useCallback(() => {
    const modes: LoopMode[] = ['all', 'one', 'shuffle', 'none']
    setLoopMode(modes[(modes.indexOf(loopMode) + 1) % modes.length])
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
    audioRef.current?.pause()
  }, [playlist])

  return (
    <MusicContext.Provider value={{
      playlist, currentIndex, playing, volume, muted, loopMode, currentTrack,
      currentTime, duration,
      play, pause, togglePlay, next, prev, setVolume, setMuted, cycleLoopMode,
      addTrack, addTracks, removeTrack, clearPlaylist,
    }}>
      {children}
    </MusicContext.Provider>
  )
}
