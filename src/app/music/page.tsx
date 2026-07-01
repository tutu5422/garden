'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMusic } from '@/lib/music/MusicContext'
import {
  getPlaylists, createPlaylist, deletePlaylist,
  addTracksToPlaylist, removeTrackFromPlaylist,
  getFavoritedIds, toggleFavorite,
  groupByAlbum, groupByArtist,
  type ExtendedTrack, type MusicPlaylist,
} from '@/lib/music/music-store'
import {
  Music2, Disc3, MicVocal, ListMusic, Heart,
  Play, Pause, SkipBack, SkipForward,
  Plus, Search, X, MoreHorizontal,
  Trash2, Sparkles, Waves, Library,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ===== 视图 =====
type View = 'all' | 'albums' | 'artists' | 'playlists' | 'favorites'
type SortMode = 'default' | 'title' | 'artist' | 'added' | 'year'

// ===== 明亮 vibey 色盘 =====
const C = {
  bg: '#faf5ff',
  bgGradient: 'linear-gradient(180deg, #faf5ff 0%, #fce7f3 30%, #ede9fe 60%, #e0f2fe 100%)',
  card: 'rgba(255,255,255,0.7)',
  cardBorder: 'rgba(0,0,0,0.06)',
  cardHover: 'rgba(255,255,255,0.9)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  accent1: '#ec4899',   // pink
  accent2: '#8b5cf6',   // purple
  accent3: '#06b6d4',   // cyan
  accent4: '#f59e0b',   // amber
  accent5: '#10b981',   // emerald
  surface: 'rgba(255,255,255,0.5)',
  trackBg: 'rgba(255,255,255,0.3)',
  trackBgHover: 'rgba(255,255,255,0.6)',
  activeTrack: 'rgba(236,72,153,0.08)',
}

// ===== 导航 TAB =====
const NAV_TABS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: '全部', icon: <Library className="size-3.5" /> },
  { id: 'albums', label: '专辑', icon: <Disc3 className="size-3.5" /> },
  { id: 'artists', label: '歌手', icon: <MicVocal className="size-3.5" /> },
  { id: 'playlists', label: '歌单', icon: <ListMusic className="size-3.5" /> },
  { id: 'favorites', label: '收藏', icon: <Heart className="size-3.5" /> },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'title', label: '标题' },
  { value: 'artist', label: '歌手' },
  { value: 'added', label: '最近' },
  { value: 'year', label: '年份' },
]

// ===== 封面模块 =====
interface CoverMap { [key: string]: string }
let _coverCache: CoverMap | null = null
async function loadCoverMap(): Promise<CoverMap> {
  if (_coverCache) return _coverCache
  try {
    const res = await fetch('/music-covers-manifest.json')
    const data = await res.json()
    const map: CoverMap = {}
    for (const e of data) {
      if (e.coverUrl) {
        map[`${e.artist}|${e.album}`] = e.coverUrl
        if (e.album === '_default_') map[`${e.artist}|`] = e.coverUrl
      }
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

function AlbumArt({ album, size = 'md', coverUrl }: { album: string; size?: 'sm'|'md'|'lg'; coverUrl?: string }) {
  const h = album.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const sz = { sm: 'size-10', md: 'size-14', lg: 'size-20 sm:size-32' }
  const tx = { sm: 'text-[8px]', md: 'text-xs', lg: 'text-base sm:text-xl' }
  if (coverUrl) return (
    <div className={cn(sz[size], 'rounded-2xl overflow-hidden shrink-0 ring-1 ring-black/5 shadow-lg')}
      style={{ background: `hsl(${h}, 60%, 85%)` }}>
      <img src={coverUrl} alt={album} className="w-full h-full object-cover" />
    </div>
  )
  const ch = album.split('').filter(c => /\w/.test(c)).slice(0, 2).join('') || '♪'
  return (
    <div className={cn(sz[size], 'rounded-2xl overflow-hidden shrink-0 shadow-lg flex items-center justify-center font-black')}
      style={{ background: `linear-gradient(135deg, hsl(${h}, 70%, 75%), hsl(${(h+50)%360}, 60%, 85%))`, color: `hsl(${h}, 50%, 25%)` }}>
      <span className={cn(tx[size], 'select-none')}>{ch}</span>
    </div>
  )
}

// ===== EQ 动画条 =====
function EQBar({ playing, size = 'sm', color }: { playing: boolean; size?: 'sm'|'md'; color?: string }) {
  const bars = size === 'sm' ? [3,5,2,4,3] : [4,7,3,9,5,8,4,6]
  const c = color || C.accent1
  return (
    <span className="inline-flex items-end gap-px" style={{ height: size === 'sm' ? 12 : 20 }}>
      {bars.map((h, i) => (
        <span key={i} className={cn('w-[2px] rounded-full', playing && 'eq-bar')}
          style={{
            height: h,
            background: c,
            animationDuration: `${0.4 + Math.random() * 0.3}s`,
            animationDelay: `${i * 0.08}s`,
            opacity: playing ? 1 : 0.3,
          }}
        />
      ))}
    </span>
  )
}

// ===== 格式化 =====
function fmtDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth()+1}月${d.getDate()}日`
}

// ===== 曲目菜单（添加到歌单） =====
function TrackActions({ track, onClose }: { track: ExtendedTrack; onClose: () => void }) {
  const playlists = getPlaylists()
  return (
    <div className="absolute right-0 top-8 z-50 w-48 py-2 rounded-xl shadow-xl border backdrop-blur-xl animate-fade-in-scale"
      style={{ background: 'rgba(255,255,255,0.95)', borderColor: C.cardBorder }}
      onClick={e => e.stopPropagation()}>
      <div className="px-3 py-1.5 text-xs font-bold truncate" style={{ color: C.textSecondary }}>{track.title}</div>
      <div className="h-px mx-2 my-1" style={{ background: C.cardBorder }} />
      {playlists.length === 0 ? (
        <div className="px-3 py-2 text-xs" style={{ color: C.textSecondary }}>暂无歌单</div>
      ) : playlists.map(pl => (
        <button key={pl.id}
          onClick={() => { addTracksToPlaylist(pl.id, [track.id]); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-pink-50 text-left"
          style={{ color: C.text }}>
          <Plus className="size-3" style={{ color: C.accent1 }} />{pl.name}
        </button>
      ))}
    </div>
  )
}

// ===================================================================
// 🔥 主页面
// ===================================================================
export default function MusicLibraryPage() {
  const sp = useSearchParams()
  const ctx = useMusic()
  const router = useRouter()

  const [view, setView] = useState<View>((sp.get('view') as View) || 'all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('default')
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [coverMap, setCoverMap] = useState<CoverMap>({})
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null)
  const [showCreatePl, setShowCreatePl] = useState(false)
  const [newPlName, setNewPlName] = useState('')
  const [heroExpanded, setHeroExpanded] = useState(true)

  const refresh = useCallback(() => {
    setPlaylists(getPlaylists()); setFavIds(getFavoritedIds())
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const v = sp.get('view')
    if (v && v !== view) setView(v as View)
  }, [sp])
  useEffect(() => { loadCoverMap().then(setCoverMap) }, [])

  const allTracks = (ctx?.playlist || []) as ExtendedTrack[]

  const filteredTracks = useMemo(() => {
    let t = allTracks
    if (view === 'favorites') t = t.filter(x => favIds.has(x.id))
    if (search) {
      const q = search.toLowerCase()
      t = t.filter(x => x.title.toLowerCase().includes(q) || x.artist?.toLowerCase().includes(q) || x.album?.toLowerCase().includes(q))
    }
    switch (sort) {
      case 'title': t = [...t].sort((a,b) => a.title.localeCompare(b.title)); break
      case 'artist': t = [...t].sort((a,b) => (a.artist||'').localeCompare(b.artist||'')); break
      case 'added': t = [...t].sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||'')); break
      case 'year': t = [...t].sort((a,b) => (b.year||0)-(a.year||0)); break
    }
    return t
  }, [allTracks, view, search, sort, favIds])

  const albums = useMemo(() => {
    const g = groupByAlbum(filteredTracks)
    return g.map(x => ({ ...x, coverUrl: x.coverUrl || getCoverUrl(x.albumArtist||'', x.album, coverMap) }))
  }, [filteredTracks, coverMap])

  const artists = useMemo(() => groupByArtist(filteredTracks), [filteredTracks])
  const selectedPlData = selectedPlaylist ? playlists.find(p => p.id === selectedPlaylist) : null
  const playlistTracks = selectedPlData
    ? selectedPlData.trackIds.map(id => allTracks.find(t => t.id === id)).filter(Boolean) as ExtendedTrack[]
    : []

  const currentId = ctx?.currentTrack?.id
  const isPlaying = ctx?.playing

  // ===== handlers =====
  const changeView = (v: View) => {
    setView(v); setSelectedAlbum(null); setSelectedArtist(null); setSelectedPlaylist(null); setHeroExpanded(v === 'all')
    router.replace(`/music?view=${v}`, { scroll: false })
  }

  const playTrack = (id: string) => {
    const idx = allTracks.findIndex(t => t.id === id)
    if (idx >= 0) ctx?.play(idx)
  }

  // ===== Track row =====
  const TrackRow = ({ track, i, plId }: { track: ExtendedTrack; i: number; plId?: string }) => {
    const isCur = track.id === currentId
    const isPlay = isCur && isPlaying
    const isFav = favIds.has(track.id)
    const showMenu = menuTrackId === track.id
    return (
      <div
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200',
          'hover:shadow-sm',
        )}
        style={{
          background: isCur ? C.activeTrack : 'transparent',
          color: C.text,
        }}
        onClick={() => playTrack(track.id)}
      >
        {/* # / playing indicator */}
        <div className="w-7 shrink-0 text-center">
          {isPlay ? (
            <EQBar playing size="sm" color={C.accent1} />
          ) : (
            <span className={cn('text-xs font-mono font-bold', isCur ? 'text-pink-500' : '')} style={{ color: isCur ? C.accent1 : C.textSecondary }}>
              {isCur ? '▶' : (i + 1)}
            </span>
          )}
        </div>
        {/* Art */}
        <AlbumArt album={track.album || track.artist || track.title} size="sm" coverUrl={getCoverUrl(track.artist||'', track.album, coverMap)} />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm truncate', isCur && 'font-bold')}>{track.title}</div>
          <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: C.textSecondary }}>
            {track.artist && <span className="truncate">{track.artist}</span>}
            {track.album && view === 'all' && <><span>·</span><span className="truncate">{track.album}</span></>}
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {plId && (
            <button onClick={e => { e.stopPropagation(); removeTrackFromPlaylist(plId, track.id); refresh() }}
              className="p-1.5 rounded-full hover:bg-rose-50 transition-colors" title="移除">
              <X className="size-3" style={{ color: '#f43f5e' }} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); toggleFavorite(track.id); setFavIds(getFavoritedIds()) }}
            className="p-1.5 rounded-full hover:bg-pink-50 transition-all" title={isFav ? '取消收藏' : '收藏'}>
            <Heart className={cn('size-3.5', isFav && 'fill-current')} style={{ color: isFav ? '#f43f5e' : C.textSecondary }} />
          </button>
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setMenuTrackId(showMenu ? null : track.id) }}
              className="p-1.5 rounded-full hover:bg-purple-50 transition-colors">
              <MoreHorizontal className="size-3.5" style={{ color: C.textSecondary }} />
            </button>
            {showMenu && <TrackActions track={track} onClose={() => setMenuTrackId(null)} />}
          </div>
        </div>
      </div>
    )
  }

  // ===== 视图渲染 =====

  const renderAll = () => (
    <>
      {/* Hero: Now Playing */}
      {ctx?.currentTrack && heroExpanded && (
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 mb-8"
          style={{
            background: 'linear-gradient(135deg, #fdf2f8, #ede9fe, #ecfeff)',
            border: '1px solid rgba(236,72,153,0.1)',
          }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-20 -right-20 size-80 rounded-full" style={{ background: `radial-gradient(circle, ${C.accent1}, transparent)` }} />
            <div className="absolute -bottom-20 -left-20 size-80 rounded-full" style={{ background: `radial-gradient(circle, ${C.accent2}, transparent)` }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-60 rounded-full" style={{ background: `radial-gradient(circle, ${C.accent3}, transparent)` }} />
          </div>
          <div className="relative flex items-center gap-6">
            <div className={cn('shrink-0 transition-transform duration-500', isPlaying && 'animate-spin-slow')}>
              <div className="size-16 sm:size-24 rounded-full ring-4 ring-white/50 shadow-xl overflow-hidden">
                <AlbumArt album={ctx.currentTrack.title} size="lg"
                  coverUrl={getCoverUrl(ctx.currentTrack.artist||'', ctx.currentTrack.album, coverMap)} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: C.accent1 }}>正在播放</span>
                {isPlaying && <EQBar playing size="md" color={C.accent1} />}
              </div>
              <h2 className="text-lg sm:text-2xl font-black truncate" style={{ color: C.text }}>{ctx.currentTrack.title}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: C.textSecondary }}>
                {ctx.currentTrack.artist && <span>{ctx.currentTrack.artist}</span>}
                {ctx.currentTrack.album && <><span>·</span><span>{ctx.currentTrack.album}</span></>}
              </div>
            </div>
            <button onClick={() => setHeroExpanded(false)}
              className="shrink-0 p-2 rounded-full transition-colors hover:bg-white/50" title="收起">
              <X className="size-4" style={{ color: C.textSecondary }} />
            </button>
          </div>
        </div>
      )}

      {/* List header */}
      <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
        <span className="w-7 text-center">#</span>
        <span className="w-10" />
        <span className="flex-1">歌曲</span>
      </div>
      <div className="space-y-0.5">
        {filteredTracks.map((t, i) => <TrackRow key={t.id} track={t} i={i} />)}
      </div>
      {filteredTracks.length === 0 && (
        <div className="text-center py-20">
          <Music2 className="size-16 mx-auto mb-4" style={{ color: C.textSecondary, opacity: 0.15 }} />
          <p className="text-sm font-bold" style={{ color: C.textSecondary }}>
            {search ? '没有匹配的歌曲' : '还没有音乐'}
          </p>
        </div>
      )}
    </>
  )

  const renderAlbums = () => {
    if (selectedAlbum) {
      const a = albums.find(x => x.album === selectedAlbum)
      if (!a) return null
      return (
        <div className="space-y-6">
          <button onClick={() => setSelectedAlbum(null)}
            className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" style={{ color: C.accent2 }}>
            <ArrowUpRight className="size-3 rotate-180" />返回
          </button>
          <div className="flex items-end gap-6 pb-6 border-b" style={{ borderColor: C.cardBorder }}>
            <AlbumArt album={a.album} size="lg" coverUrl={a.coverUrl} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-4xl font-black mb-1" style={{ color: C.text }}>{a.album}</h1>
              {a.albumArtist && <p className="text-sm font-medium" style={{ color: C.textSecondary }}>{a.albumArtist}</p>}
              <p className="text-xs mt-2" style={{ color: C.textSecondary }}>{a.trackCount} 首{a.year ? ` · ${a.year}` : ''}</p>
              <button
                onClick={() => {
                  ctx?.clearPlaylist()
                  setTimeout(() => {
                    ctx?.addTracks(a.tracks)
                    setTimeout(() => ctx?.play(0), 100)
                  }, 50)
                }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:shadow-lg hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`, color: '#fff' }}>
                <Play className="size-4" />播放全部
              </button>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
              <span className="w-7 text-center">#</span><span className="w-10" /><span className="flex-1">歌曲</span>
            </div>
            {a.tracks.map((t, i) => <TrackRow key={t.id} track={t} i={i} />)}
          </div>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
        {albums.map(a => (
          <button key={a.album} onClick={() => setSelectedAlbum(a.album)}
            className="group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}`, backdropFilter: 'blur(8px)' }}>
            <div className="aspect-square relative overflow-hidden bg-pink-50">
              <AlbumArt album={a.album} size="lg" coverUrl={a.coverUrl} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                  <div className="size-12 rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm"
                    style={{ background: `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`, color: '#fff' }}>
                    <Play className="size-5 ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <h3 className="text-sm font-bold truncate" style={{ color: C.text }}>{a.album}</h3>
              <p className="text-xs mt-1 truncate" style={{ color: C.textSecondary }}>{a.albumArtist || '未知'}</p>
              <p className="text-[10px] mt-1" style={{ color: C.textSecondary }}>{a.trackCount} 首{a.year ? ` · ${a.year}` : ''}</p>
            </div>
          </button>
        ))}
        {albums.length === 0 && (
          <div className="col-span-full text-center py-20">
            <Disc3 className="size-14 mx-auto mb-4" style={{ color: C.textSecondary, opacity: 0.15 }} />
            <p className="text-sm font-bold" style={{ color: C.textSecondary }}>暂无专辑</p>
          </div>
        )}
      </div>
    )
  }

  const renderArtists = () => {
    if (selectedArtist) {
      const ar = artists.find(x => x.artist === selectedArtist)
      if (!ar) return null
      return (
        <div className="space-y-6">
          <button onClick={() => setSelectedArtist(null)}
            className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" style={{ color: C.accent2 }}>
            <ArrowUpRight className="size-3 rotate-180" />返回
          </button>
          <div className="flex items-end gap-6 pb-6 border-b" style={{ borderColor: C.cardBorder }}>
            <div className="size-20 sm:size-28 rounded-full flex items-center justify-center text-2xl sm:text-4xl font-black shadow-lg shrink-0"
              style={{ background: `linear-gradient(135deg, hsl(${ar.artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 80%), hsl(${(ar.artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360 + 50) % 360}, 60%, 85%))`, color: `hsl(${ar.artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 50%, 25%)` }}>
              {ar.artist.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-4xl font-black mb-1" style={{ color: C.text }}>{ar.artist}</h1>
              <p className="text-xs mt-1" style={{ color: C.textSecondary }}>{ar.albumCount} 专辑 · {ar.trackCount} 首</p>
              <button
                onClick={() => {
                  ctx?.clearPlaylist()
                  setTimeout(() => {
                    ctx?.addTracks(ar.tracks)
                    setTimeout(() => ctx?.play(0), 100)
                  }, 50)
                }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:shadow-lg hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`, color: '#fff' }}>
                <Play className="size-4" />播放全部
              </button>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
              <span className="w-7 text-center">#</span><span className="w-10" /><span className="flex-1">歌曲</span>
            </div>
            {ar.tracks.map((t, i) => <TrackRow key={t.id} track={t} i={i} />)}
          </div>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
        {artists.map(ar => {
          const h = ar.artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
          return (
            <button key={ar.artist} onClick={() => setSelectedArtist(ar.artist)}
              className="group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
              <div className="p-5 sm:p-6 flex flex-col items-center">
                <div className="size-16 sm:size-20 rounded-full flex items-center justify-center text-xl sm:text-2xl font-black mb-3 shadow-md"
                  style={{ background: `linear-gradient(135deg, hsl(${h}, 70%, 80%), hsl(${(h+50)%360}, 60%, 85%))`, color: `hsl(${h}, 50%, 25%)` }}>
                  {ar.artist.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-sm font-bold text-center truncate w-full" style={{ color: C.text }}>{ar.artist}</h3>
                <p className="text-xs mt-1" style={{ color: C.textSecondary }}>{ar.albumCount} 专辑 · {ar.trackCount} 首</p>
              </div>
              <div className="px-4 pb-4 max-h-28 overflow-y-auto space-y-0.5">
                {ar.tracks.slice(0, 5).map(t => (
                  <button key={t.id} onClick={e => { e.stopPropagation(); playTrack(t.id) }}
                    className="w-full text-left truncate py-1 text-xs transition-colors hover:opacity-80" style={{ color: C.textSecondary }}>
                    {t.title}
                  </button>
                ))}
              </div>
            </button>
          )
        })}
        {artists.length === 0 && (
          <div className="col-span-full text-center py-20">
            <MicVocal className="size-14 mx-auto mb-4" style={{ color: C.textSecondary, opacity: 0.15 }} />
            <p className="text-sm font-bold" style={{ color: C.textSecondary }}>暂无歌手</p>
          </div>
        )}
      </div>
    )
  }

  const renderPlaylists = () => {
    if (selectedPlaylist) {
      const pl = selectedPlData
      if (!pl) return null
      return (
        <div className="space-y-4">
          <button onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" style={{ color: C.accent2 }}>
            <ArrowUpRight className="size-3 rotate-180" />返回
          </button>
          <div className="flex items-center gap-4 pb-4 border-b" style={{ borderColor: C.cardBorder }}>
            <div className="size-14 rounded-2xl flex items-center justify-center text-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${C.accent1}33, ${C.accent2}22)` }}>
              <ListMusic className="size-6" style={{ color: C.accent1 }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black" style={{ color: C.text }}>{pl.name}</h2>
              <p className="text-xs mt-1" style={{ color: C.textSecondary }}>{pl.trackIds.length} 首</p>
            </div>
            <button onClick={() => { if (confirm('删除此歌单？')) { deletePlaylist(pl.id); refresh(); setSelectedPlaylist(null) } }}
              className="p-2 rounded-full hover:bg-rose-50 transition-colors"><Trash2 className="size-4" style={{ color: '#f43f5e' }} /></button>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
              <span className="w-7 text-center">#</span><span className="w-10" /><span className="flex-1">歌曲</span>
            </div>
            {playlistTracks.map((t, i) => <TrackRow key={t.id} track={t} i={i} plId={pl.id} />)}
            {playlistTracks.length === 0 && (
              <div className="text-center py-12"><p className="text-sm" style={{ color: C.textSecondary }}>歌单为空</p></div>
            )}
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {showCreatePl ? (
          <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
            <input autoFocus value={newPlName} onChange={e => setNewPlName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newPlName.trim() && (() => { createPlaylist(newPlName.trim()); setNewPlName(''); setShowCreatePl(false); refresh() })()}
              placeholder="歌单名称..." className="flex-1 bg-transparent text-sm font-medium outline-none" style={{ color: C.text }} />
            <button onClick={() => { if (newPlName.trim()) { createPlaylist(newPlName.trim()); setNewPlName(''); setShowCreatePl(false); refresh() } }}
              className="px-4 py-1.5 text-xs font-bold rounded-full transition-all hover:shadow-md"
              style={{ background: `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`, color: '#fff' }}>创建</button>
            <button onClick={() => { setShowCreatePl(false); setNewPlName('') }}
              className="px-3 py-1.5 text-xs rounded-full hover:bg-white/50" style={{ color: C.textSecondary }}>取消</button>
          </div>
        ) : (
          <button onClick={() => setShowCreatePl(true)}
            className="flex items-center gap-2 w-full p-4 rounded-2xl border-2 border-dashed transition-all hover:shadow-md"
            style={{ borderColor: C.cardBorder, color: C.textSecondary }}>
            <Plus className="size-4" /><span className="text-sm font-bold">创建歌单</span>
          </button>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {playlists.map(pl => {
            const h = pl.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
            return (
              <button key={pl.id} onClick={() => setSelectedPlaylist(pl.id)}
                className="group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
                <div className="aspect-square flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, hsl(${h}, 70%, 80%), hsl(${(h+50)%360}, 60%, 85%))` }}>
                  <ListMusic className="size-12 opacity-60" style={{ color: `hsl(${h}, 50%, 30%)` }} />
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="text-sm font-bold truncate" style={{ color: C.text }}>{pl.name}</h3>
                  <p className="text-xs mt-1" style={{ color: C.textSecondary }}>{pl.trackIds.length} 首</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderFavorites = () => {
    const favTracks = allTracks.filter(t => favIds.has(t.id))
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 pb-4 mb-2 border-b" style={{ borderColor: C.cardBorder }}>
          <Heart className="size-5 fill-current" style={{ color: '#f43f5e' }} />
          <div>
            <h2 className="text-lg font-black" style={{ color: C.text }}>我的收藏</h2>
            <p className="text-xs" style={{ color: C.textSecondary }}>{favTracks.length} 首</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
          <span className="w-7 text-center">#</span><span className="w-10" /><span className="flex-1">歌曲</span>
        </div>
        <div className="space-y-0.5">
          {favTracks.map((t, i) => <TrackRow key={t.id} track={t} i={i} />)}
        </div>
        {favTracks.length === 0 && (
          <div className="text-center py-20">
            <Heart className="size-14 mx-auto mb-4" style={{ color: C.textSecondary, opacity: 0.15 }} />
            <p className="text-sm font-bold" style={{ color: C.textSecondary }}>还没有收藏的歌曲</p>
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

  // ===== 页面结构 =====
  return (
    <div className="min-h-screen" style={{ background: C.bgGradient }}>
      {/* 🎯 Floating header — one row */}
      <div className="sticky top-0 z-20 pt-2 sm:pt-3 pb-2 px-4 sm:px-6 md:px-8"
        style={{ background: 'rgba(250,245,255,0.8)', backdropFilter: 'blur(12px)' }}>

        {/* Single row: stats | nav (centered) | search+sort */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">

          {/* Stats — left */}
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold shrink-0" style={{ color: C.textSecondary }}>
            <span>{allTracks.length}首</span>
            <span className="w-1 h-1 rounded-full" style={{ background: C.accent1, opacity: 0.3 }} />
            <span className="hidden sm:inline">{albums.length}专</span>
            <span className="hidden sm:inline w-1 h-1 rounded-full" style={{ background: C.accent2, opacity: 0.3 }} />
            <span className="hidden sm:inline">{artists.length}歌手</span>
          </div>

          {/* Nav pills — center (takes remaining space) */}
          <div className="flex-1 flex justify-center">
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {NAV_TABS.map(tab => (
                <button key={tab.id} onClick={() => changeView(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0',
                    view === tab.id ? 'shadow-sm' : 'hover:bg-white/50'
                  )}
                  style={{
                    background: view === tab.id
                      ? `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`
                      : 'rgba(255,255,255,0.4)',
                    color: view === tab.id ? '#fff' : C.textSecondary,
                  }}>
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'favorites' && favIds.size > 0 && (
                    <span className="text-[9px] font-mono ml-0.5 opacity-80">{favIds.size}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Sort — right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative" style={{ color: C.textSecondary }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索..." className="w-28 sm:w-36 pl-8 pr-2 py-1.5 rounded-full text-[11px] font-medium outline-none transition-all border"
                style={{ background: C.surface, borderColor: 'rgba(0,0,0,0.06)', color: C.text }} />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-2.5" /></button>}
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
              className="text-[11px] font-bold bg-transparent outline-none cursor-pointer px-2 py-1.5 rounded-full transition-colors hover:bg-white/50"
              style={{ color: C.textSecondary, border: '1px solid rgba(0,0,0,0.06)' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: C.bg }}>{o.label}</option>)}
            </select>
          </div>

        </div>
      </div>

      {/* Content */}
      <main className="px-4 sm:px-6 md:px-8 pb-28 md:pb-36 animate-fade-in">
        <div className="max-w-6xl mx-auto pt-4">
          {renderContent()}
        </div>
      </main>

      {/* Floating mini-player indicator */}
      {ctx && ctx.playlist.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30">
          <div
            className={cn(
              'px-4 py-2 rounded-full shadow-lg backdrop-blur-xl flex items-center gap-3 transition-all duration-300',
              'hover:shadow-xl cursor-pointer'
            )}
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.06)' }}
            onClick={() => {
              // Find and click the MiniPlayer's floating button
              const btn = document.querySelector('[data-miniplayer-toggle]') as HTMLButtonElement
              btn?.click()
            }}
          >
            {isPlaying ? (
              <span className="flex items-center gap-2">
                <EQBar playing size="sm" color={C.accent1} />
                <span className="text-xs font-bold truncate max-w-24" style={{ color: C.text }}>
                  {ctx.currentTrack?.title || '播放中'}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Music2 className="size-3.5" style={{ color: C.accent1 }} />
                <span className="text-xs font-bold" style={{ color: C.textSecondary }}>
                  {ctx.playlist.length} 首
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ambient decorative blobs */}
      <div className="fixed pointer-events-none -z-10 inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 size-96 rounded-full mix-blend-multiply animate-float-slow"
          style={{ background: `radial-gradient(circle, ${C.accent1}40, transparent)` }} />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full mix-blend-multiply animate-float-slow"
          style={{ background: `radial-gradient(circle, ${C.accent2}30, transparent)`, animationDelay: '-3s' }} />
        <div className="absolute top-1/3 left-1/2 size-64 rounded-full mix-blend-multiply animate-float-slow"
          style={{ background: `radial-gradient(circle, ${C.accent3}20, transparent)`, animationDelay: '-6s' }} />
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-3deg); }
        }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes eq-bar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .eq-bar { animation: eq-bar 0.6s ease-in-out infinite; transform-origin: bottom; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}
