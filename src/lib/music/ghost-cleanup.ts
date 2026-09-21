/**
 * 本地幽灵曲目清理（只动本地，绝不推云端）
 *
 * 背景：音乐页显示的数据 = 云端快照 ∪ 本地 localStorage（见 MusicContext.mergeCloudTracks）。
 * 某台设备的本地列表若留着「云端已删」的旧条目（id 与云端不同），它会被一直追加显示、
 * 刷新也只会把并集写回本地，于是永不消失。实测：用户看到 #204「Sound Of Silence」、
 * #205「未命名-fc73bd3e」，云端与磁盘都已没有这两条。
 *
 * 保守策略（避免误删用户数据）：
 *  - 只处理「云端没有」的本地独有条目；云端已知的一律以云端为准，不探也不动
 *  - 只有**确认取不到文件**（带签名 HEAD 得 404）才丢；403/410/5xx/网络异常一律保留
 *    （签名过期或服务抖动不能当失效）
 *  - 云端拉取失败（返回 null → 传进来的 cloudCount <= 0）时完全不清理，避免离线清空本地列表
 *  - 只写本地 localStorage，不调用任何写云端接口
 */

/** 参与清理判断的最小结构 */
export interface GhostTrack {
  id: string
  title?: string
  storagePath?: string
}

export interface GhostCleanupResult<T> {
  /** 清理后的列表 */
  tracks: T[]
  /** 被判定失效并移除的条目 */
  removed: T[]
}

/** 单次探测上限（/api/storage/sign 每次最多 500 个，留出余量） */
export const GHOST_PROBE_LIMIT = 200

/**
 * 把 storagePath 批量换成带签名的读 URL。
 * 返回 null = 签发失败（调用方应放弃本次清理）。
 */
export async function signPaths(
  paths: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, string> | null> {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p))).slice(0, GHOST_PROBE_LIMIT)
  if (list.length === 0) return {}
  try {
    const res = await fetchImpl('/api/storage/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: list }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { urls?: Record<string, string> }
    if (!data || typeof data.urls !== 'object' || data.urls === null) return null
    return data.urls
  } catch {
    return null
  }
}

/** 探测哪些路径确实不存在（只有 404 算失效；其余状态码/网络错误都当“还在”） */
export async function findMissingPaths(
  paths: string[],
  urls: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<Set<string>> {
  const missing = new Set<string>()
  await Promise.all(Array.from(new Set(paths)).map(async (p) => {
    const u = urls[p]
    if (!u) return
    try {
      const res = await fetchImpl(u, { method: 'HEAD' })
      if (res.status === 404) missing.add(p)
    } catch {
      /* 网络异常 → 保留 */
    }
  }))
  return missing
}

/**
 * 清理本地幽灵条目。
 * @param cloudCount 云端拉到的条数；<= 0 表示云端状态未知，直接跳过（不做任何清理）
 */
export async function pruneGhostTracks<T extends GhostTrack>(
  tracks: T[],
  cloudIds: Set<string>,
  cloudCount: number,
  fetchImpl: typeof fetch = fetch,
): Promise<GhostCleanupResult<T>> {
  const unchanged: GhostCleanupResult<T> = { tracks, removed: [] }
  if (cloudCount <= 0 || tracks.length === 0) return unchanged

  const candidates = tracks.filter((t) => !cloudIds.has(t.id) && !!t.storagePath)
  if (candidates.length === 0) return unchanged

  const paths = candidates.map((t) => t.storagePath as string)
  const urls = await signPaths(paths, fetchImpl)
  if (!urls) return unchanged

  const missing = await findMissingPaths(paths, urls, fetchImpl)
  if (missing.size === 0) return unchanged

  return {
    tracks: tracks.filter((t) => !(t.storagePath && missing.has(t.storagePath))),
    removed: tracks.filter((t) => !!(t.storagePath && missing.has(t.storagePath))),
  }
}
