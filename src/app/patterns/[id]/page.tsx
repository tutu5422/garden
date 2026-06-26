'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Select, message, Popconfirm, Input, Space } from 'antd'
import {
  DeleteOutlined,
  FilePdfOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  DownloadOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import SmartImage from '@/components/shared/SmartImage'
import PatternTimeline from '@/components/patterns/PatternTimeline'
import BgmSelector from '@/components/patterns/BgmSelector'
import type { Resource, Category, Tag } from '@/lib/types'
import {
  getPattern as apiGetPattern,
  deletePattern as apiDeletePattern,
  updatePattern as apiUpdatePattern,
  getCategories as apiGetCategories,
  getTags as apiGetTags,
} from '@/lib/api/patterns-api'
import { dbFetch, dbUpsert } from '@/lib/supabase-admin'

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
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesText, setNotesText] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 从 API 加载图解
      const p = await apiGetPattern(patternId)
      if (p) {
        setPattern(p)
        setNotesText(((p.metadata as Record<string, unknown>)?.patternNotes as string) || '')
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
      const notesRes = await dbFetch(`pattern_notes?select=note_id&pattern_id=eq.${patternId}`)
      if (notesRes.ok && notesRes.body) {
        const links = notesRes.body as { note_id: string }[]
        const noteIds = links.map(l => l.note_id)
        // 从 notes 表查询关联笔记
        if (noteIds.length > 0) {
          const notesRes2 = await dbFetch(`notes?in=id.(${noteIds.join(',')})&order=created_at.desc`)
          if (notesRes2.ok && notesRes2.body) {
            setNotes((notesRes2.body as any[]) || [])
          }
        } else {
          setNotes([])
        }
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
  const brand = (meta.patternBrand as string) || ''
  const yarn = (meta.patternYarn as string) || ''
  const difficulty = (meta.patternDifficulty as string) || ''
  const craftType = (meta.patternCraftType as string) || ''
  const pages = (meta.patternPages as number) || 0
  const bgmTrackId = meta.patternBgmTrackId as string | undefined
  const bgmTrackTitle = meta.patternBgmTrackTitle as string | undefined
  const bgmTrackArtist = meta.patternBgmTrackArtist as string | undefined

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
      await dbFetch(`resource_tags?resource_id=eq.${patternId}`, { method: 'DELETE' })
      for (const tagId of tagIds) {
        await dbUpsert('resource_tags', { resource_id: patternId, tag_id: tagId })
      }
      setPatternTagIds(tagIds)
      await loadData()
    } catch (e) {
      console.error('更新标签失败:', e)
    }
  }

  const handleSaveNotes = () => {
    updatePatternField('patternNotes', notesText)
    setEditingNotes(false)
    message.success('备注已保存')
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

  const handleBgmSelect = async (trackId: string, title: string, artist?: string) => {
    if (!pattern) return
    try {
      const meta = { ...(pattern.metadata as Record<string, unknown>) } as Record<string, unknown>
      meta.patternBgmTrackId = trackId
      meta.patternBgmTrackTitle = title
      meta.patternBgmTrackArtist = artist || ''
      meta.patternLastUsedAt = new Date().toISOString()
      const updated = await apiUpdatePattern(patternId, { metadata: meta } as any)
      if (updated) setPattern(updated)
    } catch (e) {
      console.error('更新BGM失败:', e)
    }
  }

  const handleBgmRemove = async () => {
    if (!pattern) return
    try {
      const meta = { ...(pattern.metadata as Record<string, unknown>) } as Record<string, unknown>
      delete meta.patternBgmTrackId
      delete meta.patternBgmTrackTitle
      delete meta.patternBgmTrackArtist
      meta.patternLastUsedAt = new Date().toISOString()
      const updated = await apiUpdatePattern(patternId, { metadata: meta } as any)
      if (updated) setPattern(updated)
    } catch (e) {
      console.error('移除BGM失败:', e)
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
            <div style={{ height: 200, background: '#F5F0ED', borderRadius: 12, marginBottom: 16 }} />
            <div style={{ height: 20, background: '#F0E0DA', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 14, background: '#F0E0DA', borderRadius: 4, width: '60%' }} />
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

  const difficultyLabels: Record<string, string> = {
    beginner: '★ 初学',
    easy: '★★ 简单',
    intermediate: '★★★ 中级',
    advanced: '★★★★ 高级',
    expert: '★★★★★ 大师',
  }

  return (
    <div className="warm-antd" style={{ background: 'linear-gradient(175deg,#F5F0E8 0%,#EDE4D8 40%,#F0E8DC 100%)', minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* 返回栏 */}
      <div style={{ padding: '12px 24px', background: 'var(--warm-surface)', borderBottom: '1px solid var(--warm-header-border)' }}>
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
                    background: '#F5F0ED',
                    borderRadius: 12,
                    color: '#D0C8C0',
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
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#3D3228', marginBottom: 12, wordBreak: 'break-all' }}>
              {pattern.title}
            </h2>

            {/* 分类 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#8A8A8A', fontSize: 13 }}>分类</label>
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
              <label style={{ display: 'block', marginBottom: 6, color: '#8A8A8A', fontSize: 13 }}>编织状态</label>
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
              <label style={{ display: 'block', marginBottom: 6, color: '#8A8A8A', fontSize: 13 }}>标签</label>
              <Select
                mode="multiple"
                placeholder="添加标签..."
                value={patternTagIds}
                onChange={handleTagsChange}
                style={{ width: '100%' }}
                options={allTags.map((t) => ({ label: t.name, value: t.id }))}
              />
            </div>

            {/* 元数据 */}
            {(brand || yarn || difficulty || craftType || pages) && (
              <div style={{ marginBottom: 16, padding: 12, background: '#FFF8F5', borderRadius: 8, fontSize: 13, color: '#4A4A4A' }}>
                {brand && <div style={{ marginBottom: 4 }}><strong>品牌：</strong>{brand}</div>}
                {yarn && <div style={{ marginBottom: 4 }}><strong>线材：</strong>{yarn}</div>}
                {difficulty && <div style={{ marginBottom: 4 }}><strong>难度：</strong>{difficultyLabels[difficulty] || difficulty}</div>}
                {craftType && <div style={{ marginBottom: 4 }}><strong>编织方式：</strong>{craftType === 'knit' ? '棒针' : craftType === 'crochet' ? '钩针' : '棒针/钩针'}</div>}
                {pages > 0 && <div><strong>页数：</strong>{pages} 页</div>}
              </div>
            )}

            {/* 编织笔记 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#8A8A8A', fontSize: 13 }}>编织笔记</span>
                {!editingNotes ? (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingNotes(true)
                      setNotesText(((pattern.metadata as Record<string, unknown>)?.patternNotes as string) || '')
                    }}
                    style={{ color: '#C0B0A8', padding: '0 4px' }}
                  />
                ) : (
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={handleSaveNotes}
                      style={{ color: '#52C41A', padding: '0 4px' }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => {
                        setEditingNotes(false)
                        setNotesText(((pattern.metadata as Record<string, unknown>)?.patternNotes as string) || '')
                      }}
                      style={{ color: '#ff4d4f', padding: '0 4px' }}
                    />
                  </Space>
                )}
              </div>
              {editingNotes ? (
                <Input.TextArea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="记录编织心得、用针、线材等..."
                  rows={4}
                  style={{ fontSize: 13 }}
                />
              ) : (
                <div style={{ fontSize: 13, color: notesText ? '#4A4A4A' : '#C0B0A8', whiteSpace: 'pre-wrap' }}>
                  {notesText || '暂无备注，点击编辑图标添加'}
                </div>
              )}
            </div>

            {/* BGM */}
            <div style={{ marginBottom: 16 }}>
              <BgmSelector
                currentTrackId={bgmTrackId}
                currentTrackTitle={bgmTrackTitle}
                currentTrackArtist={bgmTrackArtist}
                onSelect={handleBgmSelect}
                onRemove={handleBgmRemove}
              />
            </div>

            {/* 文件信息 */}
            <div style={{ fontSize: 13, color: '#A09088', marginBottom: 16 }}>
              <div>导入时间：{new Date(pattern.created_at).toLocaleDateString('zh-CN')}</div>
              {pattern.url && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={pattern.url} target="_blank" rel="noopener noreferrer">
                    <Button size="small" icon={<LinkOutlined />}>预览</Button>
                  </a>
                  <a href={pattern.url} download>
                    <Button size="small" icon={<DownloadOutlined />}>下载</Button>
                  </a>
                </div>
              )}
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
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#3D3228', marginBottom: 12 }}>
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
                  color: '#A09088',
                  gap: 12,
                }}
              >
                <FilePdfOutlined style={{ fontSize: 64, opacity: 0.4 }} />
                <p>暂无 PDF 文件</p>
                <Link href="/patterns/upload">
                  <Button type="primary" icon={<LinkOutlined />}>上传图解</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
