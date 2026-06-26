'use client'

import { useState } from 'react'
import { Button, Checkbox, Popconfirm, message, Space, Modal, Select, Empty } from 'antd'
import { InboxOutlined, DeleteOutlined, SwapOutlined, ImportOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import PatternCardV2 from './PatternCardV2'
import type { Resource, Category } from '@/lib/types'

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
}: PatternGridProps) {
  const router = useRouter()
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState('')

  if (patterns.length === 0 && !batchMode) {
    return (
      <div className="patterns-empty warm-antd">
        <InboxOutlined className="patterns-empty-icon" />
        <h3>{selectedCategoryName ? `"${selectedCategoryName}"分类下暂无图解` : '还没有导入任何图解'}</h3>
        <p>点击下方按钮导入你的第一份编织图解吧</p>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          onClick={() => router.push('/patterns/upload')}
          size="large"
        >
          导入图解
        </Button>
      </div>
    )
  }

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

  return (
    <div style={{ flex: 1, overflow: 'auto' }} className="warm-antd">
      {/* 批量操作栏 */}
      {batchMode && (
        <div className="batch-bar">
          <Space>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={handleSelectAll}
            />
            <span style={{ fontSize: 13, color: '#4A4A4A' }}>
              已选择 <strong style={{ color: '#FFAAA5' }}>{selectedCount}</strong> 个
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

      {/* 卡片网格 */}
      <div className="pattern-grid">
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
        okButtonProps={{ style: { background: '#C17F6B', borderColor: '#C17F6B' } }}
      >
        <div style={{ padding: '16px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#4A4A4A', fontWeight: 500 }}>
            选择目标分类
          </label>
          <Select
            placeholder="选择要移动到的分类..."
            value={moveTargetId || undefined}
            onChange={setMoveTargetId}
            style={{ width: '100%' }}
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
          />
          <p style={{ marginTop: 12, fontSize: 12, color: '#C0B0A8' }}>
            选中的 {selectedCount} 个图解将被移动到目标分类下。
          </p>
        </div>
      </Modal>
    </div>
  )
}
