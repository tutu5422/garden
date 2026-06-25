import { NextRequest, NextResponse } from 'next/server'
import { apiBadRequest, apiNotFound, apiServerError } from '@/lib/api-error'
import { LYRICS_FETCH_TIMEOUT_MS } from '@/lib/constants/config'

// 使用 lrclib.net 免费歌词 API
// 文档: https://lrclib.net/docs

interface LrcLibResult {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  plainLyrics?: string
  syncedLyrics?: string
}

const UA = 'MiniTu/1.0 (personal music player)'
const FETCH_TIMEOUT = LYRICS_FETCH_TIMEOUT_MS

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const artist = req.nextUrl.searchParams.get('artist')

  if (!q) {
    return apiBadRequest('Missing query parameter: q')
  }

  try {
    let lyrics: string | null = null
    let foundArtist: string | undefined
    let foundAlbum: string | undefined

    // 策略 1：带歌手的精确查询 (lrclib /api/get)
    if (artist) {
      const result = await tryExactMatch(q, artist)
      if (result) {
        return NextResponse.json(result)
      }
      // 精确匹配失败→直接跳到搜索（带歌手打分），不走不带歌手的策略2避免张冠李戴
      const searchResult = await trySearch(q, artist)
      if (searchResult) {
        return NextResponse.json(searchResult)
      }
      return apiNotFound('歌词')
    }

    // 策略 2：不带歌手（仅无artist时使用）
    const exactNoArtist = await tryExactMatch(q)
    if (exactNoArtist) {
      return NextResponse.json(exactNoArtist)
    }

    // 策略 3：搜索 API
    const searchResult = await trySearch(q)
    if (searchResult) {
      return NextResponse.json(searchResult)
    }

    return apiNotFound('歌词')
  } catch (err: any) {
    console.error('Lyrics search error:', err?.message || err)
    return apiServerError(err?.message || 'Search failed')
  }
}

// 策略 1/2：精确匹配
async function tryExactMatch(trackName: string, artistName?: string) {
  try {
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}`
    if (artistName) {
      url += `&artist_name=${encodeURIComponent(artistName)}`
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    })
    if (!res.ok) return null
    const data: LrcLibResult = await res.json()
    const lyricsData = extractLyricsWithSync(data)
    if (!lyricsData) return null
    return {
      ...lyricsData,
      artist: data.artistName || artistName,
      album: data.albumName,
    }
  } catch {
    return null
  }
}

// 策略 3：搜索
async function trySearch(trackName: string, artistName?: string) {
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(trackName)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    })
    if (!res.ok) return null
    const results: LrcLibResult[] = await res.json()
    if (!results?.length) return null

    // 双重打分：标题相似度 + 歌手相似度，选最高分
    const scored = results
      .filter(r => r.plainLyrics || r.syncedLyrics)
      .map(r => {
        const titleScore = similarity(
          (r.trackName || '').toLowerCase(),
          trackName.toLowerCase()
        )
        const artistScore = artistName
          ? similarity(
              (r.artistName || '').toLowerCase(),
              artistName.toLowerCase()
            )
          : 0
        // 标题权重 0.6，歌手权重 0.4；标题精确匹配大幅加分
        const bonus = titleScore > 0.9 ? 0.3 : 0
        return { r, score: titleScore * 0.6 + artistScore * 0.4 + bonus, titleScore, artistScore }
      })
      .sort((a, b) => b.score - a.score)

    if (!scored.length) return null

    // 当指定了歌手时，要求歌手+歌名双达标，避免张冠李戴
    const MIN_TITLE = 0.3
    const MIN_ARTIST = 0.2
    const candidates = artistName
      ? scored.filter(s => s.titleScore >= MIN_TITLE && s.artistScore >= MIN_ARTIST)
      : scored
    if (!candidates.length) return null

    const best = candidates[0].r
    const lyricsData = extractLyricsWithSync(best)
    if (!lyricsData) return null
    return {
      ...lyricsData,
      artist: best.artistName || artistName,
      album: best.albumName,
    }
  } catch {
    return null
  }
}

// 从结果提取纯文本歌词 + 同步歌词
function extractLyricsWithSync(data: LrcLibResult): { lyrics: string; syncedLyrics?: string } | null {
  let plain = data.plainLyrics || null
  let synced = data.syncedLyrics || null

  // 如果有 synced 但没有 plain，从 synced 提取 plain
  if (!plain && synced) {
    plain = extractPlainFromLRC(synced)
  }

  if (!plain) return null

  return { lyrics: plain, syncedLyrics: synced || undefined }
}

// 从 LRC 格式提取纯文本歌词
function extractPlainFromLRC(lrc: string): string {
  const lines = lrc.split('\n')
  const textLines: string[] = []
  const timeTagRegex = /\[\d{2}:\d{2}\.\d{2,3}\]/g

  for (const line of lines) {
    const text = line.replace(timeTagRegex, '').trim()
    if (text && !text.startsWith('[ti:') && !text.startsWith('[ar:') &&
        !text.startsWith('[al:') && !text.startsWith('[by:') &&
        !text.startsWith('[offset:') && !text.startsWith('[length:')) {
      textLines.push(text)
    }
  }

  return textLines.join('\n') || lrc
}

// 简单字符串相似度 (Dice coefficient)
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  // 检查是否一个包含另一个
  if (a.includes(b) || b.includes(a)) return 0.8
  // 双字符 overlap
  const pairs = new Set<string>()
  for (let i = 0; i < a.length - 1; i++) pairs.add(a.slice(i, i + 2))
  let overlap = 0
  for (let i = 0; i < b.length - 1; i++) {
    if (pairs.has(b.slice(i, i + 2))) overlap++
  }
  const total = pairs.size + new Set(b.slice(0, -1).split('').map((_, i) => b.slice(i, i + 2))).size
  return total === 0 ? 0 : (2 * overlap) / total
}
