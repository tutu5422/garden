import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-100/20 dark:bg-amber-500/3 blur-3xl" />
      </div>
      <span className="text-8xl mb-6 animate-float">🌿</span>
      <h1 className="text-5xl font-bold mb-3 animate-fade-in-up">404</h1>
      <p className="text-lg text-muted-foreground mb-8 animate-fade-in-up">
        这个页面还没有被种植到花园里
      </p>
      <Link
        href="/"
        className={cn(buttonVariants(), 'gap-2 glass shadow-3d btn-3d rounded-full px-6 animate-fade-in-up')}
      >
        <Home className="size-4" /> 返回首页
      </Link>
    </div>
  )
}
