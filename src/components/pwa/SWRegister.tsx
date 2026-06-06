'use client'

import { useEffect } from 'react'

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 离线 SW 注册失败不影响主流程
      })
    }
  }, [])

  return null
}
