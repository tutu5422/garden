import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative">
      {/* 背景光晕 */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-amber-100/30 dark:bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 rounded-full bg-gray-100/40 dark:bg-white/3 blur-3xl" />
      </div>

      <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-2xl group">
        <span className="text-3xl group-hover:scale-110 transition-transform duration-500">🌿</span>
        <span>秘密花园</span>
      </Link>
      <div className="w-full max-w-sm animate-scale-in">{children}</div>
    </div>
  )
}
