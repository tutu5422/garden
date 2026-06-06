'use client'

import { useEffect, useState, use } from 'react'
import { getResourceHybrid, getResourceCached } from '@/lib/db/supabase-queries'
import SimpleForm from '@/components/resources/SimpleForm'
import type { Resource } from '@/lib/types'

export default function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [resource, setResource] = useState<Resource | null>(() => getResourceCached(id))

  useEffect(() => {
    getResourceHybrid(id).then(r => { if (r) setResource(r) })
  }, [id])

  if (!resource) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return <SimpleForm resource={resource} />
}
