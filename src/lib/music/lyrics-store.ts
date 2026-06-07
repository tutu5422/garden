'use client'

// ========== 歌词存储 — localStorage ==========
// key: minitu_lyrics
// value: { [trackId: string]: LyricsData }

export interface LyricsData {
  lyrics: string
  artist?: string
  album?: string
  source: 'searched' | 'manual'
  searchedAt?: number
}

const STORE_KEY = 'minitu_lyrics'

function readStore(): Record<string, LyricsData> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(data: Record<string, LyricsData>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data))
  } catch {
    // storage full — silently fail
  }
}

export function getLyrics(trackId: string): LyricsData | null {
  const store = readStore()
  return store[trackId] || null
}

export function setLyrics(trackId: string, data: LyricsData) {
  const store = readStore()
  store[trackId] = data
  writeStore(store)
}

export function deleteLyrics(trackId: string) {
  const store = readStore()
  delete store[trackId]
  writeStore(store)
}

// ========== 歌词搜索 (调用服务端 API) ==========

export async function searchLyrics(title: string, artist?: string): Promise<LyricsData | null> {
  try {
    const params = new URLSearchParams({ q: title })
    if (artist) params.set('artist', artist)
    const res = await fetch(`/api/lyrics/search?${params.toString()}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.lyrics) return null
    return {
      lyrics: data.lyrics,
      artist: data.artist || artist,
      album: data.album,
      source: 'searched',
      searchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

// 搜索并自动缓存
export async function searchAndCacheLyrics(trackId: string, title: string, artist?: string): Promise<LyricsData | null> {
  // 先检查缓存
  const cached = getLyrics(trackId)
  if (cached) return cached

  const result = await searchLyrics(title, artist)
  if (result) {
    setLyrics(trackId, result)
  }
  return result
}

// 解析文件名尝试提取歌手
export function parseFilename(filename: string): { title: string; artist?: string } {
  // 常见格式: "Artist - Title" / "Title - Artist" / "Artist_Title"
  const patterns = [
    /^(.+?)\s*[-–—]\s*(.+)$/,
    /^(.+?)_(.+)$/,
  ]
  for (const p of patterns) {
    const m = filename.match(p)
    if (m) {
      const a = m[1].trim()
      const b = m[2].trim()
      // 判断哪边更像歌手名（更短的那个通常是歌手）
      if (a.length <= b.length) {
        return { title: b, artist: a }
      }
      return { title: a, artist: b }
    }
  }
  return { title: filename }
}
