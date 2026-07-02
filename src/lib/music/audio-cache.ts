'use client'

// ========== IndexedDB 音频文件缓存 ==========
// 播放过的音频文件缓存到 IndexedDB，下次播放直接用 blob URL，不再从网络下载

const DB_NAME = 'minitu_audio_cache'
const DB_VERSION = 2
const STORE_NAME = 'audio'
const META_STORE = 'meta' // 元数据：{ key, size, lastAccess }，用于 LRU 淘汰

// LRU 淘汰阈值：200MB
const MAX_CACHE_BYTES = 200 * 1024 * 1024
// 单条目软上限：20MB（超过则不缓存，避免一个超大文件挤掉其他缓存）
const MAX_ENTRY_BYTES = 20 * 1024 * 1024

// key → blobUrl 映射，用于在创建新 blob URL 前 revoke 旧 URL，避免内存泄漏
const blobUrlMap = new Map<string, string>()

interface CacheMeta {
  key: string
  size: number
  lastAccess: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB not available')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getDB(): Promise<IDBDatabase> {
  // Reuse connection if still open
  try { return await openDB() } catch { throw new Error('IndexedDB not available') }
}

/** 创建 blob URL 并登记到 map，若同 key 旧 URL 存在则先 revoke */
function createTrackedBlobUrl(key: string, blob: Blob): string {
  const old = blobUrlMap.get(key)
  if (old) {
    try { URL.revokeObjectURL(old) } catch {}
  }
  const url = URL.createObjectURL(blob)
  blobUrlMap.set(key, url)
  return url
}

/** 释放指定 key 的 blob URL（不删除 IndexedDB 数据） */
export function revokeBlobUrl(key: string) {
  const old = blobUrlMap.get(key)
  if (old) {
    try { URL.revokeObjectURL(old) } catch {}
    blobUrlMap.delete(key)
  }
}

/** 写入元数据 */
function putMeta(db: IDBDatabase, meta: CacheMeta): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).put(meta)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/** 读取所有元数据 */
function getAllMeta(db: IDBDatabase): Promise<CacheMeta[]> {
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const req = tx.objectStore(META_STORE).getAll()
    req.onsuccess = () => resolve((req.result as CacheMeta[]) || [])
    req.onerror = () => resolve([])
  })
}

/** 删除一条缓存（数据 + 元数据） */
function deleteEntry(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.objectStore(META_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/** LRU 淘汰：当总大小超过阈值时删除最旧条目 */
async function evictIfNeeded(db: IDBDatabase, incomingSize: number): Promise<void> {
  try {
    const metas = await getAllMeta(db)
    const total = metas.reduce((s, m) => s + (m.size || 0), 0) + incomingSize
    if (total <= MAX_CACHE_BYTES) return
    // 按 lastAccess 升序，淘汰最旧
    metas.sort((a, b) => a.lastAccess - b.lastAccess)
    let freed = 0
    const toEvict = total - MAX_CACHE_BYTES
    for (const m of metas) {
      if (freed >= toEvict) break
      await deleteEntry(db, m.key)
      revokeBlobUrl(m.key)
      freed += m.size || 0
    }
  } catch { /* best-effort */ }
}

/**
 * 检查指定 key 是否已缓存
 */
export async function isAudioCached(key: string): Promise<boolean> {
  try {
    const db = await getDB()
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getKey(key)
      req.onsuccess = () => resolve(!!req.result)
      req.onerror = () => resolve(false)
      tx.oncomplete = () => { try { db.close() } catch {} }
    })
  } catch { return false }
}

/**
 * 获取缓存的 blob URL；未缓存则返回 null
 */
export async function getCachedAudioUrl(key: string): Promise<string | null> {
  try {
    const db = await getDB()
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => { try { db.close() } catch {} }
    })
    if (blob instanceof Blob) {
      // 更新 lastAccess
      void putMeta(db, { key, size: blob.size, lastAccess: Date.now() }).finally(() => {
        try { db.close() } catch {}
      })
      return createTrackedBlobUrl(key, blob)
    }
    try { db.close() } catch {}
    return null
  } catch { return null }
}

/**
 * 后台下载并缓存音频文件
 * 返回 blob URL（用于即时播放）或 null
 */
export async function cacheAndGetUrl(
  key: string,
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    // 先下载
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const blob = await res.blob()

    // 超大文件不缓存
    if (blob.size > MAX_ENTRY_BYTES) {
      return createTrackedBlobUrl(key, blob)
    }

    // 存入 IndexedDB
    const db = await getDB()
    await evictIfNeeded(db, blob.size)
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, key)
      tx.objectStore(META_STORE).put({ key, size: blob.size, lastAccess: Date.now() } as CacheMeta)
      tx.oncomplete = () => { resolve(); try { db.close() } catch {} }
      tx.onerror = () => { resolve(); try { db.close() } catch {} }
    })

    return createTrackedBlobUrl(key, blob)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    return null
  }
}

/**
 * 后台下载缓存（不返回 URL，纯缓存）
 */
export async function cacheAudioInBackground(
  key: string,
  url: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const alreadyCached = await isAudioCached(key)
    if (alreadyCached) return

    const res = await fetch(url, { signal })
    if (!res.ok) return
    const blob = await res.blob()

    // 超大文件不缓存
    if (blob.size > MAX_ENTRY_BYTES) return

    const db = await getDB()
    await evictIfNeeded(db, blob.size)
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, key)
      tx.objectStore(META_STORE).put({ key, size: blob.size, lastAccess: Date.now() } as CacheMeta)
      tx.oncomplete = () => { resolve(); try { db.close() } catch {} }
      tx.onerror = () => { resolve(); try { db.close() } catch {} }
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    /* best-effort */
  }
}

/**
 * 清空整个音频缓存（数据 + 元数据 + blob URL）
 */
export async function clearAudioCache(): Promise<void> {
  try {
    const db = await getDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.objectStore(META_STORE).clear()
      tx.oncomplete = () => { resolve(); try { db.close() } catch {} }
      tx.onerror = () => { resolve(); try { db.close() } catch {} }
    })
    // revoke 所有 blob URL
    for (const url of blobUrlMap.values()) {
      try { URL.revokeObjectURL(url) } catch {}
    }
    blobUrlMap.clear()
  } catch { /* best-effort */ }
}

/**
 * 获取缓存统计信息（用于 UI 展示）
 */
export async function getCacheStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await getDB()
    const metas = await getAllMeta(db)
    try { db.close() } catch {}
    const totalBytes = metas.reduce((s, m) => s + (m.size || 0), 0)
    return { count: metas.length, totalBytes }
  } catch { return { count: 0, totalBytes: 0 } }
}

/**
 * 获取音频 URL：优先缓存 → 后台缓存（首次）→ 返回可用 URL
 * 这是主要的入口函数
 */
export async function resolveAudioUrl(
  key: string,
  networkUrl: string,
  onCached?: () => void,
  signal?: AbortSignal,
): Promise<string> {
  // 1. 检查缓存
  const cached = await getCachedAudioUrl(key)
  if (cached) {
    onCached?.()
    return cached
  }

  // 2. 首次播放：后台缓存 + 直接用网络 URL
  cacheAudioInBackground(key, networkUrl, signal)
  return networkUrl
}
