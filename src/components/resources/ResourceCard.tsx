import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Star, BookOpen, Film, Wrench, FileText, Image, Package, Link as LinkIcon, Calendar, FolderOpen } from 'lucide-react'
import type { Resource } from '@/lib/types'
import { RESOURCE_TYPE_LABELS } from '@/lib/constants/navigation'

const typeIcon: Record<string, React.ReactNode> = {
  link: <LinkIcon className="size-3.5" />,
  image: <Image className="size-3.5" />,
  book: <BookOpen className="size-3.5" />,
  movie: <Film className="size-3.5" />,
  tool: <Wrench className="size-3.5" />,
  article: <FileText className="size-3.5" />,
  other: <Package className="size-3.5" />,
}

// 根据标题哈希选一个渐变角度，丰富视觉效果
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const gradientAngles = ['135deg', '160deg', '110deg', '180deg', '145deg']

export default function ResourceCard({ resource, coverHeight = 200 }: { resource: Resource; coverHeight?: number }) {
  const tags = resource.resource_tags?.map((rt) => rt.tag) || []
  const angle = gradientAngles[hashCode(resource.title) % gradientAngles.length]

  return (
    <Link
      href={`/resources/${resource.id}`}
      className="group block animate-fade-in-up"
    >
      {/* 毛玻璃卡片容器 */}
      <article
        className="relative overflow-hidden rounded-2xl transition-all duration-500 ease-out"
        style={{
          background: 'rgba(254, 255, 255, 0.55)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(175, 200, 218, 0.4)',
          boxShadow:
            '0 4px 16px rgba(71, 112, 155, 0.06), 0 1px 4px rgba(71, 112, 155, 0.04)',
        }}
      >
        {/* ===== 封面图区域 ===== */}
        <div className="relative overflow-hidden" style={{ height: `${coverHeight}px` }}>
          {resource.cover_image_url ? (
            <>
              <img
                src={resource.cover_image_url}
                alt={resource.title}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                loading="lazy"
              />
              {/* 底部渐变遮罩 — 确保标签可读 */}
              <div
                className="absolute inset-x-0 bottom-0"
                style={{
                  height: '60%',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
                }}
              />
            </>
          ) : (
            /* 无封面图 — 皮肤主色渐变 */
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(${angle}, var(--skin-primary), color-mix(in srgb, var(--skin-primary) 60%, var(--skin-background)))`,
              }}
            >
              <span className="text-4xl opacity-25 group-hover:scale-125 transition-transform duration-500" style={{ color: '#fff' }}>
                {typeIcon[resource.resource_type]}
              </span>
            </div>
          )}

          {/* 类型标签 — 左上角 */}
          <div className="absolute top-2 left-2">
            <Badge
              className="gap-1 px-1.5 py-0 text-[10px] font-medium border-0"
              style={{
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
              }}
            >
              {typeIcon[resource.resource_type]}
              {RESOURCE_TYPE_LABELS[resource.resource_type]}
            </Badge>
          </div>

        </div>

        {/* ===== 内容区 ===== */}
        <div className="p-2.5 space-y-1.5">
          {/* 标题 */}
          <h3
            className="font-semibold text-xs leading-snug line-clamp-2 transition-colors duration-300"
            style={{ color: 'var(--foreground)' }}
          >
            {resource.title}
          </h3>

          {/* 描述 */}
          {resource.description ? (
            <p className="text-[11px] leading-snug line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
              {resource.description}
            </p>
          ) : null}

          {/* 元数据行 */}
          <div
            className="flex items-center justify-between pt-1.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-1.5 text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
              {resource.category ? (
                <span className="flex items-center gap-0.5"><FolderOpen className="size-2.5" />{resource.category.name}</span>
              ) : null}
              <span className="flex items-center gap-0.5">
                <Calendar className="size-2.5" />
                {new Date(resource.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </span>
            </div>

          </div>
        </div>
      </article>
    </Link>
  )
}
