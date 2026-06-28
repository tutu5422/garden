'use client'

import { useState, useCallback } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ImageUploaderProps {
  value?: string
  onChange: (url: string) => void
  bucket?: string
}

export default function ImageUploader({
  value,
  onChange,
  bucket = 'resources',
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(value || null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Client-side preview
      const previewUrl = URL.createObjectURL(file)
      setPreview(previewUrl)
      setUploading(true)

      try {
        // For now, store as base64 data URL when VPS Storage isn't configured
        // In production, this would upload to VPS Storage
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })

        // TODO: Replace with VPS Storage upload when configured

        onChange(base64)
        toast.success('图片已上传')
      } catch (err) {
        toast.error('图片上传失败')
        setPreview(value || null)
      } finally {
        setUploading(false)
      }
    },
    [onChange, value, bucket]
  )

  const handleRemove = () => {
    setPreview(null)
    onChange('')
  }

  return (
    <div className="space-y-3">
      <div
        className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 transition-colors"
        style={{ minHeight: '8rem' }}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="预览"
              className="w-full h-48 object-cover rounded-lg"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 size-7"
              onClick={handleRemove}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center cursor-pointer py-8 px-4">
            <Upload className="size-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {uploading ? '上传中...' : '点击或拖拽上传封面图'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WebP (最大 5MB)
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  )
}
