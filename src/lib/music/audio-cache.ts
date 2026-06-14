'use client'

// ========== IndexedDB 音频文件缓存 ==========
// 播放过的音频文件缓存到 IndexedDB，下次播放直接用 blob URL，不再从网络下载

const DB_NAME = 'minitu_audio_cache'
const DB_VERSION = 1
const STORE_NAME = 'audio'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB not available')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
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
    if (blob instanceof Blob) return URL.createObjectURL(blob)
    return null
  } catch { return null }
}

/**
 * 后台下载并缓存音频文件
 * 返回 blob URL（用于即时播放）或 null
 */
export async function cacheAndGetUrl(key: string, url: string): Promise<string | null> {
  try {
    // 先下载
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()

    // 存入 IndexedDB（不阻塞返回）
    const db = await getDB()
    new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, key)
      tx.oncomplete = () => { resolve(); try { db.close() } catch {} }
      tx.onerror = () => { resolve(); try { db.close() } catch {} }
    })

    return URL.createObjectURL(blob)
  } catch { return null }
}

/**
 * 后台下载缓存（不返回 URL，纯缓存）
 */
export async function cacheAudioInBackground(key: string, url: string): Promise<void> {
  try {
    const alreadyCached = await isAudioCached(key)
    if (alreadyCached) return

    const res = await fetch(url)
    if (!res.ok) return
    const blob = await res.blob()

    const db = await getDB()
    new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, key)
      tx.oncomplete = () => { resolve(); try { db.close() } catch {} }
      tx.onerror = () => { resolve(); try { db.close() } catch {} }
    })
  } catch { /* best-effort */ }
}

/**
 * 获取音频 URL：优先缓存 → 后台缓存（首次）→ 返回可用 URL
 * 这是主要的入口函数
 */
export async function resolveAudioUrl(
  key: string,
  networkUrl: string,
  onCached?: () => void,
): Promise<string> {
  // 1. 检查缓存
  const cached = await getCachedAudioUrl(key)
  if (cached) {
    onCached?.()
    return cached
  }

  // 2. 首次播放：后台缓存 + 直接用网络 URL
  cacheAudioInBackground(key, networkUrl)
  return networkUrl
}
