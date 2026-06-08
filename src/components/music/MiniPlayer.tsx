'use client'

import { useState, useRef, useCallback, type ChangeEvent } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Music, ListMusic, ChevronUp, Upload, Trash2, Repeat, Repeat1, Shuffle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useMusic, type Track, type LoopMode } from '@/lib/music/MusicContext'
import { searchAndCacheLyrics, setLyrics, deleteLyrics, parseFilename } from '@/lib/music/lyrics-store'

const loopIcons: Record<LoopMode, React.ReactNode> = {
  none: <Repeat className="size-3.5 opacity-30" />,
  all: <Repeat className="size-3.5" />,
  one: <Repeat1 className="size-3.5" />,
  shuffle: <Shuffle className="size-3.5" />,
}

const loopLabels: Record<LoopMode, string> = {
  none: '关闭循环', all: '列表循环', one: '单曲循环', shuffle: '随机播放',
}

export default function MiniPlayer() {
  const ctx = useMusic();
  if (!ctx) return null;

  const { playlist, currentIndex, currentTrack, playing, volume, muted, loopMode,
    togglePlay, play, next, prev, setVolume, setMuted, cycleLoopMode, addTrack, removeTrack } = ctx;

  const [expanded, setExpanded] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUploadLyrics, setShowUploadLyrics] = useState(false)
  const [uploadText, setUploadText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (!file.type.startsWith('audio/')) { toast.error('请选择音频文件'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('文件不能超过 20MB'); return }
    setUploading(true)
    try {
      const rawName = file.name.replace(/\.[^.]+$/, '')
      const parsed = parseFilename(rawName)
      const trackId = Date.now().toString()

      // Upload audio file to Supabase Storage for cross-device sync
      const formData = new FormData()
      formData.append('file', file)
      formData.append('id', trackId)
      const res = await fetch('/api/music/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || '上传失败')

      const track: Track = {
        id: trackId,
        title: parsed.title,
        artist: parsed.artist,
        url: json.publicUrl,
        storagePath: json.storagePath,
      }
      addTrack(track)
      toast.success(`已添加: ${track.title}${track.artist ? ` — ${track.artist}` : ''}`)

      // 后台搜索歌词
      searchAndCacheLyrics(track.id, track.title, track.artist).then(result => {
        if (result) {
          toast.success(`📝 已找到「${track.title}」的歌词`, {
            description: '播放时将自动显示',
            duration: 3000,
          })
        } else {
          toast.info(`未找到「${track.title}」的歌词`, {
            description: '播放时将显示歌曲信息',
            duration: 3000,
          })
        }
      })
    } catch (err: any) { toast.error(err.message || '上传失败') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }, [addTrack])

  const handleRemoveTrack = (id: string, e: React.MouseEvent) => { e.stopPropagation(); removeTrack(id); toast.success('已删除') }

  if (playlist.length === 0 && !expanded) {
    return (
      <div className="fixed bottom-20 md:bottom-4 right-4 z-40">
        <button onClick={() => setExpanded(true)} className="border-2 border-[var(--skin-border)] bg-[var(--skin-surface)] size-12 flex items-center justify-center transition-all duration-200 hover:border-[var(--skin-primary)] hover:scale-105"
                style={{ borderRadius: '50%' }}>
          <Music className="size-5" style={{ color: 'var(--skin-primary)' }} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-40">
      {expanded ? (
        <div className="p-5 w-80 animate-fade-in-scale space-y-4 border-2 border-[var(--skin-border)]"
             style={{ backgroundColor: 'var(--skin-surface)', borderRadius: '1rem 0.25rem 0.25rem 0.25rem' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold tracking-[0.15em] uppercase" style={{ color: 'var(--skin-primary)', fontFamily: 'var(--font-display)' }}>🎵 音乐</span>
            <div className="flex gap-1">
              <button onClick={cycleLoopMode} className="p-1.5 transition-colors hover:text-[var(--skin-primary)] relative" title={loopLabels[loopMode]}>
                {loopIcons[loopMode]}
                {loopMode !== 'none' && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full" style={{ backgroundColor: 'var(--skin-primary)' }} />}
              </button>
              <button onClick={() => setShowPlaylist(!showPlaylist)} className={cn('p-1.5 transition-colors', showPlaylist ? 'text-[var(--skin-primary)]' : 'hover:text-[var(--skin-text)]')}>
                <ListMusic className="size-3.5" />
              </button>
              <button onClick={() => setExpanded(false)} className="p-1.5 transition-colors hover:text-[var(--skin-text)]"><ChevronUp className="size-3.5" /></button>
            </div>
          </div>

          {showPlaylist && (
            <div className="space-y-0.5 max-h-48 overflow-y-auto p-2 border-2 border-[var(--skin-border)]"
                 style={{ background: 'var(--skin-muted)' }}>
              {playlist.map((track, i) => (
                <div key={track.id}
                  className={cn('flex items-center gap-2 px-2 py-2 text-xs cursor-pointer transition-all group font-medium', i === currentIndex ? 'font-extrabold' : 'hover:bg-[var(--skin-surface)]')}
                  style={i === currentIndex ? { color: 'var(--skin-primary)', background: 'rgba(var(--skin-primary-rgb), 0.08)' } : {}}
                  onClick={() => play(i)}>
                  <span className="text-[var(--skin-text-secondary)] shrink-0 w-4 text-right font-mono">{i + 1}</span>
                  <span className="truncate flex-1">{track.title}</span>
                  <button onClick={(e) => handleRemoveTrack(track.id, e)} className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all shrink-0"><Trash2 className="size-3" /></button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-2 py-2 text-xs cursor-pointer hover:bg-[var(--skin-surface)] transition-colors text-[var(--skin-text-secondary)] font-bold">
                <Upload className="size-3.5" />{uploading ? '导入中...' : '导入音频文件'}
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          )}

          {currentTrack && (
            <div className="text-center pt-1">
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-sm font-extrabold truncate" style={{ fontFamily: 'var(--font-display)' }}>{currentTrack.title}</p>
              </div>
              <p className="text-[10px] text-[var(--skin-text-secondary)] mt-1 font-mono">{currentIndex + 1} / {playlist.length} · {loopLabels[loopMode]}</p>

              {/* 歌词操作 — 不明显的小按钮行 */}
              <div className="flex items-center justify-center gap-2 mt-2.5">
                <button
                  onClick={() => setShowUploadLyrics(!showUploadLyrics)}
                  className="text-[9px] tracking-wide opacity-25 hover:opacity-100 transition-opacity duration-200"
                  style={{ color: 'var(--skin-text-secondary)' }}
                  title="粘贴上传歌词"
                >
                  上传歌词
                </button>
                <span className="text-[var(--skin-border)] opacity-20 select-none">|</span>
                <button
                  onClick={async () => {
                    if (!currentTrack || deleting) return
                    setDeleting(true)
                    try {
                      deleteLyrics(currentTrack.id)
                      toast.success('歌词已删除，下次播放将重新搜索')
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  disabled={deleting}
                  className="text-[9px] tracking-wide opacity-25 hover:opacity-100 transition-opacity duration-200"
                  style={{ color: 'var(--skin-text-secondary)' }}
                  title="删除当前歌词"
                >
                  删除歌词
                </button>
              </div>

              {/* 上传歌词表单 */}
              {showUploadLyrics && (
                <div className="mt-3 pt-3 border-t border-[var(--skin-border)] space-y-2 animate-fade-in-up">
                  <textarea
                    value={uploadText}
                    onChange={e => setUploadText(e.target.value)}
                    placeholder="粘贴 LRC 或纯文本歌词…"
                    rows={4}
                    className="w-full text-[10px] px-2.5 py-1.5 rounded border border-[var(--skin-border)] bg-[var(--skin-muted)] text-[var(--skin-text)] outline-none focus:border-[var(--skin-primary)] transition-colors resize-none leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!uploadText.trim() || !currentTrack) return
                        const text = uploadText.trim()
                        const hasLrcTags = /\[\d{2}:\d{2}\.\d{2,3}\]/.test(text)
                        setLyrics(currentTrack.id, {
                          lyrics: text.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').split('\n').filter(l => l.trim()).join('\n'),
                          syncedLyrics: hasLrcTags ? text : undefined,
                          source: 'manual',
                          searchedAt: Date.now(),
                        })
                        toast.success('歌词已保存')
                        setShowUploadLyrics(false)
                        setUploadText('')
                        // 触发 LyricsMarquee 刷新
                        window.location.reload()
                      }}
                      disabled={!uploadText.trim()}
                      className="flex-1 text-[10px] font-bold py-1 rounded transition-all"
                      style={{
                        backgroundColor: 'var(--skin-primary)',
                        color: '#fff',
                        opacity: uploadText.trim() ? 1 : 0.3,
                      }}
                    >
                      保存歌词
                    </button>
                    <button
                      onClick={() => { setShowUploadLyrics(false); setUploadText('') }}
                      className="text-[10px] font-bold py-1 px-3 rounded transition-colors border border-[var(--skin-border)]"
                      style={{ color: 'var(--skin-text-secondary)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-5">
            <button onClick={prev} className="p-2 transition-colors hover:text-[var(--skin-primary)]"><SkipBack className="size-4" /></button>
            <button onClick={togglePlay} className="size-12 flex items-center justify-center border-2 border-[var(--skin-primary)] transition-all duration-200 hover:scale-105"
                    style={{ background: 'var(--skin-primary)', color: '#fff', borderRadius: '50%' }}
                    disabled={playlist.length === 0}>
              {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
            </button>
            <button onClick={next} className="p-2 transition-colors hover:text-[var(--skin-primary)]"><SkipForward className="size-4" /></button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(!muted)} className="p-0.5 transition-colors" style={{ color: muted ? 'var(--skin-text-secondary)' : 'var(--skin-text)' }}>
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <input type="range" min="0" max="100" value={muted ? 0 : Math.round(volume * 100)}
                   onChange={(e) => { setMuted(false); setVolume(Number(e.target.value) / 100); }}
                   className="flex-1 h-1.5 accent-[var(--skin-primary)]" />
          </div>
        </div>
      ) : (
        <button onClick={() => setExpanded(true)} className="border-2 border-[var(--skin-border)] bg-[var(--skin-surface)] px-3 py-2 flex items-center gap-2 transition-all duration-200 hover:border-[var(--skin-primary)] hover:scale-105"
                style={{ borderRadius: '9999px' }}>
          {playing ? (
            <span className="flex items-center gap-1.5">
              <span className="flex gap-0.5 items-end h-3">{[3, 4, 2, 5, 3].map((h, i) => (
                <span key={i} className="w-0.5 rounded-full eq-bar" style={{ height: `${h * 2}px`, background: 'var(--skin-primary)', animationDelay: `${i * 150}ms` }} />
              ))}</span>
              <span className="text-xs truncate max-w-24 font-extrabold">{currentTrack?.title || '播放中'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Music className="size-3.5" style={{ color: 'var(--skin-primary)' }} />
              <span className="text-xs font-bold text-[var(--skin-text-secondary)]">{playlist.length > 0 ? `${playlist.length} 首` : '音乐'}</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}
