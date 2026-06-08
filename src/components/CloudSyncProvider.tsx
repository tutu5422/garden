'use client'

import { useEffect } from 'react'
import { syncCollectionsFromCloud } from '@/lib/db/supabase-queries'

/**
 * Pull all cloud data (notes, resources, collections) into localStorage on startup.
 * Uses /api/sync GET (server-side service key, bypasses RLS).
 */
async function syncResourcesFromCloud() {
  try {
    const res = await fetch('/api/sync', { method: 'GET' })
    if (!res.ok) return
    const data = await res.json()

    // Merge notes (from cloud → minitu_notes)
    if (data.notes?.length) {
      const localNotesStr = localStorage.getItem('minitu_notes')
      const localNotes = localNotesStr ? JSON.parse(localNotesStr) : []
      const notesMerged = new Map()
      for (const n of localNotes) notesMerged.set(n.id, n)
      for (const n of data.notes) {
        const existing = notesMerged.get(n.id)
        if (!existing || new Date(n.createdAt) > new Date(existing.createdAt || 0)) {
          notesMerged.set(n.id, {
            id: n.id,
            title: n.title,
            content: n.content || '',
            type: n.type || 'article',
            tags: n.tags || [],
            collectionId: n.collectionId || undefined,
            collectionName: n.collectionName || undefined,
            createdAt: n.createdAt,
            image: n.image || undefined,
            imageThumb: n.imageThumb || undefined,
          })
        }
      }
      localStorage.setItem('minitu_notes', JSON.stringify(Array.from(notesMerged.values())))
    }

    // Merge resources (non-note items)
    if (data.resources?.length) {
      const localStr = localStorage.getItem('garden_resources')
      const local = localStr ? JSON.parse(localStr) : []
      const merged = new Map()
      for (const r of local) merged.set(r.id, r)
      for (const r of data.resources) {
        const existing = merged.get(r.id)
        if (!existing || new Date(r.updated_at) > new Date(existing.updated_at || 0)) {
          merged.set(r.id, r)
        }
      }
      localStorage.setItem('garden_resources', JSON.stringify(Array.from(merged.values())))
    }

    // Merge files (file metadata)
    if (data.files?.length) {
      const localStr = localStorage.getItem('minitu_files')
      const local = localStr ? JSON.parse(localStr) : []
      const merged = new Map()
      for (const f of local) merged.set(f.id, f)
      for (const f of data.files) {
        const existing = merged.get(f.id)
        if (!existing || new Date(f.createdAt) > new Date(existing.createdAt || 0)) {
          merged.set(f.id, f)
        }
      }
      localStorage.setItem('minitu_files', JSON.stringify(Array.from(merged.values())))
    }

    // Merge collections
    if (data.collections?.length) {
      const localStr = localStorage.getItem('garden_collections')
      const local = localStr ? JSON.parse(localStr) : []
      const merged = new Map()
      for (const c of local) merged.set(c.id, c)
      for (const c of data.collections) {
        const existing = merged.get(c.id)
        if (!existing || !(existing as any).updatedAt || new Date(c.updatedAt) > new Date((existing as any).updatedAt || 0)) {
          merged.set(c.id, c)
        }
      }
      localStorage.setItem('garden_collections', JSON.stringify(Array.from(merged.values())))
    }
  } catch { /* silent */ }
}

/**
 * 应用启动时从 Supabase 拉取云端数据，合并到本地 localStorage。
 * 确保换设备后能看到另一设备的数据。
 */
export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function sync() {
      await syncResourcesFromCloud()
      await syncCollectionsFromCloud()
      // Signal all pages that cloud sync is done
      window.dispatchEvent(new CustomEvent('cloud-sync-done'))
    }
    sync()
  }, [])

  return <>{children}</>
}
