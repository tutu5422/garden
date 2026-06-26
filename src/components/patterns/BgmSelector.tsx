'use client'

import { useState } from 'react'
import { Music } from 'lucide-react'

/**
 * BGM 选择器组件 — 图解详情页中可选设置编织 BGM
 * 不配置 BGM 时不影响原有音乐播放模式
 */
interface BgmSelectorProps {
  currentTrackId?: string
  currentTrackTitle?: string
  currentTrackArtist?: string
  onSelect: (trackId: string, title: string, artist?: string) => void
  onRemove: () => void
}

export default function BgmSelector({
  currentTrackId,
  currentTrackTitle,
  currentTrackArtist,
  onSelect,
  onRemove,
}: BgmSelectorProps) {
  const hasBgm = !!currentTrackId
  const [editing, setEditing] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [artistInput, setArtistInput] = useState('')

  const startEdit = () => {
    setTitleInput(currentTrackTitle || '')
    setArtistInput(currentTrackArtist || '')
    setEditing(true)
  }

  const confirm = () => {
    const t = titleInput.trim()
    if (!t) return
    // 用标题作为确定性 trackId（没有真实音乐库时足够用）
    const trackId = currentTrackId || `bgm-${Date.now().toString(36)}`
    onSelect(trackId, t, artistInput.trim() || undefined)
    setEditing(false)
  }

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(254,255,255,0.55)', border: '1px solid rgba(175,200,218,0.4)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Music className="size-4" style={{ color: 'var(--skin-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>编织 BGM</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}>
            可选
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasBgm && !editing && (
            <button
              onClick={startEdit}
              className="text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--skin-primary)' }}
            >
              更换
            </button>
          )}
          {hasBgm && !editing && (
            <button
              onClick={onRemove}
              className="text-xs hover:opacity-70 transition-opacity"
              style={{ color: '#EF4444' }}
            >
              移除
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="歌曲名"
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(175,200,218,0.3)', color: 'var(--foreground)' }}
          />
          <input
            type="text"
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            placeholder="艺术家（可选）"
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(175,200,218,0.3)', color: 'var(--foreground)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={confirm}
              disabled={!titleInput.trim()}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
              style={{ background: 'var(--skin-primary)', color: '#fff' }}
            >
              确定
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-70"
              style={{ color: 'var(--muted-foreground)' }}
            >
              取消
            </button>
          </div>
        </div>
      ) : hasBgm ? (
        <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.05)' }}>
          <Music className="size-3.5 shrink-0" style={{ color: 'var(--skin-primary)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {currentTrackTitle || '未命名歌曲'}
            </div>
            {currentTrackArtist && (
              <div className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                {currentTrackArtist}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            设置一首编织时听的 BGM，打开图解时会提示播放。不设置则使用原有音乐播放模式。
          </p>
          <button
            onClick={startEdit}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--skin-primary)', border: '1px dashed rgba(59,130,246,0.3)' }}
          >
            + 选择 BGM
          </button>
        </div>
      )}
    </div>
  )
}
