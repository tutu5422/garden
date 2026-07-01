'use client'

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Music, ListMusic, ChevronUp, Upload, Trash2, Repeat, Repeat1, Shuffle,
  CheckSquare, Square, Plus, Heart
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useMusic, type Track, type LoopMode } from '@/lib/music/MusicContext'
import { searchAndCacheLyrics, setLyrics, hideLyrics, parseFilename } from '@/lib/music/lyrics-store'
import { resolveStorageUrl } from '@/lib/storage-url'
import { MAX_FILE_SIZE } from '@/lib/constants/config'
import { toggleFavorite, getFavoritedIds, getPlaylists, addTracksToPlaylist } from '@/lib/music/music-store'
import Link from 'next/link'

const MAX_SIZE = MAX_FILE_SIZE // 50 MB

const loopIcons: Record<LoopMode, React.ReactNode> = {
  none: <Repeat className="size-3.5 opacity-30" />,
  all: <Repeat className="size-3.5" />,
  one: <Repeat1 className="size-3.5" />,
  shuffle: <Shuffle className="size-3.5" />,
}

const loopLabels: Record<LoopMode, string> = {
  none: '关闭循环', all: '列表循环', one: '单曲循环', shuffle: '随机播放',
}

// Audio file extensions
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'])

interface UploadedAudioFile {
  id: string
  name: string
  size: string
  sizeBytes: number
  storagePath?: string
  url?: string
  createdAt: string
}

/** Read audio files from minitu_files localStorage */
function getAudioFilesFromStore(): UploadedAudioFile[] {
  try {
    const raw = localStorage.getItem('minitu_files')
    if (!raw) return []
    const files = JSON.parse(raw)
    return files.filter((f: any) => {
      const ext = f.name?.split('.').pop()?.toLowerCase() || ''
      return AUDIO_EXTS.has(ext)
    })
  } catch { return [] }
}

/** Upload file via presigned URL (bypasses Vercel 4.5MB limit) */
async function uploadViaPresignedUrl(file: File, id: string): Promise<{ storagePath: string; publicUrl: string }> {
  const presignRes = await fetch('/api/storage/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, id }),
  })
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}))
    throw new Error(err.error || '获取上传链接失败')
  }
  const { signedUrl, storagePath, publicUrl } = await presignRes.json()

  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'audio/mpeg' },
    body: file,
  })
  if (!uploadRes.ok) throw new Error(`上传失败 (${uploadRes.status})`)

  return { storagePath, publicUrl }
}

export default function MiniPlayer() {
  const ctx = useMusic();
  if (!ctx) return null;

  const { playlist, currentIndex, currentTrack, playing, volume, muted, loopMode,
    currentTime, duration, togglePlay, play, seek, next, prev, setVolume, setMuted, cycleLoopMode, addTrack, removeTrack, notifyLyricsUpdated, updateTrackLyrics } = ctx;

  const [expanded, setExpanded] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importFiles, setImportFiles] = useState<UploadedAudioFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUploadLyrics, setShowUploadLyrics] = useState(false)
  const [lrcFileName, setLrcFileName] = useState('')
  const [lrcFileContent, setLrcFileContent] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lrcInputRef = useRef<HTMLInputElement>(null)

  // Refresh import file list when panel opens
  useEffect(() => {
    if (showImport) {
      const audioFiles = getAudioFilesFromStore()
      // Filter out files already in the playlist
      const playlistIds = new Set(playlist.map(t => t.id))
      const available = audioFiles.filter(f => !playlistIds.has(f.id))
      setImportFiles(available)
      setSelectedIds(new Set())
    }
  }, [showImport, playlist])

  const fmtTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === importFiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(importFiles.map(f => f.id)))
    }
  }

  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return
    setImporting(true)
    const toImport = importFiles.filter(f => selectedIds.has(f.id))
    let imported = 0
    for (const f of toImport) {
      const url = f.url || resolveStorageUrl(f.storagePath)
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      if (!url) continue
      const parsed = parseFilename(f.name.replace(/\.[^.]+$/, ''))
      const track: Track = {
        id: f.id,
        title: parsed.title,
        artist: parsed.artist,
        url,
        storagePath: f.storagePath || `${f.id}/${f.id}.${ext}`,
      }
      addTrack(track)
      imported++
      // Background lyric search
      searchAndCacheLyrics(track.id, track.title, track.artist)
    }
    toast.success(`已导入 ${imported} 首歌曲`)
    setShowImport(false)
    setImporting(false)
  }, [selectedIds, importFiles, addTrack])

  // Direct upload handler (for MiniPlayer's own upload capability)
  const handleDirectUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return

    if (file.size > MAX_SIZE) { toast.error('文件不能超过 50MB'); return }

    setUploading(true)
    try {
      const rawName = file.name.replace(/\.[^.]+$/, '')
      const parsed = parseFilename(rawName)
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)

      // Upload via presigned URL
      const { storagePath, publicUrl } = await uploadViaPresignedUrl(file, id)

      // Save to files store (so it appears in files page too)
      try {
        const raw = localStorage.getItem('minitu_files')
        const currentFiles = raw ? JSON.parse(raw) : []
        const newFile = {
          id, name: file.name,
          size: file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          sizeBytes: file.size,
          type: (file.name.split('.').pop()?.toUpperCase() || 'MP3'),
          category: '', createdAt: new Date().toISOString(),
          storagePath, url: publicUrl,
        }
        currentFiles.unshift(newFile)
        localStorage.setItem('minitu_files', JSON.stringify(currentFiles))
      } catch {}

      const track: Track = {
        id, title: parsed.title, artist: parsed.artist,
        url: publicUrl, storagePath,
      }
      addTrack(track)
      toast.success(`已添加: ${track.title}${track.artist ? ` — ${track.artist}` : ''}`)

      // Background lyric search
      searchAndCacheLyrics(track.id, track.title, track.artist).then(result => {
        if (result) toast.success(`📝 已找到「${track.title}」的歌词`)
      })
    } catch (err: any) {
      toast.error(err.message || '上传失败')
    }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }, [addTrack])

  const handleRemoveTrack = (id: string, e: React.MouseEvent) => { e.stopPropagation(); removeTrack(id) }

  // --- Collapsed state ---
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

  // --- Expanded state ---
  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-40">
      {expanded ? (
        <div className="p-5 w-80 animate-fade-in-scale space-y-4 border-2 border-[var(--skin-border)]"
             style={{ backgroundColor: 'var(--skin-surface)', borderRadius: '1rem 0.25rem 0.25rem 0.25rem' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/music?view=all"
                className="text-xs font-extrabold tracking-[0.15em] uppercase transition-colors hover:opacity-70"
                style={{ color: 'var(--skin-primary)', fontFamily: 'var(--font-display)' }}>
                🎵 音乐
              </Link>
            </div>
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

          {/* Import Panel */}
          {showImport && (
            <div className="space-y-2 p-2 border-2 border-[var(--skin-border)]"
                 style={{ background: 'var(--skin-muted)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--skin-text-secondary)]">
                  选择音频文件导入 ({importFiles.length} 个可用)
                </span>
                <button onClick={() => setShowImport(false)} className="text-[10px] text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]">
                  关闭
                </button>
              </div>

              {importFiles.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-[var(--skin-text-secondary)]">尚无可用音频文件</p>
                  <p className="text-[10px] text-[var(--skin-text-secondary)] mt-1 opacity-60">请先在「文件」页面上传音频，或使用下方按钮直接上传</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={selectAll} className="text-[10px] font-bold text-[var(--skin-primary)] hover:underline">
                      {selectedIds.size === importFiles.length ? '取消全选' : '全选'}
                    </button>
                    <span className="text-[10px] text-[var(--skin-text-secondary)]">
                      已选 {selectedIds.size} / {importFiles.length}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {importFiles.map(f => (
                      <div key={f.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-[var(--skin-surface)] transition-colors"
                        onClick={() => toggleSelect(f.id)}>
                        <span style={{ color: selectedIds.has(f.id) ? 'var(--skin-primary)' : 'var(--skin-text-secondary)' }}>
                          {selectedIds.has(f.id) ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
                        </span>
                        <span className="truncate flex-1 font-medium">{f.name}</span>
                        <span className="text-[10px] text-[var(--skin-text-secondary)] shrink-0">{f.size}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={selectedIds.size === 0 || importing}
                    className="w-full py-1.5 text-xs font-bold rounded transition-all mt-1"
                    style={{
                      backgroundColor: selectedIds.size > 0 ? 'var(--skin-primary)' : 'var(--skin-border)',
                      color: selectedIds.size > 0 ? '#fff' : 'var(--skin-text-secondary)',
                    }}>
                    {importing ? '导入中...' : `确认导入 (${selectedIds.size})`}
                  </button>
                </>
              )}

              {/* Direct upload option */}
              <div className="pt-2 border-t border-[var(--skin-border)]">
                <label className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-[var(--skin-surface)] transition-colors text-[var(--skin-text-secondary)] font-bold w-full">
                  <Plus className="size-3.5" />
                  {uploading ? '上传中...' : '直接上传新音频文件 (最多50MB)'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/aac,audio/ogg,audio/*"
                    className="hidden"
                    onChange={handleDirectUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Playlist Panel */}
          {showPlaylist && !showImport && (
            <div className="space-y-0.5 max-h-48 overflow-y-auto p-2 border-2 border-[var(--skin-border)]"
                 style={{ background: 'var(--skin-muted)' }}>
              {playlist.map((track, i) => (
                <div key={track.id}
                  className={cn('flex items-center gap-2 px-2 py-2 text-xs cursor-pointer transition-all group font-medium', i === currentIndex ? 'font-extrabold' : 'hover:bg-[var(--skin-surface)]')}
                  style={i === currentIndex ? { color: 'var(--skin-primary)', background: 'rgba(var(--skin-primary-rgb), 0.08)' } : {}}
                  onClick={() => play(i)}>
                  <span className="text-[var(--skin-text-secondary)] shrink-0 w-4 text-right font-mono">{i + 1}</span>
                  <span className="truncate flex-1">{track.title}</span>
                  <button onClick={(e) => handleRemoveTrack(track.id, e)} className="p-0.5 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all shrink-0"><Trash2 className="size-3" /></button>
                </div>
              ))}
              <button
                onClick={() => { setShowPlaylist(false); setShowImport(true); }}
                className="flex items-center gap-2 px-2 py-2 text-xs cursor-pointer hover:bg-[var(--skin-surface)] transition-colors text-[var(--skin-text-secondary)] font-bold w-full text-left"
              >
                <Upload className="size-3.5" />导入音频文件
              </button>
            </div>
          )}

          {currentTrack && (
            <div className="text-center pt-1">
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-sm font-extrabold truncate" style={{ fontFamily: 'var(--font-display)' }}>{currentTrack.title}</p>
                {/* Favorite toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const now = toggleFavorite(currentTrack.id)
                    toast.success(now ? '已收藏 ❤️' : '已取消收藏')
                  }}
                  className="p-0.5 transition-all shrink-0 hover:scale-110"
                  title="收藏">
                  <Heart className={cn('size-3', getFavoritedIds().has(currentTrack.id) && 'fill-current')}
                    style={{ color: getFavoritedIds().has(currentTrack.id) ? '#ff6e6e' : 'var(--skin-text-secondary)' }} />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-0.5">
                {currentTrack.artist && (
                  <span className="text-[10px] text-[var(--skin-text-secondary)] opacity-70">{currentTrack.artist}</span>
                )}
                {currentTrack.album && (
                  <>
                    <span className="text-[8px] text-[var(--skin-text-secondary)] opacity-30">·</span>
                    <span className="text-[10px] text-[var(--skin-text-secondary)] opacity-70">{currentTrack.album}</span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-[var(--skin-text-secondary)] mt-1 font-mono">{currentIndex + 1} / {playlist.length} · {loopLabels[loopMode]}</p>

              {/* Lyrics management */}
              <div className="flex items-center justify-center gap-2 mt-2.5">
                <button onClick={() => setShowUploadLyrics(!showUploadLyrics)}
                  className="text-[9px] tracking-wide opacity-25 hover:opacity-100 transition-opacity duration-200"
                  style={{ color: 'var(--skin-text-secondary)' }}>上传 .lrc 歌词</button>
                <span className="text-[var(--skin-border)] opacity-20 select-none">|</span>
                <button
                  onClick={() => {
                    if (!currentTrack || deleting) return
                    setDeleting(true)
                    try { hideLyrics(currentTrack.id); updateTrackLyrics(currentTrack.id, { lyricsHidden: true }); notifyLyricsUpdated(); toast.success('歌词已隐藏，仅显示歌名和歌手') }
                    finally { setDeleting(false) }
                  }}
                  disabled={deleting}
                  className="text-[9px] tracking-wide opacity-25 hover:opacity-100 transition-opacity duration-200"
                  style={{ color: 'var(--skin-text-secondary)' }}>仅显示歌名</button>
              </div>

              {showUploadLyrics && (
                <div className="mt-3 pt-3 border-t border-[var(--skin-border)] space-y-2 animate-fade-in-up">
                  <label className="flex items-center justify-center gap-1.5 w-full px-2 py-2 text-[10px] font-bold cursor-pointer rounded border border-dashed border-[var(--skin-border)] hover:border-[var(--skin-primary)] transition-colors"
                         style={{ color: 'var(--skin-text-secondary)' }}>
                    <Upload className="size-3" />
                    {lrcFileName ? `已选: ${lrcFileName}` : '选择 .lrc 歌词文件'}
                    <input
                      ref={lrcInputRef}
                      type="file"
                      accept=".lrc"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setLrcFileName(file.name)
                        const reader = new FileReader()
                        reader.onload = () => setLrcFileContent(reader.result as string)
                        reader.onerror = () => toast.error('读取文件失败')
                        reader.readAsText(file)
                      }}
                    />
                  </label>
                  {lrcFileContent && (
                    <pre className="w-full text-[9px] px-2.5 py-1.5 rounded border border-[var(--skin-border)] bg-[var(--skin-muted)] text-[var(--skin-text)] max-h-20 overflow-y-auto leading-relaxed opacity-70 whitespace-pre-wrap"
                    >{lrcFileContent.slice(0, 300)}{lrcFileContent.length > 300 ? '…' : ''}</pre>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (!lrcFileContent || !currentTrack) return
                      setLyrics(currentTrack.id, {
                        lyrics: lrcFileContent.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').split('\n').filter(l => l.trim()).join('\n'),
                        syncedLyrics: lrcFileContent,
                        source: 'manual', searchedAt: Date.now(),
                      })
                      // 同步到云端
                      updateTrackLyrics(currentTrack.id, {
                        lyrics: lrcFileContent.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').split('\n').filter(l => l.trim()).join('\n'),
                        syncedLyrics: lrcFileContent,
                        lyricsSource: 'manual',
                      })
                      toast.success('LRC 歌词已保存'); setShowUploadLyrics(false); setLrcFileName(''); setLrcFileContent(''); notifyLyricsUpdated()
                    }}
                      disabled={!lrcFileContent}
                      className="flex-1 text-[10px] font-bold py-1 rounded transition-all"
                      style={{ backgroundColor: 'var(--skin-primary)', color: '#fff', opacity: lrcFileContent ? 1 : 0.3 }}>
                      保存
                    </button>
                    <button onClick={() => { setShowUploadLyrics(false); setLrcFileName(''); setLrcFileContent('') }}
                      className="text-[10px] font-bold py-1 px-3 rounded transition-colors border border-[var(--skin-border)]"
                      style={{ color: 'var(--skin-text-secondary)' }}>取消</button>
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

          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] w-8 shrink-0">
              {seeking ? fmtTime(seekValue) : fmtTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration && isFinite(duration) ? duration : 0}
              step="0.1"
              value={seeking ? seekValue : currentTime}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setSeeking(true);
                setSeekValue(v);
              }}
              onMouseUp={() => { seek(seekValue); setSeeking(false); }}
              onTouchEnd={() => { seek(seekValue); setSeeking(false); }}
              className="flex-1 h-1.5 accent-[var(--skin-primary)] cursor-pointer"
              style={{ background: 'var(--skin-muted)' }}
            />
            <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] w-8 shrink-0">
              {fmtTime(duration)}
            </span>
          </div>

          <div className="flex items-center justify-center">
            <button onClick={() => setMuted(!muted)} className="p-1 transition-colors" style={{ color: muted ? 'var(--skin-text-secondary)' : 'var(--skin-text)' }} title={muted ? '取消静音' : '静音'}>
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
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
