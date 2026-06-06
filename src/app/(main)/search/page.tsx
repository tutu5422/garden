import { getResources } from '@/lib/db/resources'
import ResourceGrid from '@/components/resources/ResourceGrid'
import EmptyState from '@/components/shared/EmptyState'
import { Search } from 'lucide-react'

export const metadata = {
  title: '搜索',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  if (!q) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">搜索资源</h1>
        <EmptyState
          title="输入关键词搜索"
          description="在搜索框中输入关键词来查找资源"
          icon={<Search className="size-16" />}
          actionHref=""
          actionLabel=""
        />
      </div>
    )
  }

  const { data: resources, count } = await getResources({
    search: q,
    status: 'active',
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">搜索结果</h1>
      <p className="text-muted-foreground text-sm mb-6">
        关键词 &ldquo;{q}&rdquo; 找到 {count} 个资源
      </p>

      {resources.length === 0 ? (
        <EmptyState
          title="没有找到相关资源"
          description={`没有找到与 "${q}" 相关的资源，请尝试其他关键词`}
          icon={<Search className="size-16" />}
          actionHref=""
          actionLabel=""
        />
      ) : (
        <ResourceGrid resources={resources} />
      )}
    </div>
  )
}
