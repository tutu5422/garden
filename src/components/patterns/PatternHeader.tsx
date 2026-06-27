'use client'

import { Button, Input, Tag } from 'antd'
import { SearchOutlined, CheckSquareOutlined, ImportOutlined, CloseOutlined } from '@ant-design/icons'

interface PatternHeaderProps {
  search: string
  onSearchChange: (value: string) => void
  batchMode: boolean
  onToggleBatchMode: () => void
  onExitBatchMode: () => void
  filterLabel: string
  selectedCategoryName?: string | null
  onImportClick?: () => void
  onMenuToggle?: () => void
}

export default function PatternHeader({
  search,
  onSearchChange,
  batchMode,
  onToggleBatchMode,
  onExitBatchMode,
  filterLabel,
  selectedCategoryName,
  onImportClick,
  onMenuToggle,
}: PatternHeaderProps) {

  return (
    <div className="patterns-header warm-antd">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* 汉堡菜单（仅手机端） */}
        {onMenuToggle && (
          <button className="patterns-header-menu-btn" onClick={onMenuToggle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {batchMode ? (
          <Tag color="processing" style={{ fontWeight: 500, margin: 0 }}>
            批量模式
          </Tag>
        ) : (
          <>
            {selectedCategoryName && (
              <Tag style={{ margin: 0, background: 'var(--skin-muted)', color: 'var(--skin-text-secondary)', border: '1px solid var(--skin-border)' }}>
                {selectedCategoryName}
              </Tag>
            )}
            {!selectedCategoryName && filterLabel !== '全部图解' && (
              <Tag style={{ margin: 0, background: 'var(--skin-muted)', color: 'var(--skin-text-secondary)', border: '1px solid var(--skin-border)' }}>
                {filterLabel}
              </Tag>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!batchMode && (
          <Input
            placeholder="搜索图解..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            allowClear
            className="patterns-header-search"
            style={{ width: 200 }}
          />
        )}
        {!batchMode ? (
          <Button className="patterns-header-btn" icon={<CheckSquareOutlined />} onClick={onToggleBatchMode}>
            <span className="patterns-header-btn-text">批量</span>
          </Button>
        ) : (
          <Button className="patterns-header-btn" icon={<CloseOutlined />} onClick={onExitBatchMode}>
            <span className="patterns-header-btn-text">退出</span>
          </Button>
        )}
        {!batchMode && (
          <Button
            className="patterns-header-btn"
            type="primary"
            icon={<ImportOutlined />}
            onClick={onImportClick}
          >
            <span className="patterns-header-btn-text">导入</span>
          </Button>
        )}
      </div>
    </div>
  )
}
