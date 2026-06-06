'use client'

import { createClient } from '@/lib/supabase/client'
import { getLocalResources, getLocalCategories, getLocalTags, getLocalCollections } from '@/lib/db/local-store'
import type { Resource, Category, Tag } from '@/lib/types'
import type { LocalCollection } from '@/lib/db/local-store'

const isLocal = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('placeholder')
}

export async function syncToCloud(): Promise<{ notes: number; categories: number; tags: number }> {
  if (isLocal()) throw new Error('请先配置 Supabase 连接')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')

  const localResources = getLocalResources()
  const localCategories = getLocalCategories()
  const localTags = getLocalTags()

  let syncedNotes = 0
  let syncedCategories = 0
  let syncedTags = 0

  // 同步分类
  for (const cat of localCategories) {
    const { error } = await supabase
      .from('categories')
      .upsert({
        id: cat.id.startsWith('cat-') ? undefined : cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        sort_order: cat.sort_order,
      } as any, { onConflict: 'slug' })

    if (!error) syncedCategories++
  }

  // 同步标签
  for (const tag of localTags) {
    const { error } = await supabase
      .from('tags')
      .upsert({ name: tag.name, slug: tag.slug } as any, { onConflict: 'slug' })

    if (!error) syncedTags++
  }

  // 同步笔记
  for (const r of localResources) {
    const tagIds: string[] = r.resource_tags?.map(rt => rt.tag.id) || []

    const { error } = await supabase
      .from('resources')
      .upsert({
        title: r.title,
        description: r.description,
        resource_type: r.resource_type,
        url: r.url,
        cover_image_url: r.cover_image_url,
        rating: r.rating,
        status: r.status,
        category_id: r.category_id,
        user_id: user.id,
      } as any)

    if (!error) syncedNotes++
  }

  return { notes: syncedNotes, categories: syncedCategories, tags: syncedTags }
}
