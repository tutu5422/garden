import Link from 'next/link'
import { Layers, BookOpen, Star, FolderOpen } from 'lucide-react'
import type { LocalCollection } from '@/lib/db/local-store'

const gradients = [
  'linear-gradient(135deg, rgba(71,112,155,0.9), rgba(130,160,200,0.7))',
  'linear-gradient(135deg, rgba(120,100,160,0.9), rgba(160,140,200,0.7))',
  'linear-gradient(135deg, rgba(60,130,120,0.9), rgba(100,170,160,0.7))',
  'linear-gradient(135deg, rgba(180,130,80,0.9), rgba(200,160,120,0.7))',
  'linear-gradient(135deg, rgba(140,80,120,0.9), rgba(180,120,160,0.7))',
  'linear-gradient(135deg, rgba(80,110,140,0.9), rgba(120,150,180,0.7))',
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function CollectionCard({ collection, noteCount }: { collection: LocalCollection; noteCount: number }) {
  const gradient = gradients[hashCode(collection.title) % gradients.length]

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group block animate-fade-in-up"
    >
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
        {/* 封面区 */}
        <div className="relative h-44 overflow-hidden">
          <div
            className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105"
            style={{ background: gradient }}
          />
          {/* 装饰圆 */}
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 group-hover:scale-110 transition-transform duration-700"
            style={{ background: 'rgba(255,255,255,0.3)' }}
          />
          <div
            className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-15 group-hover:scale-125 transition-transform duration-700"
            style={{ background: 'rgba(255,255,255,0.3)' }}
          />
          {/* 图标 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Layers className="size-10 text-white/70 drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
              <span className="text-white/50 text-xs font-medium tracking-wider uppercase">
                COLLECTION
              </span>
            </div>
          </div>
          {/* 笔记数角标 */}
          <div className="absolute top-3 right-3">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <BookOpen className="size-3" />
              {noteCount}
            </span>
          </div>
        </div>

        {/* 信息区 */}
        <div className="p-4 space-y-2">
          <h3
            className="font-semibold text-sm leading-snug line-clamp-1 group-hover:opacity-80 transition-opacity"
            style={{ color: 'var(--foreground)' }}
          >
            {collection.title}
          </h3>
          {collection.description ? (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {collection.description}
            </p>
          ) : (
            <p className="text-xs italic opacity-40">暂无描述</p>
          )}
          {/* 底部装饰线 */}
          <div className="flex items-center gap-2 pt-2">
            <div
              className="h-px flex-1"
              style={{ background: 'linear-gradient(to right, var(--border), transparent)' }}
            />
            <FolderOpen className="size-3 text-muted-foreground/40" />
          </div>
        </div>
      </article>
    </Link>
  )
}
