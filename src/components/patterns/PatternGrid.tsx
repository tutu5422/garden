'use client'

import { useState } from 'react'
import { message } from 'antd'
import dynamic from 'next/dynamic'
import { InboxOutlined, DeleteOutlined, SwapOutlined, ImportOutlined } from '@ant-design/icons'
import PatternCardV2 from './PatternCardV2'
import type { Resource, Category } from '@/lib/types'

// 非首屏关键 antd UI 组件动态导入，避免整个 antd 包打进首屏 chunk。
const Button = dynamic(() => import('antd').then((m) => m.Button), { ssr: false })
const Checkbox = dynamic(() => import('antd').then((m) => m.Checkbox), { ssr: false })
const Popconfirm = dynamic(() => import('antd').then((m) => m.Popconfirm), { ssr: false })
const Modal = dynamic(() => import('antd').then((m) => m.Modal), { ssr: false })
const Select = dynamic(() => import('antd').then((m) => m.Select), { ssr: false })
const Space = dynamic(() => import('antd').then((m) => m.Space), { ssr: false })

interface PatternGridProps {
  patterns: Resource[]
  categories: Category[]
  batchMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: (ids: string[]) => void
  onClearSelection: () => void
  onBatchDelete: (ids: string[]) => void
  onBatchMove: (ids: string[], targetCategoryId: string) => void
  onWishlist: (id: string, currentStatus: string) => void
  onDelete: (id: string) => void
  selectedCategoryName?: string | null
  onImportClick?: () => void
}

export default function PatternGrid({
  patterns,
  categories,
  batchMode,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchMove,
  onWishlist,
  onDelete,
  selectedCategoryName,
  onImportClick,
}: PatternGridProps) {
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState('')

  const selectedCount = selectedIds.size
  const allSelected = patterns.length > 0 && patterns.every((p) => selectedIds.has(p.id))
  const someSelected = patterns.some((p) => selectedIds.has(p.id))

  const handleSelectAll = () => {
    if (allSelected) {
      onClearSelection()
    } else {
      onSelectAll(patterns.map((p) => p.id))
    }
  }

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds)
    onBatchDelete(ids)
    message.success(`已删除 ${ids.length} 个图解`)
  }

  const handleBatchMove = () => {
    if (!moveTargetId) {
      message.warning('请选择目标分类')
      return
    }
    const ids = Array.from(selectedIds)
    onBatchMove(ids, moveTargetId)
    setMoveModalVisible(false)
    setMoveTargetId('')
    message.success(`已将 ${ids.length} 个图解移动到新分类`)
  }

  if (patterns.length === 0 && !batchMode) {
    return (
      <div className="patterns-empty warm-antd">
        <InboxOutlined className="patterns-empty-icon" />
        <h3>{selectedCategoryName ? `"${selectedCategoryName}"分类下暂无图解` : '还没有导入任何图解'}</h3>
        <p>点击下方按钮导入你的第一份编织图解吧</p>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          onClick={onImportClick}
          size="large"
        >
          导入图解
        </Button>
      </div>
    )
  }

  return (
    <div className="warm-antd" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 批量操作栏 */}
      {batchMode && (
        <div className="batch-bar" style={{ flexShrink: 0 }}>
          <Space>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={handleSelectAll}
            />
            <span style={{ fontSize: 13, color: 'var(--skin-text)' }}>
              已选择 <strong style={{ color: 'var(--skin-primary)' }}>{selectedCount}</strong> 个
            </span>
          </Space>
          <Space>
            {selectedCount > 0 && (
              <>
                <Button
                  icon={<SwapOutlined />}
                  onClick={() => {
                    setMoveTargetId('')
                    setMoveModalVisible(true)
                  }}
                >
                  移动分类
                </Button>
                <Popconfirm
                  title={`确定删除选中的 ${selectedCount} 个图解？`}
                  description="记录将永久删除，无法恢复"
                  onConfirm={handleBatchDelete}
                  okText="确定删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    删除选中
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        </div>
      )}

      {/* CSS grid 卡片网格（由 globals.css 的 .pattern-grid 控制响应式列数） */}
      <div className="pattern-grid" style={{ flex: 1 }}>
        {patterns.map((pattern) => (
          <PatternCardV2
            key={pattern.id}
            pattern={pattern}
            batchMode={batchMode}
            isSelected={selectedIds.has(pattern.id)}
            onSelect={onToggleSelect}
            onWishlist={onWishlist}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* 移动分类弹窗 */}
      <Modal
        title={`移动 ${selectedCount} 个图解到其他分类`}
        open={moveModalVisible}
        onOk={handleBatchMove}
        onCancel={() => {
          setMoveModalVisible(false)
          setMoveTargetId('')
        }}
        okText="确定移动"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, color: 'var(--skin-text)', fontWeight: 500 }}>
            选择目标分类
          </label>
          <Select
            placeholder="选择要移动到的分类..."
            value={moveTargetId || undefined}
            onChange={(v) => setMoveTargetId(v as string)}
            style={{ width: '100%' }}
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
          />
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--skin-text-secondary)' }}>
            选中的 {selectedCount} 个图解将被移动到目标分类下。
          </p>
        </div>
      </Modal>
    </div>
  )
}
