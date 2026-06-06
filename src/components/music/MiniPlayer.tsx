'use client'

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, ListMusic, Plus, X, ChevronUp, Upload, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Track {
  id: string
  title: string
  url: string // base64 data URL or remote URL
}

const STORAGE_KEY = 'garden_playlist'

function readPlaylist(): Track[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writePlaylist(tracks: Track[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks))
  } catch (e) {
    toast.error('存储空间不足，请删除部分歌曲')
  }
}

export default function MiniPlayer() {
  const [playlist, setPlaylist] = useState<Track[]>(() => readPlaylist())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.6)
  const [muted, setMuted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 播放列表变化时自动保存
  useEffect(() => {
    if (playlist.length > 0) {
      writePlaylist(playlist)
    }
  }, [playlist])

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.volume = volume
      audioRef.current.addEventListener('error', () => {
        toast.error('无法播放此音频')
        setPlaying(false)
      })
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  // 处理曲目结束自动下一首
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => handleNext()
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [currentIndex, playlist])

  useEffect(() => {
    if (!audioRef.current || playlist.length === 0) return
    const track = playlist[currentIndex]
    if (!track) return
    if (audioRef.current.src !== track.url) {
      audioRef.current.src = track.url
      audioRef.current.load()
    }
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false))
    }
  }, [currentIndex, playlist])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume
    }
  }, [volume, muted])

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current || playlist.length === 0) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {
        toast.error('播放失败')
        setPlaying(false)
      })
    }
  }, [playing, playlist])

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return
    const next = (currentIndex + 1) % playlist.length
    setCurrentIndex(next)
    if (playing) setTimeout(() => audioRef.current?.play().catch(() => {}), 100)
  }, [playlist, currentIndex, playing])

  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return
    const prev = (currentIndex - 1 + playlist.length) % playlist.length
    setCurrentIndex(prev)
    if (playing) setTimeout(() => audioRef.current?.play().catch(() => {}), 100)
  }, [playlist, currentIndex, playing])

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件类型
    if (!file.type.startsWith('audio/')) {
      toast.error('请选择音频文件')
      return
    }

    // 检查大小（限制 20MB for localStorage）
    if (file.size > 20 * 1024 * 1024) {
      toast.error('文件不能超过 20MB')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const track: Track = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^.]+$/, ''), // 去掉扩展名
        url: dataUrl,
      }

      const updated = [...playlist, track]
      setPlaylist(updated)
      toast.success(`已添加: ${track.title}`)

      // 第一首歌自动播放
      if (updated.length === 1) {
        setCurrentIndex(0)
      }
    } catch {
      toast.error('文件读取失败')
    } finally {
      setUploading(false)
      // 清空 input 以便重复选同一个文件
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = playlist.filter(t => t.id !== id)
    setPlaylist(updated)
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1))
    }
    toast.success('已删除')
  }

  const currentTrack = playlist[currentIndex]

  // 空播放列表 — 迷你按钮
  if (playlist.length === 0 && !expanded) {
    return (
      <div className="fixed bottom-16 md:bottom-4 right-4 z-40">
        <button
          onClick={() => setExpanded(true)}
          className="glass-heavy rounded-full size-10 flex items-center justify-center shadow-3d btn-3d hover:scale-110 transition-all"
          title="音乐播放器"
        >
          <Music className="size-4" style={{ color: 'var(--skin-primary)' }} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-16 md:bottom-4 right-4 z-40">
      {expanded ? (
        <div className="glass-heavy rounded-2xl shadow-3d-lg p-4 w-80 animate-scale-in space-y-3">
          {/* 头部 */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--skin-primary)' }}>
              🎵 音乐
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                className={cn('p-1.5 rounded-lg transition-colors', showPlaylist ? 'bg-white/40' : 'hover:bg-white/30')}
                title="播放列表"
              >
                <ListMusic className="size-3.5" />
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-white/30 transition-colors"
                title="收起"
              >
                <ChevronUp className="size-3.5" />
              </button>
            </div>
          </div>

          {/* 播放列表 */}
          {showPlaylist && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {playlist.map((track, i) => (
                <div
                  key={track.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors group',
                    i === currentIndex ? 'bg-white/40 font-medium' : 'hover:bg-white/20'
                  )}
                  onClick={() => { setCurrentIndex(i); setPlaying(true) }}
                >
                  <span className="text-muted-foreground shrink-0 w-4">{i + 1}</span>
                  <span className="truncate flex-1">{track.title}</span>
                  <button
                    onClick={(e) => handleRemoveTrack(track.id, e)}
                    className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all shrink-0"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
              {/* 上传按钮 */}
              <label className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs cursor-pointer hover:bg-white/30 transition-colors text-muted-foreground">
                <Upload className="size-3.5" />
                {uploading ? '导入中...' : '导入音频文件'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          )}

          {/* 当前曲目 */}
          {currentTrack && (
            <div className="text-center pt-1">
              <p className="text-sm font-medium truncate">{currentTrack.title}</p>
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-white/30 transition-colors" disabled={playlist.length === 0}>
              <SkipBack className="size-4" />
            </button>
            <button
              onClick={handlePlayPause}
              className="rounded-full size-11 flex items-center justify-center shadow-3d btn-3d"
              disabled={playlist.length === 0}
              style={{ background: 'var(--skin-primary)', color: '#fff' }}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
            </button>
            <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-white/30 transition-colors" disabled={playlist.length === 0}>
              <SkipForward className="size-4" />
            </button>
          </div>

          {/* 音量 */}
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(!muted)} className="p-0.5 hover:text-[var(--skin-primary)] transition-colors">
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={muted ? 0 : volume * 100}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="flex-1 h-1 accent-[var(--skin-primary)]"
            />
          </div>
        </div>
      ) : (
        /* 迷你播放器 */
        <button
          onClick={() => setExpanded(true)}
          className="glass-heavy rounded-full px-3 py-2 flex items-center gap-2 shadow-3d btn-3d hover:scale-105 transition-all"
        >
          {playing ? (
            <span className="flex items-center gap-1.5">
              <span className="flex gap-0.5">
                {[3, 4, 2].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full animate-pulse"
                    style={{ height: `${h * 2}px`, background: 'var(--skin-primary)', animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </span>
              <span className="text-xs truncate max-w-24">{currentTrack?.title || '播放中'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Music className="size-3.5" style={{ color: 'var(--skin-primary)' }} />
              <span className="text-xs text-muted-foreground">
                {playlist.length > 0 ? `${playlist.length} 首` : '音乐'}
              </span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}
