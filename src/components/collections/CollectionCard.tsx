import Link from 'next/link'
import { Layers, BookOpen, FolderOpen } from 'lucide-react'
import type { LocalCollection } from '@/lib/db/local-store'

const gradients = [
  '#6C3CE1', '#B8860B', '#0D7A3E', '#DC2626',
  '#00E5FF', '#FFD700', '#A3FF00', '#FF6B35',
  '#8B5CF6', '#FF4444', '#00FF41',
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function CollectionCard({ collection, noteCount }: { collection: LocalCollection; noteCount: number }) {
  const accent = gradients[hashCode(collection.title) % gradients.length]

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group block animate-fade-in-up"
    >
      <article
        className="relative overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: 'var(--skin-surface)',
          border: '2px solid var(--skin-border)',
          borderRadius: '1rem 0.25rem 0.25rem 0.25rem',
        }}
      >
        {/* Banner */}
        <div className="relative h-40 overflow-hidden" style={{ background: accent }}>
          {/* Decorative circles */}
          <div
            className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-20 group-hover:scale-110 transition-transform duration-300"
            style={{ background: 'rgba(255,255,255,0.3)' }}
          />
          <div
            className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-15 group-hover:scale-125 transition-transform duration-300"
            style={{ background: 'rgba(255,255,255,0.3)' }}
          />
          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Layers className="size-12 text-white/60 drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
              <span className="text-white/40 text-[10px] font-extrabold tracking-[0.2em] uppercase">
                COLLECTION
              </span>
            </div>
          </div>
          {/* Note count badge */}
          <div className="absolute top-3 right-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <BookOpen className="size-3.5" />
              {noteCount}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-5 space-y-3">
          <h3
            className="font-extrabold text-base leading-snug line-clamp-1 group-hover:opacity-70 transition-opacity"
            style={{ color: 'var(--skin-text)', fontFamily: 'var(--font-display)' }}
          >
            {collection.title}
          </h3>
          {collection.description ? (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--skin-text-secondary)' }}>
              {collection.description}
            </p>
          ) : (
            <p className="text-xs italic opacity-40">暂无描述</p>
          )}
          {/* Bottom line */}
          <div className="flex items-center gap-2 pt-2 border-t-2 border-[var(--skin-border)]">
            <div className="h-0.5 flex-1" style={{ background: 'var(--skin-primary)' }} />
            <FolderOpen className="size-3.5 text-[var(--skin-text-secondary)] opacity-40" />
          </div>
        </div>
      </article>
    </Link>
  )
}
