'use client'

import { useEffect } from 'react'
import { syncCollectionsFromCloud } from '@/lib/db/supabase-queries'

/**
 * 应用启动时从 Supabase 拉取云端数据，合并到本地 localStorage。
 * 确保换设备后能看到另一设备的数据。
 */
export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncCollectionsFromCloud()
  }, [])

  return <>{children}</>
}
