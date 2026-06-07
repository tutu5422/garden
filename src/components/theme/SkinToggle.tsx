'use client'

import { useTheme } from './SkinProvider'
import { Sun, Moon, Monitor } from 'lucide-react'

export default function SkinToggle() {
  const { mode, dark, toggleMode } = useTheme()

  const modeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
  const ModeIcon = modeIcon

  const tooltip = mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'

  return (
    <div className="flex items-center gap-0.5">

      {/* 深色/浅色指示 */}
      <div
        className="relative inline-flex items-center justify-center size-8 rounded-lg"
        style={{ background: dark ? 'var(--skin-primary)' : 'var(--skin-accent)', color: '#fff' }}
      >
        {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </div>

      {/* 模式循环切换 */}
      <button
        onClick={toggleMode}
        className="relative inline-flex items-center justify-center size-8 rounded-lg hover:bg-[var(--skin-muted)] transition-all duration-300 hover:scale-110 active:scale-95"
        title={`${tooltip} — 点击切换`}
        aria-label={`外观模式: ${tooltip}`}
      >
        <ModeIcon className="size-4" style={{ color: 'var(--skin-text-secondary)' }} />
      </button>
    </div>
  )
}
