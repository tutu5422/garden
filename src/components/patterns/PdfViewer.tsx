'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from 'antd'
import { LinkOutlined, LoadingOutlined, LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'

interface PdfViewerProps {
  url: string
  fileName?: string
}

export default function PdfViewer({ url, fileName }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [rendering, setRendering] = useState(false)
  const pdfRef = useRef<any>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // 获取容器宽度用于自适应缩放
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  // 加载 PDF
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setError(null)
    setPageCount(0)
    setPageNum(1)

    async function load() {
      try {
        // 动态导入 pdfjs（避免 SSR 问题）
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument(url).promise
        if (cancelled) return
        pdfRef.current = pdf
        setPageCount(pdf.numPages)
        setLoaded(true)
      } catch (e: any) {
        if (cancelled) return
        console.error('PDF 加载失败:', e)
        setError(e?.message || 'PDF 加载失败')
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  // 渲染当前页
  useEffect(() => {
    if (!loaded || !pdfRef.current || !canvasRef.current) return
    let cancelled = false

    async function render() {
      setRendering(true)
      try {
        const pdf = pdfRef.current
        const page = await pdf.getPage(pageNum)
        if (cancelled) return

        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        const devicePixelRatio = window.devicePixelRatio || 1

        // 自适应宽度
        const maxWidth = containerWidth - 32 || 600
        const vp = page.getViewport({ scale: 1 })
        const fitScale = Math.min(maxWidth / vp.width, 2.5)
        const finalScale = Math.min(scale, fitScale)
        const viewport = page.getViewport({ scale: finalScale })

        canvas.width = viewport.width * devicePixelRatio
        canvas.height = viewport.height * devicePixelRatio
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        const renderContext = {
          canvasContext: ctx,
          viewport,
          transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
        }
        await page.render(renderContext).promise
        if (cancelled) return
      } catch (e: any) {
        console.error('页面渲染失败:', e)
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    render()
    return () => { cancelled = true }
  }, [loaded, pageNum, scale, containerWidth])

  const goPrev = useCallback(() => {
    setPageNum((p) => Math.max(1, p - 1))
  }, [])

  const goNext = useCallback(() => {
    setPageNum((p) => Math.min(pageCount, p + 1))
  }, [pageCount])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.3, 3))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.3, 0.5))
  }, [])

  // 加载中
  if (!loaded && !error) {
    return (
      <div className="pdf-viewer-loading">
        <LoadingOutlined style={{ fontSize: 32, color: 'var(--skin-primary)' }} />
        <p>正在加载 PDF...</p>
      </div>
    )
  }

  // 错误回退
  if (error) {
    return (
      <div className="pdf-viewer-error">
        <div className="pdf-viewer-error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C17F6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <h3 className="pdf-viewer-error-title">无法预览</h3>
        <p className="pdf-viewer-error-desc">当前浏览器不支持直接预览此 PDF</p>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ width: '100%', maxWidth: 280 }}>
          <Button type="primary" size="large" icon={<LinkOutlined />} block style={{ height: 48, borderRadius: 12, fontSize: 16 }}>
            打开图解
          </Button>
        </a>
      </div>
    )
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>
      {/* 工具栏 */}
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-toolbar-group">
          <button className="pdf-viewer-toolbar-btn" onClick={zoomOut} title="缩小">
            <ZoomOutOutlined />
          </button>
          <span className="pdf-viewer-toolbar-zoom">{Math.round(scale * 100)}%</span>
          <button className="pdf-viewer-toolbar-btn" onClick={zoomIn} title="放大">
            <ZoomInOutlined />
          </button>
        </div>
        <div className="pdf-viewer-toolbar-group">
          <button className="pdf-viewer-toolbar-btn" onClick={goPrev} disabled={pageNum <= 1} title="上一页">
            <LeftOutlined />
          </button>
          <span className="pdf-viewer-toolbar-page">
            {pageNum} / {pageCount}
          </span>
          <button className="pdf-viewer-toolbar-btn" onClick={goNext} disabled={pageNum >= pageCount} title="下一页">
            <RightOutlined />
          </button>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="pdf-viewer-toolbar-open" title="新标签打开">
          <LinkOutlined />
        </a>
      </div>

      {/* Canvas 渲染区 */}
      <div className="pdf-viewer-canvas-wrap">
        {rendering && (
          <div className="pdf-viewer-rendering-overlay">
            <LoadingOutlined style={{ fontSize: 24, color: 'var(--skin-primary)' }} />
          </div>
        )}
        <canvas ref={canvasRef} className="pdf-viewer-canvas" />
      </div>
    </div>
  )
}
