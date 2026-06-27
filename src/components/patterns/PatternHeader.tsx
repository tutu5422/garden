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
}: PatternHeaderProps) {

  return (
    <div className="patterns-header warm-antd">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {batchMode ? (
          <Tag color="processing" style={{ fontWeight: 500, margin: 0 }}>
            批量管理模式
          </Tag>
        ) : (
          <>
            {selectedCategoryName && (
              <Tag style={{ margin: 0, background: 'var(--skin-muted)', color: 'var(--skin-text-secondary)', border: '1px solid var(--skin-border)' }}>
                当前分类：{selectedCategoryName}
              </Tag>
            )}
            {!selectedCategoryName && filterLabel !== '全部图解' && (
              <Tag style={{ margin: 0, background: 'var(--skin-muted)', color: 'var(--skin-text-secondary)', border: '1px solid var(--skin-border)' }}>
                当前筛选：{filterLabel}
              </Tag>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {!batchMode && (
          <Input
            placeholder="搜索图解..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
        )}
        {!batchMode ? (
          <Button icon={<CheckSquareOutlined />} onClick={onToggleBatchMode}>
            批量管理
          </Button>
        ) : (
          <Button icon={<CloseOutlined />} onClick={onExitBatchMode}>
            退出管理
          </Button>
        )}
        {!batchMode && (
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={onImportClick}
          >
            导入图解
          </Button>
        )}
      </div>
    </div>
  )
}
