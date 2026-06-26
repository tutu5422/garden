'use client'

import { Button, Input, Tag } from 'antd'
import { SearchOutlined, CheckSquareOutlined, ImportOutlined, CloseOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'

interface PatternHeaderProps {
  search: string
  onSearchChange: (value: string) => void
  batchMode: boolean
  onToggleBatchMode: () => void
  onExitBatchMode: () => void
  filterLabel: string
  selectedCategoryName?: string | null
}

export default function PatternHeader({
  search,
  onSearchChange,
  batchMode,
  onToggleBatchMode,
  onExitBatchMode,
  filterLabel,
  selectedCategoryName,
}: PatternHeaderProps) {
  const router = useRouter()

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
              <Tag style={{ margin: 0, background: '#FFF8F5', color: '#A09088', border: '1px solid #F0E0DA' }}>
                当前分类：{selectedCategoryName}
              </Tag>
            )}
            {!selectedCategoryName && filterLabel !== '全部图解' && (
              <Tag style={{ margin: 0, background: '#FFF8F5', color: '#A09088', border: '1px solid #F0E0DA' }}>
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
            onClick={() => router.push('/patterns/upload')}
          >
            导入图解
          </Button>
        )}
      </div>
    </div>
  )
}
