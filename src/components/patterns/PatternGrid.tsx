'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { message } from 'antd'
import dynamic from 'next/dynamic'
import { InboxOutlined, DeleteOutlined, SwapOutlined, ImportOutlined } from '@ant-design/icons'
import { Grid, type CellComponentProps } from 'react-window'
import PatternCardV2 from './PatternCardV2'
import type { Resource, Category } from '@/lib/types'

// 非首屏关键 antd UI 组件动态导入，避免整个 antd 包打进首屏 chunk。
// `message` 为静态方法，保留常规导入。
const Button = dynamic(() => import('antd').then((m) => m.Button), { ssr: false })
const Checkbox = dynamic(() => import('antd').then((m) => m.Checkbox), { ssr: false })
const Popconfirm = dynamic(() => import('antd').then((m) => m.Popconfirm), { ssr: false })
const Modal = dynamic(() => import('antd').then((m) => m.Modal), { ssr: false })
const Select = dynamic(() => import('antd').then((m) => m.Select), { ssr: false })
const Space = dynamic(() => import('antd').then((m) => m.Space), { ssr: false })

// ===== 网格尺寸常量（与 globals.css 中 .pattern-grid / .warm-card 保持一致）=====
const CARD_MIN_WIDTH = 220
const CARD_MIN_WIDTH_MOBILE = 160
const COVER_HEIGHT = 220
const COVER_HEIGHT_MOBILE = 160
const CARD_BODY_HEIGHT = 74 // 匹配 .warm-card-body: padding(12+14)=26 + title(~22) + tag-margin(6) + tag(~20) = ~74
const GRID_GAP = 20
const GRID_GAP_MOBILE = 12
const GRID_PADDING = 24
const GRID_PADDING_MOBILE = 16

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

// 传递给每个 cell 的数据（react-window v2 Grid 通过 cellProps 注入）
interface CellData {
  patterns: Resource[]
  columns: number
  cardWidth: number
  cardH: number
  batchMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onWishlist: (id: string, currentStatus: string) => void
  onDelete: (id: string) => void
}

// cell 渲染组件（模块级，保持引用稳定）
function PatternCell({
  columnIndex,
  rowIndex,
  style,
  patterns,
  columns,
  cardWidth,
  cardH,
  batchMode,
  selectedIds,
  onToggleSelect,
  onWishlist,
  onDelete,
}: CellComponentProps<CellData>) {
  const idx = rowIndex * columns + columnIndex
  const pattern = patterns[idx]
  if (!pattern) return null
  return (
    <div style={style}>
      <div style={{ width: cardWidth, height: cardH }}>
        <PatternCardV2
          pattern={pattern}
          batchMode={batchMode}
          isSelected={selectedIds.has(pattern.id)}
          onSelect={onToggleSelect}
          onWishlist={onWishlist}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
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

  // 可靠检测手机/桌面宽度（直接通过 window，不需要 ResizeObserver）
  const [isMobileWidth, setIsMobileWidth] = useState(false)
  useEffect(() => {
    const check = () => setIsMobileWidth(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 桌面端：列表容器尺寸（用于虚拟滚动高度/宽度与列数计算）
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null)
  const listRef = useCallback((el: HTMLDivElement | null) => setListEl(el), [])
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!listEl) return
    const update = () => {
      setDims({ width: listEl.clientWidth, height: listEl.clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(listEl)
    return () => ro.disconnect()
  }, [listEl])

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

  // ===== 桌面端虚拟滚动网格参数 =====
  const cardMinW = isMobileWidth ? CARD_MIN_WIDTH_MOBILE : CARD_MIN_WIDTH
  const gap = isMobileWidth ? GRID_GAP_MOBILE : GRID_GAP
  const padding = isMobileWidth ? GRID_PADDING_MOBILE : GRID_PADDING
  const coverH = isMobileWidth ? COVER_HEIGHT_MOBILE : COVER_HEIGHT
  const cardH = coverH + CARD_BODY_HEIGHT
  const gridW = Math.max(0, dims.width - padding * 2)
  const gridH = Math.max(0, dims.height - padding * 2)
  const columns = Math.max(1, Math.floor((gridW + gap) / (cardMinW + gap)))
  const cardWidth = columns > 0 ? (gridW - (columns - 1) * gap) / columns : cardMinW
  const rowCount = Math.ceil(patterns.length / columns)
  const columnWidth = cardWidth + gap
  const rowHeight = cardH + gap

  const cellProps = useMemo<CellData>(
    () => ({
      patterns,
      columns,
      cardWidth,
      cardH,
      batchMode,
      selectedIds,
      onToggleSelect,
      onWishlist,
      onDelete,
    }),
    [patterns, columns, cardWidth, cardH, batchMode, selectedIds, onToggleSelect, onWishlist, onDelete],
  )

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
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: isMobileWidth ? undefined : 'hidden',
      }}
      className="warm-antd"
    >
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

      {/* 手机端：CSS grid 普通滚动（body 自然滚动，header sticky 固定） */}
      {isMobileWidth ? (
        <div style={{ flex: 1 }}>
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
        </div>
      ) : (
        /* 桌面端：虚拟滚动卡片网格 */
        <div ref={listRef} style={{ flex: 1, minHeight: 0 }}>
          {gridH > 0 && gridW > 0 && columns > 0 && (
            <div style={{ height: '100%', width: '100%', padding, boxSizing: 'border-box' }}>
              <Grid
                columnCount={columns}
                columnWidth={columnWidth}
                rowCount={rowCount}
                rowHeight={rowHeight}
                cellComponent={PatternCell}
                cellProps={cellProps}
                style={{ height: '100%', width: '100%' }}
                overscanCount={3}
              />
            </div>
          )}
        </div>
      )}

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
