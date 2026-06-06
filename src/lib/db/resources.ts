import { createServerSupabase, isPlaceholder } from '@/lib/supabase/server'
import { getLocalResourcesFiltered, getLocalResource } from '@/lib/db/local-store'
import type { Resource, ResourceFilters } from '@/lib/types'

export async function getResources(filters: ResourceFilters = {}) {
  if (isPlaceholder()) {
    return getLocalResourcesFiltered(filters)
  }

  const supabase = await createServerSupabase()

  const {
    search, type, category, status = 'active', tag,
    sort = 'newest', page = 1, pageSize = 12,
  } = filters

  let query = supabase
    .from('resources')
    .select('*, category:categories(*), resource_tags(tag:tags(*))', { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('resource_type', type)
  if (category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single()
    if (cat) query = query.eq('category_id', (cat as { id: string }).id)
  }
  if (search) query = query.ilike('title', `%${search}%`)
  if (tag) {
    const { data: tagData } = await supabase.from('tags').select('id').eq('slug', tag).single()
    if (tagData) {
      const { data: resourceIds } = await supabase.from('resource_tags').select('resource_id').eq('tag_id', (tagData as { id: string }).id)
      if (resourceIds?.length) query = query.in('id', (resourceIds as unknown as { resource_id: string }[]).map(r => r.resource_id))
      else return { data: [], count: 0 }
    }
  }

  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'rating') query = query.order('rating', { ascending: false, nullsFirst: false })
  else if (sort === 'title') query = query.order('title', { ascending: true })
  else query = query.order('created_at', { ascending: false })

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query
  if (error) { console.error('Error:', error); return { data: [], count: 0 } }
  return { data: (data || []) as unknown as Resource[], count: count || 0 }
}

export async function getResource(id: string): Promise<Resource | null> {
  if (isPlaceholder()) return getLocalResource(id)

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('resources')
    .select('*, category:categories(*), resource_tags(tag:tags(*))')
    .eq('id', id).single()

  if (error) return null
  return data as unknown as Resource
}

export {
  createResource,
  updateResource,
  deleteResource,
} from './resources-client'
