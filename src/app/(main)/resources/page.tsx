import { Suspense } from 'react'
import ResourcesContent from '@/components/resources/ResourcesContent'

export default function ResourcesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">加载中...</div>}>
      <ResourcesContent />
    </Suspense>
  )
}
