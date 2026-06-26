'use client'

import { useState, useEffect } from 'react'
import { Modal, Input, ColorPicker, message, Popconfirm, Button } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  HolderOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { Resource, Category, Tag } from '@/lib/types'
import {
  getCategories,
  ensureUncategorized,
  createCategory,
  updateCategory,
  deleteCategory,
  getTags,
  createTag,
  updateTag,
  deleteTag,
} from '@/lib/api/patterns-api'

const MACARON_COLORS = [
  '#C17F6B', '#D4A98A', '#8FA88A', '#8AA0A8',
  '#A08AA8', '#EDE4D8', '#DECB9C', '#C9807E',
  '#9AB5A0', '#B8A0B8', '#FFAAA5', '#BAFFC9',
]

type FilterMode = 'all' | 'category' | 'wishlist' | 'status' | 'tag'

interface PatternSidebarProps {
  patterns: Resource[]
  filterMode: FilterMode
  selectedCategoryId: string | null
  statusFilter: string | null
  tagFilterId: string | null
  onSelectAll: () => void
  onSelectWishlist: () => void
  onSelectCategory: (id: string | null) => void
  onSelectStatus: (status: string) => void
  onSelectTag: (tagId: string) => void
  onCategoriesChange: () => void
  onTagsChange?: () => void
}

export default function PatternSidebar({
  patterns,
  filterMode,
  selectedCategoryId,
  statusFilter,
  tagFilterId,
  onSelectAll,
  onSelectWishlist,
  onSelectCategory,
  onSelectStatus,
  onSelectTag,
  onCategoriesChange,
  onTagsChange,
}: PatternSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState('#C17F6B')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [tagModalVisible, setTagModalVisible] = useState(false)
  const [tagEditId, setTagEditId] = useState<string | null>(null)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#8FA88A')

  const loadCategories = async () => {
    try {
      await ensureUncategorized()
      const cats = await getCategories()
      cats.sort((a, b) => a.sort_order - b.sort_order)
      setCategories(cats)
    } catch (e) {
      console.error('加载分类失败:', e)
    }
  }
  const loadTags = async () => {
    try {
      setTags(await getTags())
    } catch (e) {
      console.error('加载标签失败:', e)
    }
  }

  useEffect(() => {
    void loadCategories()
    void loadTags()
  }, [])

  // 统计
  const wishlistCount = patterns.filter(
    (p) => (p.metadata as Record<string, unknown>)?.patternStatus === 'wishlist',
  ).length
  const statusCounts: Record<string, number> = {
    'not-started': patterns.filter((p) => (p.metadata as Record<string, unknown>)?.patternStatus === 'not-started').length,
    'in-progress': patterns.filter((p) => (p.metadata as Record<string, unknown>)?.patternStatus === 'in-progress').length,
    completed: patterns.filter((p) => (p.metadata as Record<string, unknown>)?.patternStatus === 'completed').length,
  }

  const categoryCount = (catId: string) =>
    patterns.filter((p) => p.category_id === catId).length

  // 分类操作
  const handleSave = async () => {
    if (!catName.trim()) {
      message.warning('请输入分类名称')
      return
    }
    try {
      if (editId) {
        await updateCategory(editId, { name: catName.trim(), color: catColor })
        message.success('分类已更新')
      } else {
        await createCategory(catName.trim(), catColor)
        message.success('分类已创建')
      }
    } catch (e: any) {
      console.error('保存分类失败:', e)
      message.error(e?.message || '保存失败')
    }
    setModalVisible(false)
    setCatName('')
    setEditId(null)
    // 仍然刷新分类列表（即使保存失败，也可能部分成功）
    await loadCategories()
    onCategoriesChange()
  }

  const handleEdit = (id: string) => {
    const cat = categories.find((c) => c.id === id)
    if (!cat) return
    setEditId(id)
    setCatName(cat.name)
    setCatColor(cat.color || '#C17F6B')
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id)
      message.success('分类已删除')
      await loadCategories()
      onCategoriesChange()
    } catch (e) {
      console.error('删除分类失败:', e)
      message.error('删除失败')
    }
  }

  // 拖拽排序
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragId && dragId !== id) setDragOverId(id)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = dragId
    setDragId(null)
    setDragOverId(null)
    if (!sourceId || sourceId === targetId) return
    const source = categories.find((c) => c.id === sourceId)
    const target = categories.find((c) => c.id === targetId)
    if (!source || !target) return
    // 交换 sort_order
    try {
      const tmp = source.sort_order
      await Promise.all([
        updateCategory(sourceId, { sort_order: target.sort_order }),
        updateCategory(targetId, { sort_order: tmp }),
      ])
    } catch (e) {
      console.error('排序失败:', e)
      message.error('排序失败')
    }
    await loadCategories()
    onCategoriesChange()
  }

  // 标签操作
  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      message.warning('请输入标签名')
      return
    }
    try {
      if (tagEditId) {
        await updateTag(tagEditId, { name: tagName.trim(), color: tagColor })
      } else {
        await createTag(tagName.trim(), tagColor)
      }
    } catch (e) {
      console.error('保存标签失败:', e)
      message.error('保存失败')
    }
    setTagModalVisible(false)
    setTagName('')
    setTagEditId(null)
    await loadTags()
    onTagsChange?.()
  }

  const handleDeleteTag = async (id: string) => {
    try {
      await deleteTag(id)
      await loadTags()
      onTagsChange?.()
    } catch (e) {
      console.error('删除标签失败:', e)
      message.error('删除失败')
    }
  }

  const statusItems = [
    { status: 'not-started', label: '未开始', icon: <ClockCircleOutlined />, color: '#9B8E80' },
    { status: 'in-progress', label: '进行中', icon: <SyncOutlined />, color: '#FFAAA5' },
    { status: 'completed', label: '已完成', icon: <CheckCircleOutlined />, color: '#8FA88A' },
  ]

  return (
    <div className="patterns-sidebar warm-antd">
      <div className="patterns-sidebar-header">
        <h1>🧶 编织图解</h1>
        <p>织集管理器</p>
      </div>

      <div className="patterns-sidebar-scroll">
        {/* 全部图解 */}
        <div
          className={`sidebar-item ${filterMode === 'all' ? 'sidebar-item-active' : ''}`}
          onClick={onSelectAll}
        >
          <AppstoreOutlined />
          <span style={{ flex: 1 }}>全部图解</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>({patterns.length})</span>
        </div>

        {/* 心愿单 */}
        <div
          className={`sidebar-item ${filterMode === 'wishlist' ? 'sidebar-item-wishlist-active' : ''}`}
          onClick={onSelectWishlist}
        >
          <HeartOutlined style={{ color: filterMode === 'wishlist' ? '#FFAAA5' : '#C0B0A8' }} />
          <span style={{ flex: 1 }}>心愿单</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>({wishlistCount})</span>
        </div>

        <div className="sidebar-divider" />

        {/* 分类列表 */}
        {categories.map((cat) => {
          const isDragging = dragId === cat.id
          const isDragOver = dragOverId === cat.id
          const isCatSelected = filterMode === 'category' && selectedCategoryId === cat.id
          return (
            <div
              key={cat.id}
              className={`sidebar-item ${isCatSelected ? 'sidebar-item-active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, cat.id)}
              onDragOver={(e) => handleDragOver(e, cat.id)}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDrop(e, cat.id)}
              style={{
                cursor: 'grab',
                opacity: isDragging ? 0.4 : 1,
                border: isDragOver ? '1px dashed #8AA0A8' : '1px solid transparent',
              }}
            >
              <HolderOutlined style={{ fontSize: 12, color: '#D0C8C0', flexShrink: 0 }} />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: cat.color || '#C17F6B',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {cat.name}
              </span>
              <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>
                ({categoryCount(cat.id)})
              </span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <EditOutlined
                  style={{ fontSize: 12, color: '#9B8E80' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit(cat.id)
                  }}
                />
                <Popconfirm
                  title="确定删除此分类？"
                  onConfirm={(e) => {
                    e?.stopPropagation()
                    handleDelete(cat.id)
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="确定"
                  cancelText="取消"
                >
                  <DeleteOutlined
                    style={{ fontSize: 12, color: '#9B8E80' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </span>
            </div>
          )
        })}

        {/* 添加分类按钮 */}
        <div
          className="sidebar-item"
          onClick={() => {
            setEditId(null)
            setCatName('')
            setCatColor('#C17F6B')
            setModalVisible(true)
          }}
        >
          <PlusOutlined style={{ color: '#9B8E80' }} />
          <span style={{ flex: 1, color: '#9B8E80' }}>添加分类</span>
        </div>

        <div className="sidebar-divider" />

        {/* 编织状态 */}
        <div style={{ padding: '0 4px' }}>
          <div className="sidebar-section-label">编织状态</div>
          {statusItems.map(({ status, label, icon, color }) => (
            <div
              key={status}
              className={`sidebar-item ${
                filterMode === 'status' && statusFilter === status ? 'sidebar-item-wishlist-active' : ''
              }`}
              onClick={() => onSelectStatus(status)}
            >
              <span style={{ color: filterMode === 'status' && statusFilter === status ? '#FFAAA5' : color, fontSize: 14 }}>
                {icon}
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>({statusCounts[status] || 0})</span>
            </div>
          ))}
        </div>

        <div className="sidebar-divider" />

        {/* 标签筛选 */}
        <div style={{ padding: '0 4px' }}>
          <div
            className="sidebar-section-label"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>自定义标签</span>
            <EditOutlined
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => {
                setTagEditId(null)
                setTagName('')
                setTagColor('#8FA88A')
                setTagModalVisible(true)
              }}
            />
          </div>
          {tags.length === 0 ? (
            <div style={{ fontSize: 12, color: '#D0C8C0', padding: '4px 14px', textAlign: 'center' }}>
              点击 ✎ 创建标签
            </div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className={`sidebar-item ${
                  filterMode === 'tag' && tagFilterId === tag.id ? 'sidebar-item-wishlist-active' : ''
                }`}
                onClick={() => onSelectTag(tag.id)}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: tag.color || '#8FA88A',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag.name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 分类编辑弹窗 */}
      <Modal
        title={editId ? '编辑分类' : '新建分类'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>分类名称</label>
          <Input
            placeholder="例如：短袖Tee"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            onPressEnter={handleSave}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>标识颜色</label>
          <ColorPicker
            value={catColor}
            onChange={(_, hex) => setCatColor(hex)}
            presets={[{ label: '马卡龙色系', colors: MACARON_COLORS }]}
          />
        </div>
      </Modal>

      {/* 标签管理弹窗 */}
      <Modal
        title="管理标签"
        open={tagModalVisible}
        onCancel={() => setTagModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="标签名"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            onPressEnter={handleSaveTag}
            style={{ flex: 1 }}
          />
          <ColorPicker
            value={tagColor}
            onChange={(_, hex) => setTagColor(hex)}
            presets={[{ label: '常用颜色', colors: MACARON_COLORS }]}
          />
          <Button type="primary" onClick={handleSaveTag}>
            {tagEditId ? '保存' : '新建'}
          </Button>
          {tagEditId && (
            <Button
              onClick={() => {
                setTagEditId(null)
                setTagName('')
                setTagColor('#8FA88A')
              }}
            >
              取消
            </Button>
          )}
        </div>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {tags.map((tag) => (
            <div
              key={tag.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderBottom: '1px solid #F5F0ED',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: tag.color || '#8FA88A',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 13 }}>{tag.name}</span>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setTagEditId(tag.id)
                  setTagName(tag.name)
                  setTagColor(tag.color || '#8FA88A')
                }}
                style={{ width: 24, height: 24, padding: 0 }}
              />
              <Popconfirm
                title="删除此标签？"
                onConfirm={() => handleDeleteTag(tag.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ width: 24, height: 24, padding: 0, color: '#ff4d4f' }}
                />
              </Popconfirm>
            </div>
          ))}
          {tags.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9B8E80', padding: 20 }}>
              暂无标签，在上方创建
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
