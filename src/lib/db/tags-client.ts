import { createClient } from '@/lib/supabase/client'
import { searchLocalTags, getOrCreateTag as localGetOrCreate } from '@/lib/db/local-store'
import type { Tag } from '@/lib/types'

const isLocal = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('placeholder')
}

export async function searchTags(query: string): Promise<Tag[]> {
  if (isLocal()) return searchLocalTags(query)
  const supabase = createClient()
  const { data } = await supabase.from('tags').select('*').ilike('name', `%${query}%`).limit(10)
  return (data || []) as unknown as Tag[]
}

export async function getOrCreateTag(name: string): Promise<Tag> {
  if (isLocal()) return localGetOrCreate(name)
  const supabase = createClient()
  const { data: existing } = await supabase.from('tags').select('*').eq('name', name).single()
  if (existing) return existing as unknown as Tag

  const slug = name.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-')
  const { data } = await supabase.from('tags').insert({ name, slug } as any).select().single()
  return data as unknown as Tag
}
