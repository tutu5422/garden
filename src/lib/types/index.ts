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
  PatternNoteRow,
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
