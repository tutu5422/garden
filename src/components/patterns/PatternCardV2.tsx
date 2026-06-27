'use client'

import { useState } from 'react'
import { Checkbox, Popconfirm, message } from 'antd'
import { FilePdfOutlined, DeleteOutlined, HeartOutlined, HeartFilled } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import SmartImage from '@/components/shared/SmartImage'
import type { Resource } from '@/lib/types'

interface PatternCardV2Props {
  pattern: Resource
  batchMode: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  onWishlist: (id: string, currentStatus: string) => void
  onDelete: (id: string) => void
}

export default function PatternCardV2({
  pattern,
  batchMode,
  isSelected,
  onSelect,
  onWishlist,
  onDelete,
}: PatternCardV2Props) {
  const router = useRouter()
  const [showActions, setShowActions] = useState(false)

  const meta = (pattern.metadata || {}) as Record<string, unknown>
  const status = (meta.patternStatus as string) || 'not-started'
  const isWishlisted = status === 'wishlist'
  const categoryName = pattern.category?.name

  const handleCardClick = () => {
    if (batchMode) {
      onSelect(pattern.id)
    } else {
      router.push(`/patterns/${pattern.id}`)
    }
  }

  const handleDelete = () => {
    onDelete(pattern.id)
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation()
    onWishlist(pattern.id, status)
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* 批量模式复选框 */}
      {batchMode && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            background: 'var(--skin-surface)',
            borderRadius: 6,
            padding: '2px 4px',
            boxShadow: 'var(--shadow-sm)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox checked={isSelected} onChange={() => onSelect(pattern.id)} />
        </div>
      )}

      {/* 心愿按钮 */}
      {!batchMode && (isWishlisted || showActions) && (
        <div
          className="card-action-btn"
          style={{ right: 44 }}
          onClick={handleWishlist}
        >
          {isWishlisted ? (
            <HeartFilled style={{ fontSize: 14, color: 'var(--skin-primary)' }} />
          ) : (
            <HeartOutlined style={{ fontSize: 14, color: 'var(--skin-text-secondary)' }} />
          )}
        </div>
      )}

      {/* 删除按钮 */}
      {!batchMode && showActions && (
        <Popconfirm
          title="确定删除此图解？"
          description="记录将被永久删除"
          onConfirm={handleDelete}
          okText="确定删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <div
            className="card-action-btn"
            style={{ right: 8, color: '#ff4d4f' }}
            onClick={(e) => e.stopPropagation()}
          >
            <DeleteOutlined style={{ fontSize: 14 }} />
          </div>
        </Popconfirm>
      )}

      <div
        className="warm-card"
        onClick={handleCardClick}
        style={
          isSelected
            ? { boxShadow: '0 0 0 2px var(--skin-primary), 0 4px 16px rgba(var(--skin-primary-rgb), 0.3)' }
            : undefined
        }
      >
        <div className="warm-card-cover">
          {pattern.cover_image_url ? (
            <SmartImage
              src={pattern.cover_image_url}
              alt={pattern.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--skin-text-secondary)',
              }}
            >
              <FilePdfOutlined style={{ fontSize: 48 }} />
            </div>
          )}
        </div>
        <div className="warm-card-body">
          <div className="warm-card-title" title={pattern.title}>
            {pattern.title}
          </div>
          {categoryName && <span className="warm-card-tag">{categoryName}</span>}
        </div>
      </div>
    </div>
  )
}
