export type {
  ResourceType,
  ResourceStatus,
  Profile,
  Category,
  Resource,
  Tag,
  ResourceTag,
  Collection,
  Note,
  ResourceFilters,
  Database,
  ResourceRow,
  ResourceMetadata,
  MusicTrack,
  CollectionRow,
  CollectionResourceRow,
} from './database'

export interface NavItem {
  label: string
  href: string
  icon: string
  external?: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
}
