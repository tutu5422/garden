'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Select, message, Popconfirm } from 'antd'
import {
  DeleteOutlined,
  FilePdfOutlined,
  ArrowLeftOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import SmartImage from '@/components/shared/SmartImage'
import PatternTimeline from '@/components/patterns/PatternTimeline'
import type { Resource, Category, Tag } from '@/lib/types'
import {
  getPattern as apiGetPattern,
  deletePattern as apiDeletePattern,
  updatePattern as apiUpdatePattern,
  getCategories as apiGetCategories,
  getTags as apiGetTags,
  getNotesForPattern as apiGetNotesForPattern,
  setResourceTags as apiSetResourceTags,
} from '@/lib/api/patterns-api'

const statusOptions: { value: string; label: string; color: string }[] = [
  { value: 'not-started', label: '未开始', color: '#C0B0A8' },
  { value: 'in-progress', label: '进行中', color: '#FFAAA5' },
  { value: 'completed', label: '已完成', color: '#8FA88A' },
  { value: 'paused', label: '暂停', color: '#DECB9C' },
  { value: 'wishlist', label: '心愿单', color: '#C9807E' },
]

export default function PatternDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patternId = params.id as string

  const [pattern, setPattern] = useState<Resource | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [patternTagIds, setPatternTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 从 API 加载图解
      const p = await apiGetPattern(patternId)
      if (p) {
        setPattern(p)
        // 加载标签
        const ptIds = p.resource_tags?.map((rt: any) => rt.tag?.id).filter(Boolean) || []
        setPatternTagIds(ptIds)
      }
      // 加载分类和标签
      const cats = await apiGetCategories()
      setCategories(cats.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)))
      const tags = await apiGetTags()
      setAllTags(tags)

      // 加载关联笔记
      try {
        const links = await apiGetNotesForPattern(patternId)
        if (links.length > 0) {
          setNotes(links.map((l: any) => l.note).filter(Boolean))
        } else {
          setNotes([])
        }
      } catch (e) {
        console.error('加载关联笔记失败:', e)
        setNotes([])
      }
    } catch (e) {
      console.error('加载图解详情失败:', e)
    } finally {
      setLoading(false)
    }
  }, [patternId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const meta = (pattern?.metadata || {}) as Record<string, unknown>
  const status = (meta.patternStatus as string) || 'not-started'

  // 更新图解字段（通过 API）
  const updatePatternField = async (field: string, value: unknown) => {
    if (!pattern) return
    try {
      const meta = { ...(pattern.metadata as Record<string, unknown>) } as Record<string, unknown>
      meta[field] = value
      meta.patternLastUsedAt = new Date().toISOString()
      const updated = await apiUpdatePattern(patternId, { metadata: meta } as any)
      if (updated) setPattern(updated)
    } catch (e) {
      console.error('更新图解失败:', e)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    updatePatternField('patternStatus', newStatus)
    message.success('状态已更新')
  }

  const handleCategoryChange = async (categoryId: string | null) => {
    if (!pattern) return
    try {
      const updated = await apiUpdatePattern(patternId, { category_id: categoryId || undefined } as any)
      if (updated) setPattern(updated)
      await loadData()
    } catch (e) {
      console.error('更新分类失败:', e)
    }
  }

  const handleTagsChange = async (tagIds: string[]) => {
    if (!pattern) return
    try {
      // 通过 API 更新 resource_tags
      await apiSetResourceTags(patternId, tagIds)
      setPatternTagIds(tagIds)
      await loadData()
    } catch (e) {
      console.error('更新标签失败:', e)
    }
  }

  const handleDelete = async () => {
    try {
      await apiDeletePattern(patternId)
      message.success('图解已删除')
      router.push('/patterns')
    } catch (e: any) {
      message.error(e.message || '删除失败')
    }
  }

  const handleNewNote = () => {
    router.push(`/notes/edit?patternId=${patternId}`)
  }

  if (loading) {
    return (
      <div className="pattern-detail-layout warm-antd">
        <div className="pattern-detail-sidebar">
          <div className="pattern-detail-card" style={{ opacity: 0.5 }}>
            <div style={{ height: 200, background: 'var(--skin-muted)', borderRadius: 12, marginBottom: 16 }} />
            <div style={{ height: 20, background: 'var(--skin-muted)', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 14, background: 'var(--skin-muted)', borderRadius: 4, width: '60%' }} />
          </div>
        </div>
        <div className="pattern-detail-content">
          <div className="pdf-viewer-wrap" style={{ opacity: 0.5 }} />
        </div>
      </div>
    )
  }

  if (!pattern) {
    return (
      <div className="patterns-empty warm-antd">
        <FilePdfOutlined className="patterns-empty-icon" />
        <h3>图解不存在或已被删除</h3>
        <Link href="/patterns">
          <Button type="primary" icon={<ArrowLeftOutlined />}>返回织集</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="warm-antd" style={{ background: 'var(--skin-bg)', minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* 返回栏 */}
      <div style={{ padding: '12px 24px', background: 'var(--skin-surface)', borderBottom: '1px solid var(--skin-border)' }}>
        <Link href="/patterns">
          <Button type="text" icon={<ArrowLeftOutlined />}>返回织集</Button>
        </Link>
      </div>

      <div className="pattern-detail-layout">
        {/* 左侧侧栏 */}
        <div className="pattern-detail-sidebar">
          <div className="pattern-detail-card">
            {/* 封面预览 */}
            <div className="cover-preview">
              {pattern.cover_image_url ? (
                <SmartImage
                  src={pattern.cover_image_url}
                  alt={pattern.title}
                  width={300}
                  height={400}
                  className="object-cover"
                />
              ) : (
                <div
                  style={{
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--skin-muted)',
                    borderRadius: 12,
                    color: 'var(--skin-text-secondary)',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <FilePdfOutlined style={{ fontSize: 48 }} />
                  <span>暂无封面</span>
                </div>
              )}
            </div>

            {/* 标题 */}
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--skin-text)', marginBottom: 12, wordBreak: 'break-all' }}>
              {pattern.title}
            </h2>

            {/* 分类 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--skin-text-secondary)', fontSize: 13 }}>分类</label>
              <Select
                value={pattern.category_id || undefined}
                onChange={handleCategoryChange}
                placeholder="选择分类..."
                style={{ width: '100%' }}
                allowClear
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
              />
            </div>

            {/* 编织状态 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--skin-text-secondary)', fontSize: 13 }}>编织状态</label>
              <Select
                value={status}
                onChange={handleStatusChange}
                style={{ width: '100%' }}
                options={statusOptions.map((s) => ({
                  value: s.value,
                  label: (
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: s.color,
                          marginRight: 6,
                        }}
                      />
                      {s.label}
                    </span>
                  ),
                }))}
              />
            </div>

            {/* 标签管理 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--skin-text-secondary)', fontSize: 13 }}>标签</label>
              <Select
                mode="multiple"
                placeholder="添加标签..."
                value={patternTagIds}
                onChange={handleTagsChange}
                style={{ width: '100%' }}
                options={allTags.map((t) => ({ label: t.name, value: t.id }))}
              />
            </div>

            {/* 删除 */}
            <Popconfirm
              title="确定删除此图解？"
              description="删除后记录将被移除，无法恢复"
              onConfirm={handleDelete}
              okText="确定删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} block>删除图解</Button>
            </Popconfirm>
          </div>

          {/* 关联笔记时间线 */}
          <div className="pattern-detail-card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--skin-text)', marginBottom: 12 }}>
              📝 关联笔记 ({notes.length})
            </h3>
            <PatternTimeline notes={notes} onNewNote={handleNewNote} />
          </div>
        </div>

        {/* 右侧 PDF 查看器 */}
        <div className="pattern-detail-content">
          <div className="pdf-viewer-wrap">
            {pattern.url ? (
              <iframe
                src={pattern.url}
                title={pattern.title}
                style={{ width: '100%', height: '100%', border: 'none', minHeight: '600px' }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--skin-text-secondary)',
                  gap: 12,
                }}
              >
                <FilePdfOutlined style={{ fontSize: 64, opacity: 0.4 }} />
                <p>暂无 PDF 文件</p>
                <Link href="/patterns">
                  <Button type="primary" icon={<LinkOutlined />}>前往图解列表导入</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
