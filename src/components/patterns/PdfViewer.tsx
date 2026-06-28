'use client'

export default function PdfViewer({ url }: { url: string }) {
  const viewerUrl = `/pdf-viewer?file=${encodeURIComponent(url)}`

  return (
    <iframe
      src={viewerUrl}
      title="PDF 查看器"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        minHeight: '100%',
      }}
    />
  )
}
