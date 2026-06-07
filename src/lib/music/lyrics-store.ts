'use client'

// ========== 歌词存储 — localStorage ==========
// key: minitu_lyrics
// value: { [trackId: string]: LyricsData }

export interface LyricsData {
  lyrics: string
  syncedLyrics?: string  // 原始 LRC 格式（含时间戳），用于逐行同步
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

// 清除并重新搜索歌词
export async function refreshLyrics(trackId: string, title: string, artist?: string): Promise<LyricsData | null> {
  deleteLyrics(trackId)
  return searchAndCacheLyrics(trackId, title, artist)
}

// ========== LRC 解析工具 ==========

export interface LRCLine {
  time: number   // 秒
  text: string
}

// 解析 LRC 格式为按时间排序的歌词行数组
export function parseLRC(lrc: string): LRCLine[] {
  const lines = lrc.split('\n')
  const timeTagRe = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g
  const result: LRCLine[] = []

  for (const line of lines) {
    const tags: Array<{ min: number; sec: number; ms: number }> = []
    let match: RegExpExecArray | null
    timeTagRe.lastIndex = 0

    while ((match = timeTagRe.exec(line)) !== null) {
      tags.push({
        min: parseInt(match[1], 10),
        sec: parseInt(match[2], 10),
        ms: parseInt(match[3], 10),
      })
    }

    if (tags.length === 0) continue

    // 提取时间标签之后的文本（去掉所有时间标签 + 元数据标签）
    let text = line.replace(timeTagRe, '').trim()
    // 跳过元数据行
    if (!text || text.startsWith('ti:') || text.startsWith('ar:') ||
        text.startsWith('al:') || text.startsWith('by:') ||
        text.startsWith('offset:') || text.startsWith('length:')) {
      continue
    }

    for (const t of tags) {
      const timeInSeconds = t.min * 60 + t.sec + t.ms / (t.ms > 99 ? 1000 : 100)
      result.push({ time: timeInSeconds, text })
    }
  }

  result.sort((a, b) => a.time - b.time)
  return result
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
    const result: LyricsData = {
      lyrics: data.lyrics,
      artist: data.artist || artist,
      album: data.album,
      source: 'searched',
      searchedAt: Date.now(),
    }
    // 保留服务端返回的同步歌词
    if (data.syncedLyrics) {
      result.syncedLyrics = data.syncedLyrics
    }
    return result
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

// 解析文件名提取标题和歌手
export function parseFilename(filename: string): { title: string; artist?: string } {
  // 常见格式: "Artist - Title" / "Artist — Title" / "Artist_Title"
  const patterns = [
    /^(.+?)\s*[-–—]\s*(.+)$/,
    /^(.+?)_(.+)$/,
  ]
  for (const p of patterns) {
    const m = filename.match(p)
    if (m) {
      const a = m[1].trim()
      const b = m[2].trim()
      // 约定：默认左侧为歌手、右侧为标题（Artist - Title 是通行惯例）
      // 除非右侧明显比左侧短且右侧无空格（更像是歌手缩写）
      if (b.length < a.length && !b.includes(' ') && a.includes(' ')) {
        return { title: a, artist: b }
      }
      return { title: b, artist: a }
    }
  }
  return { title: filename }
}
