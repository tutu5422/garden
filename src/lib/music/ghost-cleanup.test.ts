import { describe, it, expect, vi } from 'vitest'
import { pruneGhostTracks, signPaths, findMissingPaths, type GhostTrack } from './ghost-cleanup'

/* 构造一个按路径返回状态的 fetch 替身 */
function makeFetch(opts: {
  signStatus?: number
  signBody?: unknown
  head?: Record<string, number>       // 签名 URL → 状态码
  throwOnHead?: string[]              // 这些路径 HEAD 抛异常
  throwOnSign?: boolean
}) {
  const calls: { url: string; method: string }[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    calls.push({ url, method })
    if (url.endsWith('/api/storage/sign')) {
      if (opts.throwOnSign) throw new Error('network')
      const status = opts.signStatus ?? 200
      return { ok: status >= 200 && status < 300, status, json: async () => opts.signBody ?? {} } as Response
    }
    for (const p of opts.throwOnHead || []) if (url.includes(encodeURI(p))) throw new Error('boom')
    const status = opts.head?.[url] ?? 200
    return { ok: status < 400, status } as Response
  }) as unknown as typeof fetch
  return { impl, calls }
}

const T = (id: string, path?: string, title?: string): GhostTrack => ({ id, storagePath: path, title })

describe('pruneGhostTracks', () => {
  it('云端未知（cloudCount<=0）时绝不动本地数据', async () => {
    const { impl, calls } = makeFetch({})
    const tracks = [T('a', 'music/a/a.mp3'), T('b', 'music/b/b.mp3')]
    const r = await pruneGhostTracks(tracks, new Set(['a']), 0, impl)
    expect(r.tracks).toBe(tracks)
    expect(r.removed).toEqual([])
    expect(calls).toHaveLength(0)      // 连签发都没发
  })

  it('本地独有条目文件仍在（200）→ 保留', async () => {
    const tracks = [T('a', 'music/a/a.mp3'), T('local', 'music/l/l.mp3')]
    const { impl } = makeFetch({
      signBody: { urls: { 'music/l/l.mp3': 'https://storage.minitu.online/storage/music/l/l.mp3?e=1&s=x' } },
      head: { 'https://storage.minitu.online/storage/music/l/l.mp3?e=1&s=x': 200 },
    })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 1, impl)
    expect(r.tracks).toHaveLength(2)
    expect(r.removed).toEqual([])
  })

  it('本地独有条目 404 → 清除', async () => {
    const tracks = [T('a', 'music/a/a.mp3'), T('ghost', 'music/Sound Of Silence/Sound Of Silence.mp3', 'Sound Of Silence')]
    const { impl } = makeFetch({
      signBody: { urls: { 'music/Sound Of Silence/Sound Of Silence.mp3': 'SIGNED1' } },
      head: { SIGNED1: 404 },
    })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 1, impl)
    expect(r.tracks.map((t) => t.id)).toEqual(['a'])
    expect(r.removed.map((t) => t.title)).toEqual(['Sound Of Silence'])
  })

  it('云端已知的条目不会被探测，即使它 404', async () => {
    const tracks = [T('cloud1', 'music/c/c.mp3')]
    const { impl, calls } = makeFetch({ signBody: { urls: {} } })
    const r = await pruneGhostTracks(tracks, new Set(['cloud1']), 1, impl)
    expect(r.tracks).toBe(tracks)
    expect(calls.filter((c) => c.method === 'HEAD')).toHaveLength(0)
  })

  it('没有 storagePath 的本地条目跳过（无法判定）', async () => {
    const tracks = [T('a', 'music/a/a.mp3'), T('local-nopath', undefined, '未命名')]
    const { impl, calls } = makeFetch({ signBody: { urls: {} } })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 1, impl)
    expect(r.tracks).toHaveLength(2)
    expect(calls.some((c) => c.url.endsWith('/api/storage/sign'))).toBe(false)
  })

  it('403/410/500 一律保留（只认 404 为失效）', async () => {
    const tracks = [
      T('a', 'music/a/a.mp3'),
      T('g403', 'music/g403/x.mp3'),
      T('g410', 'music/g410/x.mp3'),
      T('g500', 'music/g500/x.mp3'),
      T('gone', 'music/gone/x.mp3'),
    ]
    const { impl } = makeFetch({
      signBody: { urls: {
        'music/g403/x.mp3': 'U403', 'music/g410/x.mp3': 'U410',
        'music/g500/x.mp3': 'U500', 'music/gone/x.mp3': 'UGONE',
      } },
      head: { U403: 403, U410: 410, U500: 500, UGONE: 404 },
    })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 1, impl)
    expect(r.tracks.map((t) => t.id)).toEqual(['a', 'g403', 'g410', 'g500'])
    expect(r.removed.map((t) => t.id)).toEqual(['gone'])
  })

  it('HEAD 网络异常 → 保留', async () => {
    const tracks = [T('a', 'music/a/a.mp3'), T('local', 'music/l/l.mp3')]
    const { impl } = makeFetch({
      signBody: { urls: { 'music/l/l.mp3': 'UNREACHABLE' } },
      throwOnHead: ['music/l/l.mp3'],
    })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 1, impl)
    expect(r.tracks).toHaveLength(2)
  })

  it('签发接口失败 → 整体放弃清理', async () => {
    const tracks = [T('a', 'music/a/a.mp3'), T('local', 'music/l/l.mp3')]
    const { impl } = makeFetch({ signStatus: 500 })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 1, impl)
    expect(r.tracks).toBe(tracks)
    expect(r.removed).toEqual([])
  })

  it('多条幽灵一次清掉（本次线上那两条的场景）', async () => {
    const tracks = [
      T('a', 'music/a/a.mp3'),
      T('old-sos', 'music/Sound Of Silence/Sound Of Silence.mp3', 'Sound Of Silence'),
      T('old-unnamed', 'music/fc73bd3e-670e-4d49-9ae3-17c956eb52b9/fc73bd3e-670e-4d49-9ae3-17c956eb52b9.ogg', '未命名-fc73bd3e'),
    ]
    const { impl } = makeFetch({
      signBody: { urls: {
        'music/Sound Of Silence/Sound Of Silence.mp3': 'U1',
        'music/fc73bd3e-670e-4d49-9ae3-17c956eb52b9/fc73bd3e-670e-4d49-9ae3-17c956eb52b9.ogg': 'U2',
      } },
      head: { U1: 404, U2: 404 },
    })
    const r = await pruneGhostTracks(tracks, new Set(['a']), 203, impl)
    expect(r.tracks.map((t) => t.id)).toEqual(['a'])
    expect(r.removed).toHaveLength(2)
  })
})

describe('signPaths', () => {
  it('path 为空 → 不发请求，返回空表', async () => {
    const f = vi.fn() as unknown as typeof fetch
    expect(await signPaths([], f)).toEqual({})
    expect(f).not.toHaveBeenCalled()
  })

  it('去重后按上限截断', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ urls: {} }) })) as unknown as typeof fetch
    await signPaths(['a', 'a', 'b'], f)
    const body = JSON.parse((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string)
    expect(body.paths).toEqual(['a', 'b'])
  })
})

describe('findMissingPaths', () => {
  it('没有签名 URL 的路径不算失效', async () => {
    const f = vi.fn() as unknown as typeof fetch
    const r = await findMissingPaths(['a'], {}, f)
    expect(r.size).toBe(0)
    expect(f).not.toHaveBeenCalled()
  })
})
