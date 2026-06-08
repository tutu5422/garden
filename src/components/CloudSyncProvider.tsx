'use client'

import { useEffect } from 'react'
import { syncCollectionsFromCloud } from '@/lib/db/supabase-queries'

/**
 * Pull all cloud data (resources, notes) into localStorage on startup.
 * Ensures cross-device data visibility.
 */
async function syncResourcesFromCloud() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!rawUrl || !supabaseKey) return
  const supabaseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  try {
    // Pull resources (non-note articles, links, etc.)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/resources?select=*&metadata->>is_note=is.null&order=updated_at.desc&limit=200`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    if (!res.ok) return
    const cloudRows = await res.json()
    if (!cloudRows?.length) return

    const localStr = localStorage.getItem('garden_resources')
    const local = localStr ? JSON.parse(localStr) : []
    const merged = new Map()
    for (const r of local) merged.set(r.id, r)
    for (const r of cloudRows) {
      const existing = merged.get(r.id)
      if (!existing || new Date(r.updated_at) > new Date(existing.updated_at || 0)) {
        merged.set(r.id, {
          id: r.id,
          title: r.title,
          description: r.description,
          resource_type: r.metadata?.actual_resource_type || r.resource_type,
          url: r.url,
          cover_image_url: r.cover_image_url,
          author: r.author,
          rating: r.rating,
          status: r.status,
          category_id: r.category_id,
          category: r.category,
          resource_tags: (r.metadata?.tags || []).map((name: string) => ({ tag: { name } })),
          metadata: r.metadata || {},
          pinned: r.pinned,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })
      }
    }
    localStorage.setItem('garden_resources', JSON.stringify(Array.from(merged.values())))
  } catch { /* silent */ }
}

/**
 * 应用启动时从 Supabase 拉取云端数据，合并到本地 localStorage。
 * 确保换设备后能看到另一设备的数据。
 */
export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncCollectionsFromCloud()
    syncResourcesFromCloud()
  }, [])

  return <>{children}</>
}
