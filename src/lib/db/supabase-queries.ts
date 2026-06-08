'use client'

import { createClient } from '@/lib/supabase/client'
import { getLocalResource, getLocalResourcesFiltered, deleteLocalResources, getLocalCollections } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'

function isLocal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('placeholder')
}

// 本地缓存 — 避免每次打开笔记都等 Supabase
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

export async function getResourceHybrid(id: string): Promise<Resource | null> {
  // 1. 立即返回缓存/本地数据
  const cached = getResourceCached(id)

  // 2. 后台从 Supabase 拉取最新数据
  if (!isLocal() && !id.startsWith('local-') && !id.startsWith('demo-')) {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('resources')
        .select('*, category:categories(*), resource_tags(tag:tags(*))')
        .eq('id', id)
        .maybeSingle()
      if (data) {
        const cloudRes = data as unknown as Resource
        // 比较时间戳，保留最新的
        if (!cached || new Date(cloudRes.updated_at || 0) > new Date(cached.updated_at || 0)) {
          writeCache(cloudRes)
          return cloudRes
        }
      }
    } catch { /* ignore */ }
  }

  return cached
}

export async function getResourcesHybrid(params: {
  category?: string; collection?: string; tag?: string
  sort?: string; search?: string; page?: number; pageSize?: number
}): Promise<{ data: Resource[]; count: number }> {
  if (isLocal()) {
    return getLocalResourcesFiltered({ ...params, status: 'active' })
  }

  const supabase = createClient()

  const [cloudResult, localResult] = await Promise.all([
    (async () => {
      let query = supabase
        .from('resources')
        .select('*, category:categories(*), resource_tags(tag:tags(*))', { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(0, (params.pageSize || 50) - 1)

      if (params.search) query = query.ilike('title', `%${params.search}%`)
      if (params.category) {
        const { data: cat } = await supabase.from('categories').select('id').eq('slug', params.category).maybeSingle()
        if (cat) query = query.eq('category_id', (cat as any).id)
      }
      if (params.tag) {
        const { data: tag } = await supabase.from('tags').select('id').eq('slug', params.tag).maybeSingle()
        if (tag) {
          const { data: rids } = await supabase.from('resource_tags').select('resource_id').eq('tag_id', (tag as any).id)
          if (rids?.length) query = query.in('id', rids.map((r: any) => r.resource_id))
        }
      }

      const { data, count } = await query
      return { data: (data || []) as unknown as Resource[], count: count || 0 }
    })(),
    getLocalResourcesFiltered({ status: 'active', pageSize: 200 }),
  ])

  // 写入缓存
  cloudResult.data.forEach(r => { try { writeCache(r) } catch {} })

  // 按 id 合并，最后修改的为准
  let allResources = [...cloudResult.data, ...localResult.data]
  const merged = new Map<string, Resource>()
  for (const r of allResources) {
    const existing = merged.get(r.id)
    if (!existing || new Date(r.updated_at || 0) > new Date(existing.updated_at || 0)) {
      merged.set(r.id, r)
    }
  }

  let result = Array.from(merged.values())

  // 合集筛选 — 本地数据
  if (params.collection) {
    const col = getLocalCollections().find(c => c.title === params.collection || c.id === params.collection)
    if (col) {
      result = result.filter(r => col.resourceIds.includes(r.id))
    } else {
      return { data: [], count: 0 }
    }
  }

  return {
    data: result.slice(0, params.pageSize || 50),
    count: result.length,
  }
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
 * 从 Supabase 拉取合集并合并到本地 localStorage。
 * 云端数据（updated_at 更新者）优先，本地独有数据保留。
 * 应在应用初始化时调用一次。
 */
export async function syncCollectionsFromCloud(): Promise<void> {
  const { getLocalCollections } = await import('@/lib/db/local-store')
  const localCols = getLocalCollections()

  if (isLocal()) return

  try {
    const supabase = createClient()

    const LOCAL_USER_ID = 'f7db8ccd-a627-4946-a4c2-1e3f24aaaab7'
    const { data: cloudCols } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', LOCAL_USER_ID)
      .order('updated_at', { ascending: false })

    if (!cloudCols?.length) return

    // Fetch resource associations
    const collectionIds = cloudCols.map((c: any) => c.id)
    const { data: junctions } = await supabase
      .from('collection_resources')
      .select('collection_id, resource_id')
      .in('collection_id', collectionIds)

    const resourceMap = new Map<string, string[]>()
    if (junctions) {
      for (const j of junctions as any[]) {
        const list = resourceMap.get(j.collection_id) || []
        list.push(j.resource_id)
        resourceMap.set(j.collection_id, list)
      }
    }

    // Merge: cloud wins on newer updated_at
    const merged = new Map<string, any>()
    for (const c of localCols) merged.set(c.id, { ...c })
    for (const c of cloudCols as any[]) {
      const existing = merged.get(c.id)
      if (!existing || !(existing as any).updatedAt || new Date(c.updated_at) > new Date((existing as any).updatedAt || 0)) {
        merged.set(c.id, {
          id: c.id,
          title: c.title,
          description: c.description || '',
          coverImage: c.cover_image_url || '',
          resourceIds: resourceMap.get(c.id) || [],
          createdAt: c.created_at,
          updatedAt: c.updated_at,
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

  // 本地删除（立即生效）
  deleteLocalResources(ids)

  // 云端删除
  if (!isLocal()) {
    const supabase = createClient()
    try {
      await supabase.from('resource_tags').delete().in('resource_id', ids)
      const { error } = await supabase.from('resources').delete().in('id', ids)
      if (error) {
        console.error('云端删除失败:', error.message)
        // 删除失败的可能原因：未登录或不是所有者
        if (error.message.includes('policy') || error.message.includes('permission')) {
          throw new Error('云端删除需要登录且为笔记所有者')
        }
      }
    } catch (e: any) {
      if (e.message?.includes('云端删除')) throw e
      // 网络错误不阻塞，本地已删
    }
  }

  // 清缓存
  if (typeof window !== 'undefined') {
    try {
      const cache = JSON.parse(localStorage.getItem('garden_resource_cache') || '{}')
      ids.forEach(id => delete cache[id])
      localStorage.setItem('garden_resource_cache', JSON.stringify(cache))
    } catch {}
  }

  return failed
}
