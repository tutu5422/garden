'use client'

/**
 * ===== 音乐库存储层 =====
 *
 * 管理:
 *   - 歌曲元数据（扩展 Track）
 *   - 自定义歌单 (Playlist)
 *   - 收藏状态
 *   - 专辑/艺术家自动聚合
 *
 * 存储: localStorage + VPS 同步
 */

import type { Track } from './MusicContext'

// ===== 类型定义 =====

export interface ExtendedTrack extends Track {
  favorited?: boolean
  addedAt?: string
  trackNumber?: number
  discNumber?: number
  albumArtist?: string
  genre?: string
  year?: number
  coverUrl?: string  // 专辑封面 URL（后续上传用）
}

export interface MusicPlaylist {
  id: string
  name: string
  description?: string
  coverUrl?: string
  trackIds: string[]
  createdAt: string
  updatedAt: string
}

export interface AlbumGroup {
  album: string
  albumArtist?: string
  year?: number
  coverUrl?: string
  tracks: ExtendedTrack[]
  trackCount: number
}

export interface ArtistGroup {
  artist: string
  tracks: ExtendedTrack[]
  albumCount: number
  trackCount: number
}

// ===== LocalStorage Keys =====

const PLAYLISTS_KEY = 'minitu_music_playlists'
const FAVORITES_KEY = 'minitu_music_favorites'
const TRACK_META_KEY = 'minitu_music_track_meta'  // 扩展元数据 (favorited, coverUrl 等)

// ===== 读取/写入工具 =====

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function writeStore<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* silent */ }
}

// ===== 歌单 CRUD =====

export function getPlaylists(): MusicPlaylist[] {
  return readStore<MusicPlaylist[]>(PLAYLISTS_KEY, [])
}

// ===== 云同步 =====
function syncPlaylistsToCloud() {
  if (typeof window === 'undefined') return
  try {
    const playlists = readStore<MusicPlaylist[]>(PLAYLISTS_KEY, [])
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'music_playlists',
        action: 'upsert',
        data: { playlists, created_at: new Date().toISOString() },
      }),
    }).catch(() => {})
  } catch { /* silent */ }
}

export async function loadPlaylistsFromCloud(): Promise<MusicPlaylist[]> {
  try {
    const res = await fetch('/api/sync?types=playlists', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.musicPlaylists || []
  } catch { return [] }
}

/**
 * 从云端拉取歌单并合并到本地（云端 updatedAt 更新者优先）。
 * 解决"歌单只推不拉"：换浏览器/设备后歌单消失。
 */
export async function refreshPlaylistsFromCloud(): Promise<MusicPlaylist[]> {
  const cloud = await loadPlaylistsFromCloud()
  if (!cloud.length) return getPlaylists()
  const local = getPlaylists()
  const merged = new Map<string, MusicPlaylist>()
  for (const p of local) merged.set(p.id, p)
  for (const c of cloud) {
    const ex = merged.get(c.id)
    if (!ex || !(ex as any).updatedAt || new Date(c.updatedAt) > new Date((ex as any).updatedAt || 0)) {
      merged.set(c.id, c)
    }
  }
  const list = Array.from(merged.values())
  writeStore(PLAYLISTS_KEY, list)
  return list
}

export function createPlaylist(name: string, description?: string): MusicPlaylist {
  const playlists = getPlaylists()
  const now = new Date().toISOString()
  const playlist: MusicPlaylist = {
    id: 'pl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    name,
    description: description || '',
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  }
  playlists.push(playlist)
  writeStore(PLAYLISTS_KEY, playlists)
  syncPlaylistsToCloud()
  return playlist
}

export function updatePlaylist(id: string, updates: Partial<MusicPlaylist>) {
  const playlists = getPlaylists()
  const idx = playlists.findIndex(p => p.id === id)
  if (idx === -1) return
  playlists[idx] = {
    ...playlists[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  writeStore(PLAYLISTS_KEY, playlists)
  syncPlaylistsToCloud()
}

export function deletePlaylist(id: string) {
  const playlists = getPlaylists().filter(p => p.id !== id)
  writeStore(PLAYLISTS_KEY, playlists)
  syncPlaylistsToCloud()
}

export function addTracksToPlaylist(playlistId: string, trackIds: string[]) {
  const playlists = getPlaylists()
  const pl = playlists.find(p => p.id === playlistId)
  if (!pl) return
  const existing = new Set(pl.trackIds)
  const newIds = trackIds.filter(id => !existing.has(id))
  if (newIds.length === 0) return
  pl.trackIds.push(...newIds)
  pl.updatedAt = new Date().toISOString()
  writeStore(PLAYLISTS_KEY, playlists)
  syncPlaylistsToCloud()
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string) {
  const playlists = getPlaylists()
  const pl = playlists.find(p => p.id === playlistId)
  if (!pl) return
  pl.trackIds = pl.trackIds.filter(id => id !== trackId)
  pl.updatedAt = new Date().toISOString()
  writeStore(PLAYLISTS_KEY, playlists)
  syncPlaylistsToCloud()
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]) {
  const playlists = getPlaylists()
  const pl = playlists.find(p => p.id === playlistId)
  if (!pl) return
  pl.trackIds = trackIds
  pl.updatedAt = new Date().toISOString()
  writeStore(PLAYLISTS_KEY, playlists)
  syncPlaylistsToCloud()
}

// ===== 收藏管理 =====

export function getFavoritedIds(): Set<string> {
  const ids = readStore<string[]>(FAVORITES_KEY, [])
  return new Set(ids)
}

export function toggleFavorite(trackId: string): boolean {
  const favs = getFavoritedIds()
  const nowFav = !favs.has(trackId)
  if (nowFav) {
    favs.add(trackId)
  } else {
    favs.delete(trackId)
  }
  writeStore(FAVORITES_KEY, Array.from(favs))
  syncFavoritesToCloud()
  return nowFav
}

// ===== 收藏云同步 =====
function syncFavoritesToCloud() {
  if (typeof window === 'undefined') return
  try {
    const favorites = readStore<string[]>(FAVORITES_KEY, [])
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'music_favorites',
        action: 'upsert',
        data: { favorites, created_at: new Date().toISOString() },
      }),
    }).catch(() => {})
  } catch { /* silent */ }
}

export function isFavorited(trackId: string): boolean {
  return getFavoritedIds().has(trackId)
}

// ===== 聚合查询 =====

/** 按专辑分组 */
export function groupByAlbum(tracks: ExtendedTrack[]): AlbumGroup[] {
  const map = new Map<string, ExtendedTrack[]>()
  for (const t of tracks) {
    const key = t.album || '未知专辑'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return Array.from(map.entries())
    .map(([album, ts]) => ({
      album,
      albumArtist: ts.find(t => t.albumArtist)?.albumArtist || ts.find(t => t.artist)?.artist,
      year: ts.find(t => t.year)?.year,
      coverUrl: ts.find(t => t.coverUrl)?.coverUrl,
      tracks: ts.sort((a, b) => (a.trackNumber || 99) - (b.trackNumber || 99)),
      trackCount: ts.length,
    }))
    .sort((a, b) => {
      // Sort by year desc, then alphabetically
      if (a.year && b.year) return b.year - a.year
      return a.album.localeCompare(b.album, 'zh-CN')
    })
}

/** 按艺术家分组 */
export function groupByArtist(tracks: ExtendedTrack[]): ArtistGroup[] {
  const map = new Map<string, ExtendedTrack[]>()
  for (const t of tracks) {
    const key = t.artist || '未知艺术家'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return Array.from(map.entries())
    .map(([artist, ts]) => ({
      artist,
      tracks: ts,
      albumCount: new Set(ts.map(t => t.album || '')).size,
      trackCount: ts.length,
    }))
    .sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN'))
}

/** 同步收集扩展元数据到 localStorage (供云同步使用) */
export function exportExtendedMeta(tracks: ExtendedTrack[]): Record<string, any> {
  const meta: Record<string, any> = {}
  for (const t of tracks) {
    meta[t.id] = {
      favorited: t.favorited,
      coverUrl: t.coverUrl,
      year: t.year,
      genre: t.genre,
      albumArtist: t.albumArtist,
    }
  }
  return meta
}
