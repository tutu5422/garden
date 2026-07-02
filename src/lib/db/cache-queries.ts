'use client'

import { getLocalResource, getLocalResourcesFiltered, deleteLocalResources, getLocalCollections, isTombstoned, clearTombstone, cleanStaleTombstones } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'

// 本地缓存 — 避免每次打开笔记都等接口
const CACHE_KEY = 'garden_resource_cache'
function readCache(): Record<string, Resource> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
export function writeCache(resource: Resource) {
  if (typeof window === 'undefined') return
  try {
    const cache = readCache()
    cache[resource.id] = resource
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* quota exceeded, ignore */ }
}

export function getResourceCached(id: string): Resource | null {
  const cache = readCache()
  return cache[id] || getLocalResource(id)
}

/**
 * 暂时只读本地缓存。云端拉取由 CloudSyncProvider 在启动时通过 /api/sync
 * 合并到 localStorage，这里不再直接调用云端。
 */
export async function getResourceHybrid(id: string): Promise<Resource | null> {
  return getResourceCached(id)
}

export async function getResourcesHybrid(params: {
  category?: string; collection?: string; tag?: string
  sort?: string; search?: string; page?: number; pageSize?: number
}): Promise<{ data: Resource[]; count: number }> {
  const result = getLocalResourcesFiltered({ ...params, status: 'active' })

  // 合集筛选 — 本地数据
  if (params.collection) {
    const col = getLocalCollections().find(c => c.title === params.collection || c.id === params.collection)
    if (col) {
      const filtered = result.data.filter(r => col.resourceIds.includes(r.id))
      return { data: filtered, count: filtered.length }
    }
    return { data: [], count: 0 }
  }

  return result
}

// ========== 精选合集混合读取 ==========

export interface CloudCollection {
  id: string
  title: string
  description: string
  coverImage: string
  resourceIds: string[]
  createdAt: string
  updatedAt?: string
}

/**
 * 从云端（VPS，通过 /api/sync 服务端代理）拉取合集并合并到本地 localStorage。
 * 云端数据（updated_at 更新者）优先，本地独有数据保留。
 * 应在应用初始化时调用一次。
 */
export async function syncCollectionsFromCloud(): Promise<void> {
  const localCols = getLocalCollections()

  try {
    const res = await fetch('/api/sync', { method: 'GET' })
    if (!res.ok) return
    const data = await res.json()
    const cloudCols = data.collections || []
    if (!cloudCols.length) return

    // 合并前过滤掉墓碑中的 id，防止云端残留数据复活
    const filteredCloudCols = cloudCols.filter((c: any) => !isTombstoned('collections', c.id))

    // Merge: cloud wins on newer updatedAt
    const merged = new Map<string, any>()
    for (const c of localCols) merged.set(c.id, { ...c })
    for (const c of filteredCloudCols) {
      const existing = merged.get(c.id)
      if (!existing || !(existing as any).updatedAt || new Date(c.updatedAt) > new Date((existing as any).updatedAt || 0)) {
        merged.set(c.id, {
          id: c.id,
          title: c.title,
          description: c.description || '',
          coverImage: c.coverImage || '',
          resourceIds: c.resourceIds || [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })
      }
    }

    // Write back to localStorage
    if (typeof window !== 'undefined') {
      try {
        const mergedList = Array.from(merged.values()).map(c => ({
          id: c.id, title: c.title, description: c.description,
          coverImage: c.coverImage, resourceIds: c.resourceIds, createdAt: c.createdAt,
        }))
        localStorage.setItem('garden_collections', JSON.stringify(mergedList))
      } catch {}
    }
  } catch {
    // silent — local data still available
  }
}

// 批量删除 — 返回失败的 ID 列表
export async function deleteResourcesHybrid(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const failed: string[] = []

  // 本地删除（立即生效，并写墓碑）
  deleteLocalResources(ids)

  // 云端删除（通过 /api/sync 服务端代理）
  for (const id of ids) {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'resources', action: 'delete', data: { id } }),
      })
      if (!res.ok) {
        failed.push(id)
      } else {
        // 云端删除成功，清理墓碑
        clearTombstone('resources', id)
      }
    } catch {
      failed.push(id)
    }
  }
  // 清理过期墓碑
  cleanStaleTombstones('resources')

  // 清缓存
  if (typeof window !== 'undefined') {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      ids.forEach(id => delete cache[id])
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {}
  }

  return failed
}
