'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  Image,
  Loader2,
  ArrowLeft,
  Check,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

// 难度选项
const DIFFICULTIES = [
  { label: '★ 初学', value: 'beginner' },
  { label: '★★ 简单', value: 'easy' },
  { label: '★★★ 中级', value: 'intermediate' },
  { label: '★★★★ 高级', value: 'advanced' },
  { label: '★★★★★ 大师', value: 'expert' },
]

// 编织方式
const CRAFT_TYPES = [
  { label: '棒针', value: 'knit' },
  { label: '钩针', value: 'crochet' },
  { label: '两者皆可', value: 'both' },
]

// 常见图解类型
const PATTERN_TYPES = [
  '毛衣', '开衫', '披肩', '围巾', '帽子',
  '袜子', '手套', '毯子', '玩偶', '包包',
  '套头衫', '背心', '半身裙', '连衣裙', '家居',
]

export default function PatternUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 表单字段
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [yarn, setYarn] = useState('')
  const [difficulty, setDifficulty] = useState('beginner')
  const [craftType, setCraftType] = useState('knit')
  const [patternTypes, setPatternTypes] = useState<string[]>([])

  // 缩略图
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('')
  const [generatingThumb, setGeneratingThumb] = useState(false)

  // 提交状态
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  /**
   * 选择 PDF 后自动渲染首页为缩略图
   */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证是 PDF
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('请选择 PDF 文件')
      return
    }

    setPdfFile(file)
    setError('')

    // 自动填写标题（去掉 .pdf 后缀）
    if (!title) {
      setTitle(file.name.replace(/\.pdf$/i, ''))
    }

    // 生成缩略图
    setGeneratingThumb(true)
    try {
      // 动态加载 pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

      // 设置 worker（使用 unpkg CDN 避免类型问题）
      const pdfjsVersion = (pdfjsLib as any).version || '4.0.379'
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

      if (pdf.numPages > 0) {
        const page = await pdf.getPage(1)
        // 缩放比例 1.0 以获得较好质量的缩略图
        const viewport = page.getViewport({ scale: 1.0 })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise

        // 转换为 JPEG blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
        })

        if (blob) {
          setThumbnailBlob(blob)
          setThumbnailPreview(canvas.toDataURL('image/jpeg', 0.85))
        }

        pdf.cleanup()
      }
    } catch (err: any) {
      console.warn('生成缩略图失败:', err?.message || err)
      // 不阻止上传，缩略图可为空
    } finally {
      setGeneratingThumb(false)
    }
  }, [title])

  /**
   * 切换图解类型标签
   */
  const togglePatternType = (type: string) => {
    setPatternTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  /**
   * 提交表单
   */
  const handleSubmit = useCallback(async () => {
    if (!pdfFile) {
      setError('请选择 PDF 文件')
      return
    }
    if (!title.trim()) {
      setError('请输入图解名称')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', pdfFile)
      formData.append('title', title.trim())
      formData.append('brand', brand.trim())
      formData.append('yarn', yarn.trim())
      formData.append('difficulty', difficulty)
      formData.append('craftType', craftType)
      formData.append('patternType', patternTypes.join(','))

      // 如果有生成的缩略图，一起上传
      if (thumbnailBlob) {
        formData.append('cover', thumbnailBlob, 'cover.jpg')
      }

      const res = await fetch('/api/patterns/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.detail || '上传失败')
      }

      setSuccess(true)
      // 1.5 秒后跳转到图解详情页
      setTimeout(() => {
        router.push(`/patterns/${data.id}`)
      }, 1500)
    } catch (err: any) {
      setError(err.message || '上传出错')
    } finally {
      setUploading(false)
    }
  }, [pdfFile, title, brand, yarn, difficulty, craftType, patternTypes, thumbnailBlob, router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/patterns"
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-semibold text-lg">上传图解</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 成功提示 */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/60 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">上传成功！</p>
              <p className="text-sm opacity-80">正在跳转到图解详情页…</p>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* PDF 选择区域 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">图解 PDF</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!pdfFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-8 rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 transition-colors flex flex-col items-center gap-3 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-700 dark:text-gray-300">点击选择 PDF</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  支持 .pdf 格式，自动提取首页作为封面
                </p>
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border dark:border-gray-800 space-y-4">
              {/* PDF 文件信息 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{pdfFile.name}</p>
                  <p className="text-xs text-gray-400">
                    {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPdfFile(null)
                    setThumbnailBlob(null)
                    setThumbnailPreview('')
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                >
                  更换
                </button>
              </div>

              {/* 缩略图预览 */}
              {generatingThumb && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成缩略图…
                </div>
              )}
              {thumbnailPreview && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Image className="w-3.5 h-3.5" />
                    封面预览（自动生成）
                  </div>
                  <div className="relative rounded-xl overflow-hidden border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 max-h-80 flex items-center justify-center">
                    <img
                      src={thumbnailPreview}
                      alt="PDF 封面预览"
                      className="max-w-full max-h-80 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 基本信息 */}
        <div className="space-y-4 p-5 rounded-2xl bg-white dark:bg-gray-900 border dark:border-gray-800">
          <h2 className="font-medium text-sm text-gray-500 dark:text-gray-400">基本信息</h2>

          {/* 标题 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              图解名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这个图解起个名字"
              className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600 transition-shadow text-sm"
            />
          </div>

          {/* 品牌和线材 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">品牌</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="如：Rowan, DROPS"
                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600 transition-shadow text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">线材</label>
              <input
                type="text"
                value={yarn}
                onChange={(e) => setYarn(e.target.value)}
                placeholder="如：羊绒, 棉线"
                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600 transition-shadow text-sm"
              />
            </div>
          </div>

          {/* 难度 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">难度</label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm transition-all ${
                    difficulty === d.value
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-purple-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* 编织方式 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">编织方式</label>
            <div className="flex gap-2">
              {CRAFT_TYPES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCraftType(c.value)}
                  className={`px-4 py-1.5 rounded-xl text-sm transition-all ${
                    craftType === c.value
                      ? 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-pink-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 图解类型标签 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              图解类型
              <span className="text-xs text-gray-400 ml-2">（可多选）</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PATTERN_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => togglePatternType(t)}
                  className={`px-3 py-1.5 rounded-xl text-sm transition-all ${
                    patternTypes.includes(t)
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-purple-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={uploading || !pdfFile || !title.trim() || success}
          className={`w-full py-3.5 rounded-2xl font-medium text-white transition-all flex items-center justify-center gap-2 ${
            uploading || !pdfFile || !title.trim()
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
              : success
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:scale-[0.98] shadow-lg shadow-purple-200 dark:shadow-purple-900/30'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              上传中…
            </>
          ) : success ? (
            <>
              <Check className="w-5 h-5" />
              上传成功！
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              上传图解
            </>
          )}
        </button>
      </div>
    </div>
  )
}
