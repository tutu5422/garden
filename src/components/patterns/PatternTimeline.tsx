'use client'

import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'

interface TimelineNote {
  id: string
  title: string
  content?: string
  created_at: string
}

interface PatternTimelineProps {
  notes: TimelineNote[]
  onNewNote: () => void
}

/**
 * 图解详情页中的关联笔记时间线组件
 * 纵向时间线 + 呼吸圆点动画，展示每篇关联笔记
 */
export default function PatternTimeline({ notes, onNewNote }: PatternTimelineProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
          还没有关联的编织笔记
        </p>
        <button
          onClick={onNewNote}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
          style={{
            background: 'var(--skin-primary)',
            color: '#fff',
          }}
        >
          📝 记录第一篇笔记
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* 时间线竖线 */}
      <div
        className="absolute left-[11px] top-2 bottom-2 w-0.5"
        style={{ background: 'linear-gradient(to bottom, var(--skin-primary), transparent)' }}
      />

      <div className="space-y-4">
        {notes.map((note, index) => (
          <Link
            key={note.id}
            href={`/notes/${note.id}`}
            className="group flex gap-4 items-start"
          >
            {/* 时间线圆点 */}
            <div
              className="relative z-10 mt-1.5 size-6 rounded-full flex items-center justify-center shrink-0 animate-[dot-pulse_2s_ease-in-out_infinite]"
              style={{
                background: 'var(--skin-primary)',
                animationDelay: `${index * 0.3}s`,
                boxShadow: '0 0 0 0 rgba(59,130,246,0.4)',
              }}
            >
              <span className="text-white text-[10px]">📝</span>
            </div>

            {/* 笔记卡片 */}
            <div
              className="flex-1 p-3 rounded-xl transition-all duration-300 group-hover:translate-x-1"
              style={{
                background: 'rgba(254,255,255,0.55)',
                border: '1px solid rgba(175,200,218,0.3)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="size-3" style={{ color: 'var(--muted-foreground)' }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(note.created_at).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <h4
                className="text-sm font-semibold line-clamp-1 mb-0.5 transition-colors"
                style={{ color: 'var(--foreground)' }}
              >
                {note.title}
              </h4>

              {note.content && (
                <p
                  className="text-xs line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {note.content}
                </p>
              )}

              <div className="flex items-center gap-1 mt-1.5 text-[10px] font-medium transition-opacity opacity-0 group-hover:opacity-100" style={{ color: 'var(--skin-primary)' }}>
                查看笔记
                <ChevronRight className="size-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 底部：新增笔记按钮 */}
      <div className="mt-6 text-center">
        <button
          onClick={onNewNote}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 inline-flex items-center gap-1.5"
          style={{
            background: 'rgba(59,130,246,0.1)',
            color: 'var(--skin-primary)',
            border: '1px dashed rgba(59,130,246,0.3)',
          }}
        >
          + 记录新笔记
        </button>
      </div>
    </div>
  )
}
