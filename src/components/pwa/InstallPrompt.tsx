'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [deferred, setDeferred] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // 检查是否已安装
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return
    }

    // 检查是否之前关闭过
    if (localStorage.getItem('pwa-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferred(null)
  }

  const handleDismiss = () => {
    setShow(false)
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-20 md:w-80 z-50 animate-fade-in-up">
      <div className="glass-heavy rounded-2xl shadow-3d-lg p-4 flex items-center gap-3">
        <span className="text-2xl">🌿</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">安装秘密花园</p>
          <p className="text-xs text-muted-foreground">添加到主屏幕，快速访问</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-3d btn-3d"
          style={{ background: 'var(--skin-primary)' }}
        >
          <Download className="size-3.5 inline mr-1" />
          安装
        </button>
        <button onClick={handleDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
