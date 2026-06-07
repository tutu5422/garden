'use client'

import Link from 'next/link'
import { ArrowUpRight, Layers, BookOpen } from 'lucide-react'
import type { LocalCollection } from '@/lib/db/local-store'

// 编辑狂想 8 色块系统
const editorialColors = [
  { bg: 'linear-gradient(135deg, #8B1A2B, #BE185D)', shadow: '#8B1A2B' },   // burgundy → crimson
  { bg: 'linear-gradient(135deg, #D4971A, #B8860B)', shadow: '#D4971A' },    // gold
  { bg: 'linear-gradient(135deg, #0D7B6B, #09856B)', shadow: '#0D7B6B' },    // teal
  { bg: 'linear-gradient(135deg, #5B2D8E, #7B3FAF)', shadow: '#5B2D8E' },   // plum
  { bg: 'linear-gradient(135deg, #1B4F8A, #2969B5)', shadow: '#1B4F8A' },   // sapphire
  { bg: 'linear-gradient(135deg, #BE185D, #E8315B)', shadow: '#BE185D' },   // crimson → primary
  { bg: 'linear-gradient(135deg, #2D3748, #4A5568)', shadow: '#2D3748' },   // slate
  { bg: 'linear-gradient(135deg, #1A1D23, #2D3748)', shadow: '#1A1D23' },   // dark
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function CollectionCard({ collection, noteCount }: { collection: LocalCollection; noteCount: number }) {
  const palette = editorialColors[hashCode(collection.title) % editorialColors.length]

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group block"
    >
      <article
        className="block-gloss relative overflow-hidden rounded-2xl p-6 sm:p-8 flex flex-col justify-between cursor-pointer min-h-[200px] transition-all duration-400 hover:shadow-xl"
        style={{
          background: palette.bg,
          boxShadow: `0 4px 12px ${palette.shadow}33`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-6px)';
          e.currentTarget.style.boxShadow = `0 16px 48px ${palette.shadow}44`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${palette.shadow}33`;
        }}
      >
        {/* Decorative circle */}
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 group-hover:scale-110 transition-transform duration-500"
          style={{ background: 'rgba(255,255,255,0.4)' }}
        />
        <div
          className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-8 group-hover:scale-125 transition-transform duration-500"
          style={{ background: 'rgba(255,255,255,0.3)' }}
        />

        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="size-4 text-white/60" />
            <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-white/50 font-mono">
              COLLECTION
            </span>
          </div>
          <h3
            className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-2 line-clamp-2"
            style={{ fontFamily: 'var(--font-display)', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            {collection.title}
          </h3>
          {collection.description ? (
            <p className="text-xs sm:text-sm text-white/70 line-clamp-2 leading-relaxed">
              {collection.description}
            </p>
          ) : (
            <p className="text-xs italic text-white/35">暂无描述</p>
          )}
        </div>

        <div className="relative z-10 flex items-end justify-between mt-5 pt-4 border-t border-white/15">
          <div className="flex items-center gap-2">
            <BookOpen className="size-3.5 text-white/60" />
            <span className="text-3xl font-extrabold tracking-tight text-white/90"
                  style={{ fontFamily: 'var(--font-display)' }}>
              {noteCount}
            </span>
            <span className="text-[10px] tracking-[0.15em] uppercase font-bold text-white/50 font-mono">
              篇笔记
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold tracking-widest uppercase text-white/60 group-hover:text-white/90 transition-all duration-300 group-hover:translate-x-1">
            浏览 <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </article>
    </Link>
  )
}
