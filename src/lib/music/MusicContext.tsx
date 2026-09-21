'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { resolveAudioUrl } from './audio-cache'
import { pruneGhostTracks } from './ghost-cleanup'

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
  /** 重新从云端拉取曲目合并（页面挂载/手动刷新时调用，解决长会话看不到新数据） */
  reload: () => Promise<void>
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
// 返回 null 表示"请求失败，云端状态未知"（区别于空列表），避免误判后覆盖云端
async function loadPlaylistFromCloud(): Promise<Track[] | null> {
  try {
    const res = await fetch('/api/sync', { method: 'GET' })
    if (!res.ok) return null
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
  } catch { return null }
}

export { loadPlaylistFromCloud }

// ========== 封面查表（安卓锁屏封面用，按需拉一次 manifest）==========
let coverMapCache: Record<string, string> | null = null
async function lookupCoverUrl(artist: string, album: string): Promise<string | undefined> {
  if (!artist) return undefined
  if (!coverMapCache) {
    try {
      // 封面 URL 需读签名 → 优先签名接口，失败退回静态文件
      let res = await fetch('/api/music-covers')
      if (!res.ok) res = await fetch('/music-covers-manifest.json', { cache: 'force-cache' })
      const data = (await res.json()) as { artist?: string; album?: string; coverUrl?: string }[]
      const map: Record<string, string> = {}
      for (const e of data || []) {
        if (e?.coverUrl && e.artist) {
          map[`${e.artist}|${e.album ?? ''}`] = e.coverUrl
          if (e.album === '_default_') map[`${e.artist}|`] = e.coverUrl
        }
      }
      coverMapCache = map
    } catch { coverMapCache = {} }
  }
  return coverMapCache[`${artist}|${album}`] || coverMapCache[`${artist}|`]
}

// ========== Provider ==========

// ========== 模块级 Audio（脱离 React 生命周期，页面切换不中断）==========
let globalAudio: HTMLAudioElement | null = null
function getAudio(): HTMLAudioElement {
  if (!globalAudio) {
    globalAudio = new Audio()
    ;(globalAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
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
  const shouldAutoPlayRef = useRef(false)                // 刷新恢复：是否需要自动播放
  const hasRestoredRef = useRef(false)                   // 防止覆盖已恢复的状态
  const loadTrackSeqRef = useRef(0)                      // 防竞态：切歌序列号
  const currentTrackIdRef = useRef<string | null>(null)  // 当前已加载曲目 ID
  const loadAndPlayRef = useRef(false)                   // play() 标记：加载完成后自动播放
  const playingRef = useRef(false)                       // 实时 playing 状态，避免闭包过期
  const abortControllerRef = useRef<AbortController | null>(null) // 切歌竞态：中断前一次网络请求
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null) // 3s 兜底定时器
  const canplayThroughHandlerRef = useRef<(() => void) | null>(null) // canplaythrough 监听器引用，便于 cleanup 移除

  // 合并本地 + 云端数据（云端优先），返回合并结果
  const mergeCloudTracks = useCallback(async (): Promise<Track[]> => {
    const localMeta = readMeta()
    const cloudTracksRaw = await loadPlaylistFromCloud()
    const cloudTracks = cloudTracksRaw || []

    // 去重键：陈旧设备里的旧条目 id 与云端不同，但指向同一个文件和同一首歌。
    // 只按 id 合并会让老设备显示成两倍（手机上曾出现 300+ 首），所以再加
    // storagePath 与「归一化歌名+歌手」两个键。
    const norm = (s?: string) => (s || '').trim().toLowerCase().replace(/[\s\-_·，,。、()（）\[\]!！?？'"’“”]+/g, '')
    const pathKey = (t: Track) => (t.storagePath ? `p:${t.storagePath}` : '')
    const nameKey = (t: Track) => (t.title ? `n:${norm(t.title)}|${norm(t.artist)}` : '')

    const merged = new Map<string, Track>()          // 主键：id
    const seenPaths = new Map<string, string>()      // storagePath -> id
    const seenNames = new Map<string, string>()      // 归一化歌名+歌手 -> id

    const add = (t: Track) => {
      const pk = pathKey(t), nk = nameKey(t)
      if (pk && seenPaths.has(pk)) return
      if (nk && seenNames.has(nk)) return
      merged.set(t.id, t)
      if (pk) seenPaths.set(pk, t.id)
      if (nk) seenNames.set(nk, t.id)
    }

    // 云端优先（文件已校验、id 稳定、跨设备一致），本地只补云端没有的
    for (const t of cloudTracks) add(t)
    for (const t of localMeta) {
      if (merged.has(t.id)) continue
      add(t)
    }
    let allTracks = Array.from(merged.values())

    // ---- 幽灵清理：本地独有 + 文件确实取不到（404）的条目 ----
    // 场景：某台设备的本地列表留着云端已删的旧条目（旧 id 与云端不同），刷新只是把并集
    // 写回本地，于是永远挂在列表末尾（实测 #204「Sound Of Silence」/ #205「未命名-fc73bd3e」，
    // 云端与磁盘都已没有）。只清「云端没有」的本地条目、只认 404、只写本地，绝不推云端。
    //
    // ⚠️ 必须在**首次 setPlaylist 之前**完成：音乐页会用第一次拿到的 ctx.playlist 做快照
    // （`fullLibrary`，见 src/app/music/page.tsx），先带幽灵渲染再异步删，页面会一直留着它们
    // —— 本地存储干净了、DOM 还挂着。本地独有条目为 0 时这里不发任何请求，无额外开销。
    if (cloudTracks.length > 0) {
      try {
        const { tracks: pruned, removed } = await pruneGhostTracks(
          allTracks, new Set(cloudTracks.map(t => t.id)), cloudTracks.length)
        if (removed.length > 0) {
          allTracks = pruned
          console.info('[music] 已清理 %d 条本地失效曲目：%s', removed.length,
            removed.map(t => t.title || t.id).join('、'))
          toast.info(`已清理 ${removed.length} 条本地失效曲目`)
        }
      } catch { /* 清理失败不影响正常列表 */ }
    }

    // Rewrite if cloud had data（只写本地，写的是清理后的结果）
    if (cloudTracks.length > 0) {
      try {
        const clean = allTracks.map(t => ({
          id: t.id, title: t.title, artist: t.artist, album: t.album,
          url: t.url, storagePath: t.storagePath,
        }))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
      } catch {}
    }

    // 注意：这里**不能**自动把并集推回云端。曾经加过"本地比云端多 ≥10 首就自动补推"
    // 的逻辑，结果某台设备（手机/另一浏览器）残留的旧列表被推上云端，云端从 205 首
    // 变成 353 首、其中 132 条重复。云端曲库现在由服务端/脚本维护，客户端只读。

    setPlaylist(allTracks)
    return allTracks
  }, [])

  // 初始化：拉取云端 + 恢复播放状态（仅首次）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 首次挂载拉云端曲库并恢复上次播放位置（外部存储订阅）
    mergeCloudTracks().then(allTracks => {
      if (hasRestoredRef.current || allTracks.length === 0) return
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
    })
  }, [mergeCloudTracks])

  // 手动/挂载刷新：重新拉云端，不恢复播放状态
  const reload = useCallback(async () => {
    await mergeCloudTracks()
  }, [mergeCloudTracks])

  // 初始化 Audio（绑定事件，模块级 Audio 已创建）
  useEffect(() => {
    const audio = getAudio()
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

  // 播放结束处理（使用 ref 存放最新回调引用，避免闭包过期）
  // refs 在 handleNext/handleShuffleNext 定义之后赋值（见下方）
  const handleNextRef = useRef<() => void>(() => {})
  const handleShuffleNextRef = useRef<() => void>(() => {})

  useEffect(() => {
    const audio = getAudio()
    if (!audio) return
    const onEnded = () => {
      if (loopMode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}) }
      else if (loopMode === 'shuffle') handleShuffleNextRef.current()
      else if (loopMode === 'all') handleNextRef.current()
      else setPlaying(false)
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [loopMode])

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

    // 中断前一次切歌的网络请求与定时器/监听
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    // 清理前一次 effect 残留的 canplaythrough 监听
    if (canplayThroughHandlerRef.current) {
      const audio = getAudio()
      audio?.removeEventListener('canplaythrough', canplayThroughHandlerRef.current)
      canplayThroughHandlerRef.current = null
    }

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
              canplayThroughHandlerRef.current = null
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current)
                fallbackTimerRef.current = null
              }
              doRealPlay()
            }
            canplayThroughHandlerRef.current = onReady
            audio.addEventListener('canplaythrough', onReady)
            // 3 秒兜底
            fallbackTimerRef.current = setTimeout(() => {
              fallbackTimerRef.current = null
              audio.removeEventListener('canplaythrough', onReady)
              canplayThroughHandlerRef.current = null
              doRealPlay()
            }, 3000)
          }
        }
      }

      // 后台缓存，下次播放自动使用
      resolveAudioUrl(cacheKey, track.url, undefined, signal).catch(() => {})
    }

    setupAudio()

    // cleanup：卸载或切歌前，移除监听 + 清理定时器 + 中断网络请求
    return () => {
      const audio = getAudio()
      if (audio && canplayThroughHandlerRef.current) {
        audio.removeEventListener('canplaythrough', canplayThroughHandlerRef.current)
      }
      canplayThroughHandlerRef.current = null
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [currentIndex, playlist])

  // 组件卸载时清理兜底定时器与进行中的网络请求
  useEffect(() => {
    return () => {
      const audio = getAudio()
      if (audio && canplayThroughHandlerRef.current) {
        audio.removeEventListener('canplaythrough', canplayThroughHandlerRef.current)
      }
      canplayThroughHandlerRef.current = null
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      abortControllerRef.current?.abort()
    }
  }, [])

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

  // 同步最新回调到 ref（供 onEnded effect 使用，避免闭包过期）
  // 放在 effect 里而不是渲染期赋值：渲染期写 ref 会被 React Compiler 判为副作用
  useEffect(() => {
    handleNextRef.current = handleNext
    handleShuffleNextRef.current = handleShuffleNext
  }, [handleNext, handleShuffleNext])

  const next = useCallback(() => { if (loopMode === 'shuffle') { handleShuffleNext() } else { handleNext() } }, [loopMode, handleNext, handleShuffleNext])

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

  // ---- 安卓锁屏 / 通知栏播放控制（Media Session）----
  // 不支持的浏览器（桌面 Firefox 等）直接跳过，桌面端行为完全不变
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession as MediaSession
    const set = (action: MediaSessionAction, fn: (() => void) | null) => {
      try { ms.setActionHandler(action, fn) } catch { /* 该 action 不支持 */ }
    }
    set('play', () => play())
    set('pause', () => pause())
    set('previoustrack', () => prev())
    set('nexttrack', () => next())
    set('seekbackward', () => { const a = getAudio(); if (a) a.currentTime = Math.max(0, a.currentTime - 10) })
    set('seekforward', () => { const a = getAudio(); if (a && a.duration) a.currentTime = Math.min(a.duration, a.currentTime + 10) })
    return () => {
      ;(['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward'] as MediaSessionAction[])
        .forEach(a => set(a, null))
    }
  }, [play, pause, prev, next])

  // 曲目/播放状态变化 → 更新锁屏标题与封面
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const t = currentTrack
    if (!t) return
    const ms = navigator.mediaSession as MediaSession
    ms.playbackState = playing ? 'playing' : 'paused'
    let cancelled = false
    ;(async () => {
      const cover = await lookupCoverUrl(t.artist || '', t.album || '')
      if (cancelled) return
      try {
        ms.metadata = new MediaMetadata({
          title: t.title || '',
          artist: t.artist || '',
          album: t.album || '',
          artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : [],
        })
      } catch { /* MediaMetadata 不可用 */ }
    })()
    return () => { cancelled = true }
  }, [currentTrack, playing])

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
    const audio = getAudio()
    const track = playlist.find(t => t.id === id)
    if (track?.storagePath) {
      fetch('/api/music/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: track.storagePath }),
      }).catch(() => {})
    }
    setPlaylist(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const wasPlaying = id === prev[currentIndex]?.id
      const updated = prev.filter(t => t.id !== id)
      writeMeta(updated)
      let newIndex = currentIndex
      if (wasPlaying) {
        // 删除的是当前播放曲目 → 切到下一首（或末尾）
        newIndex = Math.min(currentIndex, updated.length - 1)
        if (newIndex >= 0 && newIndex < updated.length) {
          // 触发加载新曲目：标记需要加载并播放，effect 会处理
          loadAndPlayRef.current = true
          playingRef.current = true
          currentTrackIdRef.current = null  // 强制 effect 重新加载
        } else {
          // 没有剩余曲目
          audio?.pause()
          setPlaying(false)
        }
      } else if (idx >= 0 && idx < currentIndex) {
        // 删除的曲目在当前曲目前面 → 索引前移
        newIndex = currentIndex - 1
      }
      setCurrentIndex(Math.max(0, newIndex))
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

  const contextValue = useMemo(() => ({
    playlist, currentIndex, playing, volume, muted, loopMode, currentTrack,
    currentTime, duration, lyricsVersion, notifyLyricsUpdated,
    play, pause, togglePlay, seek, next, prev, setVolume, setMuted, cycleLoopMode,
    addTrack, addTracks, removeTrack, clearPlaylist, playTracks, updateTrackLyrics,
    reload,
  }), [
    playlist, currentIndex, playing, volume, muted, loopMode, currentTrack,
    currentTime, duration, lyricsVersion, notifyLyricsUpdated,
    play, pause, togglePlay, seek, next, prev, setVolume, setMuted, cycleLoopMode,
    addTrack, addTracks, removeTrack, clearPlaylist, playTracks, updateTrackLyrics,
    reload,
  ])

  return (
    <MusicContext.Provider value={contextValue}>
      {children}
    </MusicContext.Provider>
  )
}
