import { PackageOpen } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export default function EmptyState({
  title = '暂无内容',
  description = '这里还没有任何内容，快来添加第一个吧',
  actionLabel = '写笔记',
  actionHref = '/resources/new',
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-muted-foreground/60 mb-4">
        {icon || <PackageOpen className="size-16" />}
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {description}
      </p>
      {onAction ? (
        <button onClick={onAction} className={cn(buttonVariants())}>
          {actionLabel}
        </button>
      ) : actionHref ? (
        <Link href={actionHref} className={cn(buttonVariants())}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
