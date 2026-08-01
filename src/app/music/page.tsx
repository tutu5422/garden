'use client'

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { useMusic, type Track } from '@/lib/music/MusicContext'
import {
  getPlaylists, createPlaylist, deletePlaylist, updatePlaylist,
  addTracksToPlaylist, removeTrackFromPlaylist,
  getFavoritedIds, toggleFavorite,
  groupByAlbum, groupByArtist,
  refreshPlaylistsFromCloud,
  type MusicPlaylist, type ExtendedTrack,
} from '@/lib/music/music-store'
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
  Search, X, Plus, Heart, Upload, MoreHorizontal, Music2,
  Disc3, MicVocal, ListMusic, ChevronLeft, Loader2, Trash2, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { parseFilename } from '@/lib/music/lyrics-store'

/* ========================================================================
   Helpers
   ======================================================================== */

const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'])

type View = 'all' | 'albums' | 'artists' | 'playlists' | 'favorites'
type SortMode = 'default' | 'title' | 'artist' | 'added' | 'year'

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// ---- Cover map ----
interface CoverMap { [key: string]: string }
let _coverCache: CoverMap | null = null
async function loadCoverMap(): Promise<CoverMap> {
  if (_coverCache) return _coverCache
  try {
    const res = await fetch('/music-covers-manifest.json')
    const data = await res.json()
    const map: CoverMap = {}
    for (const e of data) {
      if (e.coverUrl) { map[`${e.artist}|${e.album}`] = e.coverUrl; if (e.album === '_default_') map[`${e.artist}|`] = e.coverUrl }
    }
    _coverCache = map; return map
  } catch { return {} }
}
function getCoverUrl(artist: string, album: string | undefined, m: CoverMap): string | undefined {
  if (!album) return
  if (m[`${artist}|${album}`]) return m[`${artist}|${album}`]
  if (m[`${artist}|`]) return m[`${artist}|`]
  for (const [k, v] of Object.entries(m)) if (k.endsWith(`|${album}`)) return v
}

// ---- Upload helper ----
async function uploadViaPresignedUrl(file: File, id: string) {
  const r1 = await fetch('/api/storage/presign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, id }) })
  if (!r1.ok) throw new Error((await r1.json().catch(() => ({}))).error || '获取上传链接失败')
  const { signedUrl, storagePath, publicUrl } = await r1.json()
  const r2 = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'audio/mpeg' }, body: file })
  if (!r2.ok) throw new Error(`上传失败 (${r2.status})`)
  return { storagePath, publicUrl }
}

// ---- AlbumArt ----
function AlbumArt({ album, size = 'md', coverUrl }: { album: string; size?: 'sm' | 'md' | 'lg'; coverUrl?: string }) {
  const h = album.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const sz = { sm: 'size-10', md: 'size-14', lg: 'size-20 sm:size-28' }
  const tx = { sm: 'text-[8px]', md: 'text-xs', lg: 'text-base' }
  if (coverUrl) return <div className={cn(sz[size], 'rounded-2xl overflow-hidden shrink-0 shadow-lg')}><img src={coverUrl} alt={album} className="w-full h-full object-cover" /></div>
  const ch = album.split('').filter(c => /\w/.test(c)).slice(0, 2).join('') || '♪'
  return <div className={cn(sz[size], 'rounded-2xl shrink-0 shadow-lg flex items-center justify-center font-black')} style={{ background: `linear-gradient(135deg, hsl(${h},70%,75%), hsl(${(h+50)%360},60%,85%))`, color: `hsl(${h},50%,25%)` }}><span className={cn(tx[size], 'select-none')}>{ch}</span></div>
}

// ---- EQ animation ----
function EQBar({ playing }: { playing: boolean }) {
  const bars = [3, 5, 2, 4, 3]
  const dur = useRef(bars.map(() => 0.4 + Math.random() * 0.3))
  return <span className="inline-flex items-end gap-px h-3">{bars.map((h, i) => <span key={i} className="w-[2px] rounded-full" style={{ height: h, background: 'var(--skin-primary)', animationDuration: `${dur.current[i]}s`, opacity: playing ? 1 : 0.3, animation: playing ? `eq-bar 0.6s ease-in-out infinite` : 'none', animationDelay: `${i * 0.08}s`, transformOrigin: 'bottom' }} />)}</span>
}

/* ========================================================================
   Components
   ======================================================================== */

// ---- TrackRow (memo'd) ----
interface TrackRowProps {
  track: ExtendedTrack; i: number; currentId?: string; isPlaying?: boolean
  isFav: boolean; coverMap: CoverMap; plId?: string
  onPlay: (id: string) => void; onToggleFav: (id: string) => void
  onRemoveFromPl?: (plId: string, trackId: string) => void
  onRefresh?: () => void
}
const TrackRowEq = (p: TrackRowProps, n: TrackRowProps) =>
  p.track.id === n.track.id && p.i === n.i && p.currentId === n.currentId && p.isPlaying === n.isPlaying && p.isFav === n.isFav && p.coverMap === n.coverMap && p.plId === n.plId

const TrackRow = memo(function TrackRow(p: TrackRowProps) {
  const isCur = p.track.id === p.currentId
  const [menuOpen, setMenuOpen] = useState(false)
  const playlists = useMemo(() => getPlaylists(), [])
  const menuRef = useRef<HTMLDivElement>(null)

  // click-outside listener
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  return (
    <div className="group flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-[var(--skin-muted)]"
      style={{ background: isCur ? 'rgba(var(--skin-primary-rgb),0.06)' : 'transparent' }}
      onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; p.onPlay(p.track.id) }}
    >
      {/* Index / Playing indicator */}
      <span className="w-5 text-center shrink-0 text-xs font-mono" style={{ color: isCur ? 'var(--skin-primary)' : 'var(--skin-text-secondary)' }}>
        {isCur && p.isPlaying ? <EQBar playing /> : (isCur ? '▶' : p.i + 1)}
      </span>
      {/* Album art */}
      <AlbumArt album={p.track.album || p.track.artist || p.track.title} size="sm" coverUrl={getCoverUrl(p.track.artist || '', p.track.album, p.coverMap)} />
      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm truncate', isCur && 'font-extrabold')} style={{ color: isCur ? 'var(--skin-primary)' : 'var(--skin-text)' }}>{p.track.title}</div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--skin-text-secondary)' }}>
          {p.track.artist && <span className="truncate">{p.track.artist}</span>}
          {p.track.album && <><span className="opacity-40">·</span><span className="truncate opacity-70">{p.track.album}</span></>}
        </div>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {p.plId && p.onRemoveFromPl && (
          <button onClick={e => { e.stopPropagation(); p.onRemoveFromPl!(p.plId!, p.track.id); p.onRefresh?.() }}
            className="p-1 rounded-full hover:bg-red-50 transition-colors"><X className="size-3" style={{ color: '#f43f5e' }} /></button>
        )}
        <button onClick={e => { e.stopPropagation(); p.onToggleFav(p.track.id) }}
          className="p-1 rounded-full transition-all hover:scale-110">
          <Heart className={cn('size-3.5', p.isFav && 'fill-current')} style={{ color: p.isFav ? '#f43f5e' : 'var(--skin-text-secondary)' }} />
        </button>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="p-1 rounded-full hover:bg-[var(--skin-muted)] transition-colors">
            <MoreHorizontal className="size-3.5" style={{ color: 'var(--skin-text-secondary)' }} />
          </button>
          {menuOpen && (
            <div ref={menuRef} className="absolute right-0 top-full mt-1 z-50 w-44 py-1.5 rounded-xl border shadow-xl"
              style={{ background: 'var(--skin-surface)', borderColor: 'var(--skin-border)' }}>
              <div className="px-3 py-1 text-[10px] font-bold truncate" style={{ color: 'var(--skin-text-secondary)' }}>{p.track.title}</div>
              <div className="h-px mx-2 my-1" style={{ background: 'var(--skin-border)' }} />
              {playlists.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--skin-text-secondary)' }}>暂无歌单</div>
              ) : playlists.map(pl => (
                <button key={pl.id} onClick={e => { e.stopPropagation(); addTracksToPlaylist(pl.id, [p.track.id]); setMenuOpen(false); toast.success(`已加入「${pl.name}」`) }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--skin-muted)]" style={{ color: 'var(--skin-text)' }}>
                  <Plus className="size-3" style={{ color: 'var(--skin-primary)' }} />{pl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}, TrackRowEq)

export default function MusicPage() {
  const ctx = useMusic()
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('default')
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [coverMap, setCoverMap] = useState<CoverMap>({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sub-view states
  const [selAlbum, setSelAlbum] = useState<string | null>(null)
  const [selArtist, setSelArtist] = useState<string | null>(null)
  const [selPlaylist, setSelPlaylist] = useState<string | null>(null)
  const [showCreatePl, setShowCreatePl] = useState(false)
  const [editName, setEditName] = useState('')
  const [plEditId, setPlEditId] = useState<string | null>(null) // which playlist is being renamed
  const [plEditName, setPlEditName] = useState('')

  // Refresh all local state
  const refresh = useCallback(() => {
    setPlaylists(getPlaylists()); setFavIds(getFavoritedIds())
  }, [])

  // Load data — 同时从云端拉取歌单合并（歌单只推不拉的修复），
  // 并主动重拉云端曲目（解决长会话/切页导航后看不到新数据）
  useEffect(() => {
    refresh(); loadCoverMap().then(setCoverMap)
    refreshPlaylistsFromCloud().then(list => { setPlaylists(list); refresh() })
    ctx?.reload()
  }, [refresh])

  // Snapshot the full library on mount so it's not affected by queue changes
  const [fullLibrary, setFullLibrary] = useState<ExtendedTrack[]>([])
  useEffect(() => {
    if (ctx?.playlist && ctx.playlist.length > 0 && fullLibrary.length === 0) {
      setFullLibrary(ctx.playlist as ExtendedTrack[])
    }
  }, [ctx?.playlist])

  // allTracks = full library (for display), not the current queue
  const allTracks = fullLibrary.length > 0 ? fullLibrary : (ctx?.playlist || []) as ExtendedTrack[]

  // Filter + sort
  const filtered = useMemo(() => {
    let t = allTracks
    const q = search.toLowerCase()
    if (q) t = t.filter(x => x.title.toLowerCase().includes(q) || (x.artist || '').toLowerCase().includes(q) || (x.album || '').toLowerCase().includes(q))
    switch (sort) {
      case 'title': t = [...t].sort((a, b) => a.title.localeCompare(b.title)); break
      case 'artist': t = [...t].sort((a, b) => (a.artist || '').localeCompare(b.artist || '')); break
      case 'added': t = [...t].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')); break
      case 'year': t = [...t].sort((a, b) => (b.year || 0) - (a.year || 0)); break
    }
    return t
  }, [allTracks, search, sort])

  const albums = useMemo(() => groupByAlbum(filtered).map(a => ({ ...a, coverUrl: getCoverUrl(a.albumArtist || '', a.album, coverMap) })), [filtered, coverMap])
  const artists = useMemo(() => groupByArtist(filtered), [filtered])

  const currentId = ctx?.currentTrack?.id
  const isPlaying = ctx?.playing

  // Upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 50 * 1024 * 1024) { toast.error('文件不能超过 50MB'); return }
    setUploading(true)
    try {
      const id = crypto.randomUUID?.() || 'm-' + Date.now().toString(36)
      const parsed = parseFilename(f.name.replace(/\.[^.]+$/, ''))
      const { storagePath, publicUrl } = await uploadViaPresignedUrl(f, id)
      try {
        const raw = localStorage.getItem('minitu_files')
        const files = raw ? JSON.parse(raw) : []
        files.unshift({ id, name: f.name, size: f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`, sizeBytes: f.size, type: (f.name.split('.').pop()?.toUpperCase() || 'MP3'), category: '', createdAt: new Date().toISOString(), storagePath, url: publicUrl })
        localStorage.setItem('minitu_files', JSON.stringify(files))
      } catch { }
      ctx?.addTrack({ id, title: parsed.title, artist: parsed.artist, url: publicUrl, storagePath })
      toast.success(`已添加: ${parsed.title}${parsed.artist ? ` — ${parsed.artist}` : ''}`)
    } catch (e: any) { toast.error(e.message || '上传失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // ---- "播放全部" ----
  // Replace the queue with the given tracks and start playing.
  // The sidebar shows the current scope and provides a way to restore the full library.
  const playFromGroup = (tracks: ExtendedTrack[]) => {
    if (!ctx || tracks.length === 0) return
    ctx.playTracks(tracks)
  }

  // ========================================================================
  // TAB defs
  // ========================================================================

  const TABS: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: '全部', icon: <Music2 className="size-3" /> },
    { id: 'albums', label: '专辑', icon: <Disc3 className="size-3" /> },
    { id: 'artists', label: '歌手', icon: <MicVocal className="size-3" /> },
    { id: 'playlists', label: '歌单', icon: <ListMusic className="size-3" /> },
    { id: 'favorites', label: '收藏', icon: <Heart className="size-3" /> },
  ]

  const switchView = (v: View) => {
    setView(v); setSelAlbum(null); setSelArtist(null); setSelPlaylist(null)
  }

  // ========================================================================
  // Views
  // ========================================================================

  const renderAll = () => (
    <div className="space-y-0.5">
      {/* Header with 播放全部 */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--skin-text-secondary)' }}>
          <span className="w-5 text-center">#</span><span className="w-10" /><span className="flex-1">歌曲</span>
        </div>
        <button onClick={() => { if (ctx) ctx.playTracks(allTracks) }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-white transition-all hover:shadow-sm" style={{ background: 'var(--skin-primary)' }}>
          <Play className="size-3" />播放全部全部曲目
        </button>
      </div>
      {filtered.map((t, i) => (
        <TrackRow key={t.id} track={t} i={i} currentId={currentId} isPlaying={isPlaying}
          isFav={favIds.has(t.id)} coverMap={coverMap}
          onPlay={id => { const idx = ctx?.playlist.findIndex(t => t.id === id); if (idx != null && idx >= 0) ctx?.play(idx) }}
          onToggleFav={id => { toggleFavorite(id); setFavIds(getFavoritedIds()) }} />
      ))}
    </div>
  )

  const renderAlbums = () => {
    if (selAlbum) {
      const a = albums.find(x => x.album === selAlbum)
      if (!a) return null
      return (
        <div className="space-y-4">
          <button onClick={() => setSelAlbum(null)} className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
            <ChevronLeft className="size-3" />返回
          </button>
          <div className="flex items-end gap-5 pb-5 border-b-2 border-[var(--skin-border)] flex-wrap">
            <AlbumArt album={a.album} size="lg" coverUrl={a.coverUrl} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>{a.album}</h1>
              {a.albumArtist && <p className="text-sm mt-0.5 font-medium" style={{ color: 'var(--skin-text-secondary)' }}>{a.albumArtist}</p>}
              <p className="text-xs mt-1" style={{ color: 'var(--skin-text-secondary)' }}>{a.trackCount} 首{a.year ? ` · ${a.year}` : ''}</p>
              <button onClick={() => playFromGroup(a.tracks)}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-all hover:shadow-lg" style={{ background: 'var(--skin-primary)' }}>
                <Play className="size-3.5" />播放全部
              </button>
            </div>
          </div>
          <div className="space-y-0.5">
            {a.tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} i={i} currentId={currentId} isPlaying={isPlaying}
                isFav={favIds.has(t.id)} coverMap={coverMap}
                onPlay={id => { const idx = ctx?.playlist.findIndex(t => t.id === id); if (idx != null && idx >= 0) ctx?.play(idx) }}
                onToggleFav={id => { toggleFavorite(id); setFavIds(getFavoritedIds()) }} />
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {albums.map(a => {
          const h = a.album.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
          const ch = a.album.split('').filter(c => /\w/.test(c)).slice(0, 2).join('') || '♪'
          return (
          <button key={a.album} onClick={() => setSelAlbum(a.album)}
            className="group text-left rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border border-[var(--skin-border)]" style={{ background: 'var(--skin-surface)' }}>
            <div className="aspect-square relative overflow-hidden">
              {a.coverUrl ? (
                <img src={a.coverUrl} alt={a.album} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-lg sm:text-xl" style={{ background: `linear-gradient(135deg, hsl(${h},70%,75%), hsl(${(h+50)%360},60%,85%))`, color: `hsl(${h},50%,25%)` }}>
                  {ch}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/10">
                <div className="size-8 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--skin-primary)', color: '#fff' }}>
                  <Play className="size-3.5 ml-0.5" />
                </div>
              </div>
            </div>
            <div className="p-2">
              <h3 className="text-xs font-bold truncate" style={{ color: 'var(--skin-text)' }}>{a.album}</h3>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--skin-text-secondary)' }}>{a.albumArtist || '未知'} · {a.trackCount} 首</p>
            </div>
          </button>
        )})}
      </div>
    )
  }

  const renderArtists = () => {
    if (selArtist) {
      const ar = artists.find(x => x.artist === selArtist)
      if (!ar) return null
      const h = ar.artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
      return (
        <div className="space-y-4">
          <button onClick={() => setSelArtist(null)} className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
            <ChevronLeft className="size-3" />返回
          </button>
          <div className="flex items-end gap-5 pb-5 border-b-2 border-[var(--skin-border)] flex-wrap">
            <div className="size-20 sm:size-24 rounded-full flex items-center justify-center text-2xl font-black shadow-lg shrink-0"
              style={{ background: `linear-gradient(135deg, hsl(${h},70%,80%), hsl(${(h+50)%360},60%,85%))`, color: `hsl(${h},50%,25%)` }}>
              {ar.artist.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>{ar.artist}</h1>
              <p className="text-xs mt-1" style={{ color: 'var(--skin-text-secondary)' }}>{ar.albumCount} 专辑 · {ar.trackCount} 首</p>
              <button onClick={() => playFromGroup(ar.tracks)}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-all hover:shadow-lg" style={{ background: 'var(--skin-primary)' }}>
                <Play className="size-3.5" />播放全部
              </button>
            </div>
          </div>
          {/* Tracks grouped by album */}
          {Object.entries(
            ar.tracks.reduce((acc, t) => { const key = t.album || '未知专辑'; if (!acc[key]) acc[key] = []; acc[key].push(t); return acc }, {} as Record<string, ExtendedTrack[]>)
          ).map(([album, tracks]) => (
            <div key={album}>
              <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--skin-text-secondary)' }}>
                <span className="w-5 text-center">#</span><span className="w-10" /><span>{album}</span>
              </div>
              {tracks.map((t, i) => (
                <TrackRow key={t.id} track={t} i={i} currentId={currentId} isPlaying={isPlaying}
                  isFav={favIds.has(t.id)} coverMap={coverMap}
                  onPlay={id => { const idx = ctx?.playlist.findIndex(t => t.id === id); if (idx != null && idx >= 0) ctx?.play(idx) }}
                  onToggleFav={id => { toggleFavorite(id); setFavIds(getFavoritedIds()) }} />
              ))}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {artists.map(ar => {
          const h = ar.artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
          return (
            <button key={ar.artist} onClick={() => setSelArtist(ar.artist)}
              className="group text-center rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-2 border-[var(--skin-border)] p-4 sm:p-5" style={{ background: 'var(--skin-surface)' }}>
              <div className="size-16 sm:size-20 mx-auto rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shadow-md mb-3 transition-transform group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, hsl(${h},70%,80%), hsl(${(h+50)%360},60%,85%))`, color: `hsl(${h},50%,25%)` }}>
                {ar.artist.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-sm font-bold truncate" style={{ color: 'var(--skin-text)' }}>{ar.artist}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--skin-text-secondary)' }}>{ar.albumCount} 专辑 · {ar.trackCount} 首</p>
            </button>
          )
        })}
      </div>
    )
  }

  const renderPlaylists = () => {
    if (selPlaylist) {
      const pl = playlists.find(p => p.id === selPlaylist)
      if (!pl) return null
      const plTracks = pl.trackIds.map(id => allTracks.find(t => t.id === id)).filter(Boolean) as ExtendedTrack[]
      const isEditing = plEditId === pl.id
      return (
        <div className="space-y-4">
          <button onClick={() => setSelPlaylist(null)} className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
            <ChevronLeft className="size-3" />返回
          </button>
          <div className="flex items-center gap-4 pb-4 border-b-2 border-[var(--skin-border)]">
            <div className="size-14 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'rgba(var(--skin-primary-rgb),0.1)' }}>
              <ListMusic className="size-6" style={{ color: 'var(--skin-primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input autoFocus value={plEditName} onChange={e => setPlEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && plEditName.trim()) { updatePlaylist(pl.id, { name: plEditName.trim() }); setPlEditId(null); refresh() } if (e.key === 'Escape') setPlEditId(null) }}
                    className="flex-1 bg-transparent text-lg font-bold outline-none border-b-2" style={{ borderColor: 'var(--skin-primary)', color: 'var(--skin-text)' }} />
                  <button onClick={() => { if (plEditName.trim()) { updatePlaylist(pl.id, { name: plEditName.trim() }); setPlEditId(null); refresh() } }}
                    className="px-3 py-1 text-xs font-bold rounded-full text-white" style={{ background: 'var(--skin-primary)' }}>保存</button>
                  <button onClick={() => setPlEditId(null)} className="px-3 py-1 text-xs rounded-full hover:bg-[var(--skin-muted)]" style={{ color: 'var(--skin-text-secondary)' }}>取消</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>{pl.name}</h2>
                  <button onClick={() => { setPlEditId(pl.id); setPlEditName(pl.name) }} className="p-1 rounded-full hover:bg-[var(--skin-muted)] transition-colors"><Pencil className="size-3.5" style={{ color: 'var(--skin-text-secondary)' }} /></button>
                </div>
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--skin-text-secondary)' }}>{pl.trackIds.length} 首</p>
            </div>
            <div className="flex items-center gap-2">
              {plTracks.length > 0 && (
                <button onClick={() => { if (ctx) ctx.playTracks(plTracks) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-white transition-all hover:shadow-sm" style={{ background: 'var(--skin-primary)' }}>
                  <Play className="size-3" />播放全部
                </button>
              )}
              <button onClick={() => { if (confirm('删除此歌单？')) { deletePlaylist(pl.id); refresh(); setSelPlaylist(null); setPlEditId(null) } }}
                className="p-2 rounded-full hover:bg-red-50 transition-colors"><Trash2 className="size-4" style={{ color: '#f43f5e' }} /></button>
            </div>
          </div>
          <div className="space-y-0.5">
            {plTracks.map((t, i) => (
              <TrackRow key={t.id} track={t} i={i} currentId={currentId} isPlaying={isPlaying}
                isFav={favIds.has(t.id)} coverMap={coverMap} plId={pl.id}
                onPlay={id => { const idx = ctx?.playlist.findIndex(t => t.id === id); if (idx != null && idx >= 0) ctx?.play(idx) }}
                onToggleFav={id => { toggleFavorite(id); setFavIds(getFavoritedIds()) }}
                onRemoveFromPl={(plId, tid) => { removeTrackFromPlaylist(plId, tid); refresh() }}
                onRefresh={refresh} />
            ))}
            {plTracks.length === 0 && <div className="text-center py-12"><p className="text-sm" style={{ color: 'var(--skin-text-secondary)' }}>歌单为空</p></div>}
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {showCreatePl ? (
          <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-[var(--skin-border)]" style={{ background: 'var(--skin-surface)' }}>
            <input autoFocus placeholder="歌单名称..." onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && editName.trim() && (createPlaylist(editName.trim()), setShowCreatePl(false), refresh())}
              className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--skin-text)' }} />
            <button onClick={() => { if (editName.trim()) { createPlaylist(editName.trim()); setShowCreatePl(false); refresh() } }}
              className="px-4 py-1.5 text-xs font-bold rounded-full text-white" style={{ background: 'var(--skin-primary)' }}>创建</button>
            <button onClick={() => setShowCreatePl(false)} className="px-3 py-1.5 text-xs rounded-full hover:bg-[var(--skin-muted)]" style={{ color: 'var(--skin-text-secondary)' }}>取消</button>
          </div>
        ) : (
          <button onClick={() => setShowCreatePl(true)}
            className="flex items-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-[var(--skin-border)] hover:border-[var(--skin-primary)] transition-colors" style={{ color: 'var(--skin-text-secondary)' }}>
            <Plus className="size-4" /><span className="text-sm font-bold">新建歌单</span>
          </button>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {playlists.map(pl => {
            const h = pl.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
            return (
              <div key={pl.id} onClick={() => setSelPlaylist(pl.id)}
                className="group rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer border border-[var(--skin-border)]" style={{ background: 'var(--skin-surface)' }}>
                <div className="aspect-square flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${h},70%,80%), hsl(${(h+50)%360},60%,85%))` }}>
                  <ListMusic className="size-8 sm:size-10 opacity-50" style={{ color: `hsl(${h},50%,30%)` }} />
                </div>
                <div className="p-2">
                  <h3 className="text-xs font-bold truncate" style={{ color: 'var(--skin-text)' }}>{pl.name}</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--skin-text-secondary)' }}>{pl.trackIds.length} 首</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderFavorites = () => {
    const favTracks = allTracks.filter(t => favIds.has(t.id))
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 pb-4 mb-2 border-b-2 border-[var(--skin-border)]">
          <Heart className="size-5 fill-current" style={{ color: '#f43f5e' }} />
          <div className="flex-1">
            <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>我的收藏</h2>
            <p className="text-xs" style={{ color: 'var(--skin-text-secondary)' }}>{favTracks.length} 首</p>
          </div>
          {favTracks.length > 0 && (
            <button onClick={() => { if (ctx) ctx.playTracks(favTracks) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-white transition-all hover:shadow-sm" style={{ background: 'var(--skin-primary)' }}>
              <Play className="size-3" />播放全部
            </button>
          )}
        </div>
        {favTracks.map((t, i) => (
          <TrackRow key={t.id} track={t} i={i} currentId={currentId} isPlaying={isPlaying}
            isFav={true} coverMap={coverMap}
            onPlay={id => { const idx = ctx?.playlist.findIndex(t => t.id === id); if (idx != null && idx >= 0) ctx?.play(idx) }}
            onToggleFav={id => { toggleFavorite(id); setFavIds(getFavoritedIds()) }} />
        ))}
        {favTracks.length === 0 && (
          <div className="text-center py-16">
            <Heart className="size-12 mx-auto mb-3 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--skin-text-secondary)' }}>还没有收藏的歌曲</p>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    switch (view) {
      case 'albums': return renderAlbums()
      case 'artists': return renderArtists()
      case 'playlists': return renderPlaylists()
      case 'favorites': return renderFavorites()
      default: return renderAll()
    }
  }

  const SORT_OPTS: { value: SortMode; label: string }[] = [
    { value: 'default', label: '默认' }, { value: 'title', label: '标题' }, { value: 'artist', label: '歌手' }, { value: 'added', label: '最近' }, { value: 'year', label: '年份' },
  ]

  // ========================================================================
  // Render
  // ========================================================================
  return (
    <div className="flex min-h-screen pb-28 md:pb-36" style={{ background: 'var(--skin-bg)' }}>
      {/* ======== DESKTOP LEFT SIDEBAR: Now Playing ======== */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r-2 border-[var(--skin-border)] h-[calc(100vh-3.5rem)] sticky top-14"
        style={{ background: 'var(--skin-surface)' }}>
        {ctx?.currentTrack ? (
          <div className="flex flex-col flex-1 p-4 overflow-y-auto">
            {/* Cover */}
            <div className={cn('mx-auto mb-4 rounded-2xl overflow-hidden shadow-xl w-44 h-44',
              isPlaying && 'animate-[spin_8s_linear_infinite]')}>
              {(() => {
                const coverUrl = getCoverUrl(ctx.currentTrack.artist || '', ctx.currentTrack.album, coverMap)
                const album = ctx.currentTrack.album || ctx.currentTrack.title
                const h = album.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
                const ch = album.split('').filter(c => /\w/.test(c)).slice(0, 2).join('') || '♪'
                return coverUrl ? (
                  <img src={coverUrl} alt={album} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-2xl" style={{ background: `linear-gradient(135deg, hsl(${h},70%,75%), hsl(${(h+50)%360},60%,85%))`, color: `hsl(${h},50%,25%)` }}>{ch}</div>
                )
              })()}
            </div>
            {/* Info */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--skin-primary)' }}>正在播放</span>
                {isPlaying && <EQBar playing />}
              </div>
              <h2 className="text-sm font-black truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>
                {ctx.currentTrack.title}
              </h2>
              <div className="flex items-center justify-center gap-1 mt-0.5 text-[11px]" style={{ color: 'var(--skin-text-secondary)' }}>
                {ctx.currentTrack.artist && <span className="truncate max-w-[120px]">{ctx.currentTrack.artist}</span>}
                {ctx.currentTrack.album && <><span className="opacity-40">·</span><span className="truncate max-w-[100px]">{ctx.currentTrack.album}</span></>}
              </div>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--skin-text-secondary)' }}>
                {ctx.currentIndex + 1} / {ctx.playlist.length}
              </p>
            </div>
            {/* Progress */}
            <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono" style={{ color: 'var(--skin-text-secondary)' }}>
              <span>{fmtTime(ctx.currentTime)}</span>
              <input type="range" min="0" max={ctx.duration && isFinite(ctx.duration) ? ctx.duration : 0} step="0.1"
                value={ctx.currentTime}
                onChange={e => ctx.seek(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-[var(--skin-primary)]" style={{ background: 'var(--skin-muted)' }} />
              <span>{fmtTime(ctx.duration)}</span>
            </div>
            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <button onClick={() => ctx.cycleLoopMode()} className="p-1 transition-colors"
                style={{ color: ctx.loopMode !== 'none' ? 'var(--skin-primary)' : 'var(--skin-text-secondary)', opacity: ctx.loopMode === 'none' ? 0.4 : 1 }}>
                {ctx.loopMode === 'one' ? <Repeat1 className="size-4" /> : ctx.loopMode === 'shuffle' ? <Shuffle className="size-4" /> : <Repeat className="size-4" />}
              </button>
              <button onClick={() => ctx.prev()} className="p-1 transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
                <SkipBack className="size-4" />
              </button>
              <button onClick={() => ctx.togglePlay()} className="size-9 rounded-full flex items-center justify-center transition-all hover:scale-105" style={{ background: 'var(--skin-primary)', color: '#fff' }}>
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>
              <button onClick={() => ctx.next()} className="p-1 transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
                <SkipForward className="size-4" />
              </button>
              <button onClick={() => { toggleFavorite(ctx.currentTrack!.id); refresh() }} className="p-1 transition-all hover:scale-110">
                <Heart className={cn('size-4', favIds.has(ctx.currentTrack!.id) && 'fill-current')}
                  style={{ color: favIds.has(ctx.currentTrack!.id) ? '#f43f5e' : 'var(--skin-text-secondary)' }} />
              </button>
            </div>
            {/* Divider */}
            <div className="h-px my-3 mx-2" style={{ background: 'var(--skin-border)' }} />
            {/* Queue header */}
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--skin-text-secondary)' }}>
                播放队列 ({ctx.playlist.length}首)
              </span>
              {ctx.playlist.length < allTracks.length && (
                <button onClick={() => ctx.playTracks(allTracks)}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--skin-muted)]" style={{ color: 'var(--skin-primary)' }}>
                  返回全部
                </button>
              )}
            </div>
            {/* Queue list */}
            <div className="flex-1 overflow-y-auto space-y-0.5 text-xs">
              {ctx.playlist.map((t, i) => (
                <button key={t.id}
                  onClick={() => ctx.play(i)}
                  className={cn('w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors hover:bg-[var(--skin-muted)]',
                    i === ctx.currentIndex && 'font-extrabold')}
                  style={{ color: i === ctx.currentIndex ? 'var(--skin-primary)' : 'var(--skin-text)' }}>
                  <span className="w-4 text-right shrink-0 text-[10px] font-mono" style={{ color: 'var(--skin-text-secondary)' }}>
                    {i === ctx.currentIndex && isPlaying ? '▶' : i + 1}
                  </span>
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
            <Music2 className="size-10 mb-3 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
            <p className="text-xs font-bold" style={{ color: 'var(--skin-text-secondary)' }}>未在播放</p>
            <p className="text-[10px] mt-1 opacity-50" style={{ color: 'var(--skin-text-secondary)' }}>点击曲目开始播放</p>
          </div>
        )}
      </aside>

      {/* ======== RIGHT COLUMN: Header + Content ======== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ---- Fixed Header ---- */}
        <div className="fixed top-0 md:top-14 left-0 md:left-64 right-0 z-20 pt-2 pb-2 px-4 sm:px-6 border-b-2 border-[var(--skin-border)]"
          style={{ background: 'var(--skin-bg)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold shrink-0" style={{ color: 'var(--skin-text-secondary)' }}>
              <span>{allTracks.length}首</span>
              <span className="w-1 h-1 rounded-full opacity-30 hidden sm:inline" style={{ background: 'var(--skin-primary)' }} />
              <span className="hidden sm:inline">{albums.length}专</span>
              <span className="hidden sm:inline w-1 h-1 rounded-full opacity-30" style={{ background: 'var(--skin-primary)' }} />
              <span className="hidden sm:inline">{artists.length}人</span>
            </div>
            {/* Tabs */}
            <div className="flex-1 flex justify-center">
              <div className="flex gap-1 overflow-x-auto">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => switchView(tab.id)}
                    className={cn('flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0',
                      view === tab.id ? 'text-white shadow-sm' : 'hover:bg-[var(--skin-muted)]')}
                    style={{ background: view === tab.id ? 'var(--skin-primary)' : 'transparent', color: view === tab.id ? '#fff' : 'var(--skin-text-secondary)' }}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Search + Sort + Upload */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3" style={{ color: 'var(--skin-text-secondary)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="搜索..." className="w-20 sm:w-32 pl-7 pr-2 py-1.5 rounded-full text-[11px] outline-none border-2 border-[var(--skin-border)]" style={{ background: 'var(--skin-surface)', color: 'var(--skin-text)' }} />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-2.5" /></button>}
              </div>
              <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
                className="text-[10px] sm:text-[11px] font-bold bg-transparent outline-none cursor-pointer px-1.5 sm:px-2 py-1.5 rounded-full border-2 border-[var(--skin-border)]" style={{ color: 'var(--skin-text-secondary)', background: 'var(--skin-surface)' }}>
                {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label className={cn('flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold cursor-pointer transition-all shrink-0 text-white',
                uploading && 'opacity-50 pointer-events-none')}
                style={{ background: 'var(--skin-primary)' }}>
                {uploading ? <><Loader2 className="size-3 animate-spin" />上传中</> : <><Upload className="size-3" />上传</>}
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>

        {/* ---- MOBILE Now Playing Hero (shown below header on small screens) ---- */}
        {ctx?.currentTrack && (
          <div className="md:hidden px-4 pt-16 pb-2">
            <div className="rounded-xl p-3 flex items-center gap-3 border-2 border-[var(--skin-border)]"
              style={{ background: 'var(--skin-surface)' }}>
              <div className={cn('shrink-0 rounded-xl overflow-hidden size-12', isPlaying && 'animate-[spin_8s_linear_infinite]')}>
                <AlbumArt album={ctx.currentTrack.title} size="sm"
                  coverUrl={getCoverUrl(ctx.currentTrack.artist || '', ctx.currentTrack.album, coverMap)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--skin-primary)' }}>正在播放</span>
                  {isPlaying && <EQBar playing />}
                </div>
                <h2 className="text-sm font-black truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>{ctx.currentTrack.title}</h2>
                <div className="text-[10px]" style={{ color: 'var(--skin-text-secondary)' }}>
                  {ctx.currentTrack.artist}{ctx.currentTrack.album && ` · ${ctx.currentTrack.album}`}
                </div>
              </div>
              <button onClick={() => ctx.togglePlay()} className="size-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--skin-primary)', color: '#fff' }}>
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>
            </div>
          </div>
        )}

        {/* ---- Main Content ---- */}
        <main className="flex-1 px-4 sm:px-6 pb-8 pt-16 md:pt-28">
          <div className="max-w-full mx-auto">
            {allTracks.length === 0 ? (
              <div className="text-center py-24">
                <Music2 className="size-16 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--skin-text-secondary)' }}>还没有音乐，点击上方"上传"添加</p>
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
