import type { NavItem } from '@/lib/types'

export const mainNavItems: NavItem[] = [
  { label: '笔记', href: '/notes', icon: 'Library' },
  { label: '织集', href: '/patterns', icon: 'Grid3X3' },
  { label: '合集', href: '/collections', icon: 'Layers' },
  { label: '时间线', href: '/timeline', icon: 'Calendar' },
  { label: '文件', href: '/files', icon: 'FileText' },
]

export const mobileNavItems: NavItem[] = [
  { label: '笔记', href: '/notes', icon: 'Library' },
  { label: '织集', href: '/patterns', icon: 'Grid3X3' },
  { label: '合集', href: '/collections', icon: 'Layers' },
  { label: '时间线', href: '/timeline', icon: 'Calendar' },
  { label: '文件', href: '/files', icon: 'FileText' },
]

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  link: '链接',
  image: '图片',
  book: '书籍',
  movie: '影视',
  tool: '工具',
  article: '文章',
  pattern: '图解',
  other: '其他',
}

export const RESOURCE_TYPE_ICONS: Record<string, string> = {
  link: 'Link',
  image: 'Image',
  book: 'BookOpen',
  movie: 'Film',
  tool: 'Wrench',
  article: 'FileText',
  pattern: 'Grid3x3',
  other: 'Package',
}

export const RESOURCE_STATUS_LABELS: Record<string, string> = {
  active: '已收藏',
  archived: '已归档',
  wishlist: '想看',
}
