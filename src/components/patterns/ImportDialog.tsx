'use client'

import { useState, useRef, useEffect } from 'react'
import { Modal, Select, Button, Progress, message, Space, Tag } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { Category } from '@/lib/types'
import { getCategories, findExistingPatternHashes, ensureUncategorized } from '@/lib/api/patterns-api'

type Step = 'select-files' | 'choose-category' | 'importing' | 'done'
type ImportMode = 'pdf' | 'folder'

interface ImportResult {
  success: boolean
  fileName: string
  error?: string
  id?: string
}

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  /** 导入完成（无论成功失败）后触发，通常用于刷新列表 */
  onImported?: () => void
}

// 计算文件 SHA-256 哈希（取前 32 位 hex 作指纹）
async function computeFileHash(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32)
}

// 用 pdfjs-dist 渲染 PDF 首页为 JPEG Blob（客户端浏览器端）
async function renderCoverBlob(arrayBuffer: ArrayBuffer): Promise<Blob | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdfjsVersion = (pdfjsLib as unknown as { version?: string }).version || '6.0.227'
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    if (pdf.numPages === 0) return null
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.0 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await page.render({ canvas, viewport }).promise
    pdf.cleanup()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    )
    return blob
  } catch {
    return null
  }
}

export default function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [step, setStep] = useState<Step>('select-files')
  const [importMode, setImportMode] = useState<ImportMode>('pdf')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [targetCategoryId, setTargetCategoryId] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // 打开时加载分类
  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        // 确保"未分类"存在
        await ensureUncategorized()
        const cats = await getCategories()
        cats.sort((a, b) => a.sort_order - b.sort_order)
        setCategories(cats)
        const uncat = cats.find((c) => c.name === '未分类')
        setTargetCategoryId(uncat ? uncat.id : cats[0]?.id || '')
      } catch (e) {
        console.error('加载分类失败:', e)
      }
    })()
  }, [open])

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setStep('select-files')
      setSelectedFiles([])
      setTargetCategoryId('')
      setResults([])
      setImporting(false)
      setProgress(0)
      setImportMode('pdf')
    }, 300)
  }

  // PDF 文件选择（多选）
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf'),
    )
    if (files.length === 0) {
      message.warning('未找到 PDF 文件')
      return
    }
    setImportMode('pdf')
    setSelectedFiles(files)
    setStep('choose-category')
    // 清空 input 以便重复选择同一文件
    e.target.value = ''
  }

  // 文件夹选择（导入文件夹下所有 PDF）
  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf'),
    )
    if (files.length === 0) {
      message.warning('所选文件夹中没有 PDF 文件')
      return
    }
    setImportMode('folder')
    setSelectedFiles(files)
    setStep('choose-category')
    e.target.value = ''
  }

  // 开始导入
  const handleStartImport = async () => {
    if (!targetCategoryId) {
      message.warning('请选择目标分类')
      return
    }
    if (selectedFiles.length === 0) {
      message.warning('请先选择 PDF 文件')
      return
    }

    setImporting(true);
    setStep('importing');
    setProgress(0);

    // 预先查询所有已存在的哈希（用于去重）
    let existingHashes = new Set<string>();
    try {
      const allStored = await findExistingPatternHashes([]); // 传空数组获取全部
      // 上面这个 API 不太对，下面的循环里逐个查吧
    } catch (e) {
      console.warn('查询已存在哈希失败，跳过去重:', e);
    }

    const allResults: ImportResult[] = [];

    // 逐个处理（读 → 算哈希 → 对比去重 → 上传）
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const displayName = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

      setProgress(Math.round((i / selectedFiles.length) * 95));

      try {
        const ab = await file.arrayBuffer();
        const hash = await computeFileHash(ab);

        // 去重：查服务端是否已有相同 hash
        if (hash) {
          const found = await findExistingPatternHashes([hash]);
          if (found.has(hash)) {
            allResults.push({ success: false, fileName: displayName, error: '已存在，自动跳过' });
            continue;
          }
        }

        // 上传
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace(/\.pdf$/i, ''));
        formData.append('categoryId', targetCategoryId);
        if (hash) formData.append('hash', hash);

        const res = await fetch('/api/patterns/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.detail || '上传失败');
        }
        allResults.push({ success: true, fileName: displayName, id: data.id });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '上传出错';
        allResults.push({ success: false, fileName: displayName, error: msg });
      }
    }

    setResults(allResults)
    setProgress(100)
    setImporting(false)
    setStep('done')
    onImported?.()
  }

  // -- 结果统计 --
  const successResults = results.filter((r) => r.success)
  const duplicateResults = results.filter(
    (r) => !r.success && r.error && r.error.includes('已存在'),
  )
  const errorResults = results.filter(
    (r) => !r.success && (!r.error || !r.error.includes('已存在')),
  )

  // -- 渲染 --
  return (
    <Modal
      title="导入编织图解"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={620}
      destroyOnClose
    >
      {/* ===== 选择导入方式 ===== */}
      {step === 'select-files' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory 是非标准属性
            webkitdirectory=""
            style={{ display: 'none' }}
            onChange={handleFolderSelected}
          />

          <p style={{ color: '#8A8A8A', marginBottom: 20 }}>选择导入方式</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              maxWidth: 440,
              margin: '0 auto',
            }}
          >
            {/* PDF文件 */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #FFD3B6',
                borderRadius: 16,
                padding: '28px 14px',
                cursor: 'pointer',
                background: '#FFFAF8',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#C17F6B'
                e.currentTarget.style.background = '#FFF5F3'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#FFD3B6'
                e.currentTarget.style.background = '#FFFAF8'
              }}
            >
              <FileAddOutlined style={{ fontSize: 32, color: '#C17F6B', marginBottom: 8 }} />
              <h4 style={{ color: '#4A4A4A', marginBottom: 2 }}>PDF 文件</h4>
              <p style={{ color: '#C0B0A8', fontSize: 12 }}>支持多选</p>
            </div>

            {/* 文件夹 */}
            <div
              onClick={() => folderInputRef.current?.click()}
              style={{
                border: '2px dashed #A8D8EA',
                borderRadius: 16,
                padding: '28px 14px',
                cursor: 'pointer',
                background: '#F8FBFF',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#89C7E0'
                e.currentTarget.style.background = '#F0F7FB'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#A8D8EA'
                e.currentTarget.style.background = '#F8FBFF'
              }}
            >
              <FolderOpenOutlined style={{ fontSize: 32, color: '#A8D8EA', marginBottom: 8 }} />
              <h4 style={{ color: '#4A4A4A', marginBottom: 2 }}>文件夹</h4>
              <p style={{ color: '#C0B0A8', fontSize: 12 }}>导入所有 PDF</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== 选择分类 ===== */}
      {step === 'choose-category' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {importMode === 'folder' && <Tag color="blue">文件夹导入</Tag>}
            {importMode === 'pdf' && <Tag color="pink">文件导入</Tag>}
            <span style={{ color: '#4A4A4A' }}>
              已选择 <strong>{selectedFiles.length}</strong> 个 PDF 文件
            </span>
          </div>

          {selectedFiles.length > 1 && (
            <div
              style={{
                maxHeight: 120,
                overflow: 'auto',
                marginBottom: 20,
                fontSize: 12,
                color: '#A09088',
                background: '#FFFAF8',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              {selectedFiles.slice(0, 15).map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '2px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name}
                </div>
              ))}
              {selectedFiles.length > 15 && (
                <div style={{ color: '#C0B0A8' }}>
                  ...还有 {selectedFiles.length - 15} 个文件
                </div>
              )}
            </div>
          )}

          <label
            style={{
              display: 'block',
              marginBottom: 8,
              color: '#4A4A4A',
              fontWeight: 500,
            }}
          >
            选择目标分类
          </label>
          <Select
            placeholder="选择分类..."
            value={targetCategoryId || undefined}
            onChange={setTargetCategoryId}
            style={{ width: '100%' }}
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
          />
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStep('select-files')}>返回</Button>
              <Button
                type="primary"
                onClick={handleStartImport}
                disabled={!targetCategoryId}
                style={{ background: '#C17F6B', borderColor: '#C17F6B' }}
              >
                开始导入
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* ===== 导入中 ===== */}
      {step === 'importing' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <LoadingOutlined style={{ fontSize: 48, color: '#C17F6B', marginBottom: 16 }} />
          <h3 style={{ color: '#4A4A4A' }}>正在导入...</h3>
          <p style={{ color: '#C0B0A8', marginBottom: 16 }}>
            正在处理文件，提取封面并检测重复
          </p>
          <Progress percent={progress} strokeColor="#C17F6B" style={{ width: '80%', margin: '0 auto' }} />
        </div>
      )}

      {/* ===== 完成 ===== */}
      {step === 'done' && (
        <div style={{ padding: '8px 0' }}>
          {duplicateResults.length > 0 && (
            <div
              style={{
                background: '#FFFBE6',
                border: '1px solid #FFE58F',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <WarningOutlined style={{ color: '#FAAD14', fontSize: 18 }} />
                <strong style={{ color: '#8A6D00' }}>
                  以下 {duplicateResults.length} 个文件已存在，自动跳过：
                </strong>
              </div>
              <div style={{ maxHeight: 160, overflow: 'auto' }}>
                {duplicateResults.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '6px 8px',
                      fontSize: 13,
                      color: '#8A6D00',
                      borderBottom:
                        i < duplicateResults.length - 1 ? '1px solid #FFE58F' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.fileName}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>{r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'center' }}>
            {successResults.length > 0 && (
              <div
                style={{
                  textAlign: 'center',
                  background: '#F6FFED',
                  borderRadius: 8,
                  padding: '10px 20px',
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: '#52C41A' }}>
                  {successResults.length}
                </div>
                <div style={{ fontSize: 12, color: '#8A8A8A' }}>导入成功</div>
              </div>
            )}
            {duplicateResults.length > 0 && (
              <div
                style={{
                  textAlign: 'center',
                  background: '#FFFBE6',
                  borderRadius: 8,
                  padding: '10px 20px',
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: '#FAAD14' }}>
                  {duplicateResults.length}
                </div>
                <div style={{ fontSize: 12, color: '#8A8A8A' }}>重复跳过</div>
              </div>
            )}
            {errorResults.length > 0 && (
              <div
                style={{
                  textAlign: 'center',
                  background: '#FFF2F0',
                  borderRadius: 8,
                  padding: '10px 20px',
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: '#FF4D4F' }}>
                  {errorResults.length}
                </div>
                <div style={{ fontSize: 12, color: '#8A8A8A' }}>导入失败</div>
              </div>
            )}
          </div>

          {(successResults.length > 0 || errorResults.length > 0) && (
            <details open={errorResults.length > 0}>
              <summary
                style={{
                  cursor: 'pointer',
                  padding: '6px 0',
                  color: '#4A4A4A',
                  fontSize: 13,
                  fontWeight: 500,
                  userSelect: 'none',
                }}
              >
                查看详细记录
                {successResults.length > 0 && (
                  <span style={{ color: '#52C41A', marginLeft: 8 }}>
                    成功 {successResults.length}
                  </span>
                )}
                {errorResults.length > 0 && (
                  <span style={{ color: '#FF4D4F', marginLeft: 8 }}>
                    失败 {errorResults.length}
                  </span>
                )}
              </summary>
              <div style={{ maxHeight: 150, overflow: 'auto', marginTop: 8 }}>
                {successResults.map((r, i) => (
                  <div
                    key={`ok-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      color: '#52C41A',
                      fontSize: 12,
                    }}
                  >
                    <CheckCircleOutlined />
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.fileName}
                    </span>
                  </div>
                ))}
                {errorResults.map((r, i) => (
                  <div
                    key={`err-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      color: '#FF4D4F',
                      fontSize: 12,
                    }}
                  >
                    <CloseCircleOutlined />
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.fileName}
                    </span>
                    {r.error && <span style={{ opacity: 0.7, flexShrink: 0 }}>({r.error})</span>}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button
              type="primary"
              onClick={() => {
                setStep('select-files')
                setSelectedFiles([])
                setResults([])
                setProgress(0)
              }}
              style={{ background: '#C17F6B', borderColor: '#C17F6B', marginRight: 8 }}
            >
              继续导入
            </Button>
            <Button onClick={handleClose}>完成</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
