'use client'

import { useEffect } from 'react'
import { syncCollectionsFromCloud } from '@/lib/db/cache-queries'

/**
 * 应用启动时从 VPS 拉取云端数据，合并到本地 localStorage。
 * 确保换设备后能看到另一设备的数据。
 *
 * 这里只在布局级别同步侧栏全局展示所需的 collections（数据量小、
 * 全局可见）。notes / patterns / resources / files / timeline_memos
 * 等大表由各页面按需自行拉取，避免每个页面切换都触发全量 sync。
 */
export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function sync() {
      await syncCollectionsFromCloud()
      // Signal all pages that cloud sync is done
      window.dispatchEvent(new CustomEvent('cloud-sync-done'))
    }
    sync()
  }, [])

  return <>{children}</>
}
