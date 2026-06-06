import { createClient } from '@/lib/supabase/client'
import { createLocalResource, updateLocalResource, deleteLocalResource } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'

const isLocal = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('placeholder')
}

type ResourceInput = {
  title: string
  description?: string
  resource_type: string
  url?: string
  cover_image_url?: string
  author?: string
  rating?: number
  status?: string
  category_id?: string
  tag_ids?: string[]
}

export async function createResource(resource: ResourceInput): Promise<Resource> {
  if (isLocal()) return createLocalResource(resource)

  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('请先登录')

  const { tag_ids, ...resourceData } = resource

  const { data, error } = await supabase
    .from('resources')
    .insert({ ...resourceData, user_id: userData.user.id } as any)
    .select().single()

  if (error) throw error
  const created = data as unknown as Resource

  if (tag_ids?.length) {
    await supabase.from('resource_tags').insert(tag_ids.map(tag_id => ({ resource_id: created.id, tag_id })) as any)
  }
  return created
}

export async function updateResource(id: string, resource: Partial<ResourceInput> & { tag_ids?: string[] }): Promise<void> {
  if (isLocal()) { updateLocalResource(id, resource); return }

  const supabase = createClient()
  const { tag_ids, ...resourceData } = resource

  const { error } = await supabase.from('resources').update(resourceData as any).eq('id', id)
  if (error) throw error

  if (tag_ids !== undefined) {
    await supabase.from('resource_tags').delete().eq('resource_id', id)
    if (tag_ids.length) {
      await supabase.from('resource_tags').insert(tag_ids.map(tag_id => ({ resource_id: id, tag_id })) as any)
    }
  }
}

export async function deleteResource(id: string): Promise<void> {
  if (isLocal()) { deleteLocalResource(id); return }

  const supabase = createClient()
  await supabase.from('resource_tags').delete().eq('resource_id', id)
  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) throw error
}
