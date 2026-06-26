'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import SmartImage from '@/components/shared/SmartImage'
import type { Resource } from '@/lib/types'

interface PatternCardProps {
  pattern: Resource
  onWishlist?: (id: string, currentStatus: string) => void
}

/**
 * 图解卡片组件 — 便当盒风格，带进度条、状态、品牌信息
 */
export default function PatternCard({ pattern, onWishlist }: PatternCardProps) {
  const meta = (pattern.metadata || {}) as Record<string, unknown>
  const status = (meta.patternStatus as string) || 'not-started'
  const progress = (meta.patternProgress as number) || 0
  const brand = (meta.patternBrand as string) || ''
  const difficulty = (meta.patternDifficulty as string) || ''

  // 状态标签配置
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    'not-started': { label: '未开始', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
    'in-progress': { label: '进行中', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    completed: { label: '已完成', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    paused: { label: '暂停', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    abandoned: { label: '放弃', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
    wishlist: { label: '心愿单', color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  }
  const sc = statusConfig[status] || statusConfig['not-started']

  // 难度星级
  const difficultyStars: Record<string, number> = {
    beginner: 1,
    easy: 2,
    intermediate: 3,
    advanced: 4,
    expert: 5,
  }
  const stars = difficultyStars[difficulty] || 0

  return (
    <Link
      href={`/patterns/${pattern.id}`}
      className="group block animate-fade-in-up"
    >
      <article
        className="relative overflow-hidden rounded-2xl transition-all duration-500 ease-out group-hover:scale-[1.02] group-hover:shadow-xl"
        style={{
          background: 'rgba(254, 255, 255, 0.55)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(175, 200, 218, 0.4)',
          boxShadow: '0 4px 16px rgba(71, 112, 155, 0.06), 0 1px 4px rgba(71, 112, 155, 0.04)',
        }}
      >
        {/* 封面图区域 */}
        <div className="relative overflow-hidden" style={{ height: '220px' }}>
          {pattern.cover_image_url ? (
            <>
              <SmartImage
                src={pattern.cover_image_url}
                alt={pattern.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div
                className="absolute inset-x-0 bottom-0"
                style={{
                  height: '60%',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
                }}
              />
            </>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, var(--skin-primary), color-mix(in srgb, var(--skin-primary) 60%, var(--skin-background)))`,
              }}
            >
              <span className="text-5xl opacity-25 group-hover:scale-125 transition-transform duration-500" style={{ color: '#fff' }}>
                🧶
              </span>
            </div>
          )}

          {/* 心愿单按钮 — 右上角 */}
          {onWishlist && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onWishlist(pattern.id, status)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full transition-all duration-300 hover:scale-110"
              style={{
                background: status === 'wishlist' ? 'rgba(236,72,153,0.2)' : 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Heart
                className="size-4"
                style={{
                  color: status === 'wishlist' ? '#EC4899' : '#fff',
                  fill: status === 'wishlist' ? '#EC4899' : 'transparent',
                }}
              />
            </button>
          )}

          {/* 状态标签 — 左上角 */}
          {status !== 'not-started' && (
            <div className="absolute top-2 left-2">
              <span
                className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                style={{ background: sc.bg, color: sc.color, backdropFilter: 'blur(10px)' }}
              >
                {sc.label}
              </span>
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div className="h-1 w-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
          {status === 'in-progress' && (
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--skin-primary), var(--skin-accent))',
              }}
            />
          )}
          {status === 'completed' && (
            <div className="h-full w-full" style={{ background: '#10B981' }} />
          )}
          {status === 'wishlist' && (
            <div className="h-full w-full" style={{ background: '#EC4899', opacity: 0.3 }} />
          )}
        </div>

        {/* 内容区 */}
        <div className="p-3 space-y-1.5">
          {/* 标题 */}
          <h3
            className="font-semibold text-sm leading-snug line-clamp-1 transition-colors duration-300"
            style={{ color: 'var(--foreground)' }}
          >
            {pattern.title}
          </h3>

          {/* 品牌 + 难度 */}
          <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            <span>{brand || '未分类'}</span>
            {stars > 0 && (
              <span>
                {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
