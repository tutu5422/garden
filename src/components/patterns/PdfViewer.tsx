'use client'

export default function PdfViewer({ url }: { url: string }) {
  const viewerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/web/viewer.html?file=${encodeURIComponent(url)}`

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
