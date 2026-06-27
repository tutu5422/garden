import { createLocalResource, updateLocalResource, deleteLocalResource } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'

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
  return createLocalResource(resource)
}

export async function updateResource(id: string, resource: Partial<ResourceInput> & { tag_ids?: string[] }): Promise<void> {
  updateLocalResource(id, resource)
}

export async function deleteResource(id: string): Promise<void> {
  deleteLocalResource(id)
}
