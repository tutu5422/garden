import { getLocalResourcesFiltered, getLocalResource } from '@/lib/db/local-store'
import type { Resource, ResourceFilters } from '@/lib/types'

export async function getResources(filters: ResourceFilters = {}) {
  return getLocalResourcesFiltered(filters)
}

export async function getResource(id: string): Promise<Resource | null> {
  return getLocalResource(id)
}

export {
  createResource,
  updateResource,
  deleteResource,
} from './resources-client'
