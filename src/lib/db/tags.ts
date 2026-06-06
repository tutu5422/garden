import { createServerSupabase, isPlaceholder } from '@/lib/supabase/server'
import { getLocalTags, getOrCreateTag as localGetOrCreate, getLocalCategory } from '@/lib/db/local-store'
import type { Tag } from '@/lib/types'

const MOCK_TAGS = [
  { id: 't1', name: '前端', slug: 'frontend', color: null, created_at: '' },
  { id: 't2', name: '开源', slug: 'opensource', color: null, created_at: '' },
  { id: 't3', name: '效率', slug: 'productivity', color: null, created_at: '' },
]

export async function getTags(): Promise<Tag[]> {
  if (isPlaceholder()) return getLocalTags().length ? getLocalTags() : MOCK_TAGS as Tag[]
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('tags').select('*').order('name')
  return (data?.length ? data : MOCK_TAGS) as unknown as Tag[]
}

export async function getTag(slug: string): Promise<Tag | null> {
  if (isPlaceholder()) return getLocalTags().find(t => t.slug === slug) || MOCK_TAGS.find(t => t.slug === slug) as Tag || null
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('tags').select('*').eq('slug', slug).single()
  return (data || MOCK_TAGS.find(t => t.slug === slug)) as Tag | null
}

export async function getTagCloud() {
  const tags = await getTags()
  return tags.map(t => ({ ...t, resource_tags: [{ count: 3 }] }))
}
