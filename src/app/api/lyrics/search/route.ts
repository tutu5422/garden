import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const artist = req.nextUrl.searchParams.get('artist')

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  try {
    // 先尝试精确搜索
    let lyrics: string | null = null
    let foundArtist: string | undefined
    let foundAlbum: string | undefined

    if (artist) {
      // 带歌手的精确查询
      const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(q)}&artist_name=${encodeURIComponent(artist)}`
      const exactRes = await fetch(exactUrl, {
        headers: { 'User-Agent': 'MiniTu/1.0 (personal music player)' },
        signal: AbortSignal.timeout(8000),
      })
      if (exactRes.ok) {
        const data: LrcLibResult = await exactRes.json()
        if (data?.plainLyrics) {
          lyrics = data.plainLyrics
          foundArtist = data.artistName
          foundAlbum = data.albumName
        } else if (data?.syncedLyrics) {
          // 从 LRC 格式提取纯文本
          lyrics = extractPlainFromLRC(data.syncedLyrics)
          foundArtist = data.artistName
          foundAlbum = data.albumName
        }
      }
    }

    // 如果没有精确匹配，进行搜索
    if (!lyrics) {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'MiniTu/1.0 (personal music player)' },
        signal: AbortSignal.timeout(8000),
      })
      if (searchRes.ok) {
        const results: LrcLibResult[] = await searchRes.json()
        if (results && results.length > 0) {
          // 取第一个有纯文本歌词的结果
          for (const r of results) {
            if (r.plainLyrics) {
              lyrics = r.plainLyrics
              foundArtist = r.artistName
              foundAlbum = r.albumName
              break
            }
            if (r.syncedLyrics && !lyrics) {
              lyrics = extractPlainFromLRC(r.syncedLyrics)
              foundArtist = r.artistName
              foundAlbum = r.albumName
            }
          }
        }
      }
    }

    if (!lyrics) {
      return NextResponse.json({ error: 'No lyrics found' }, { status: 404 })
    }

    return NextResponse.json({
      lyrics,
      artist: foundArtist,
      album: foundAlbum,
    })
  } catch (err) {
    console.error('Lyrics search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
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
