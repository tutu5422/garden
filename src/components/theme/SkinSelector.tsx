'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from './SkinProvider'
import { Check, ChevronDown, SwatchBook } from 'lucide-react'

export default function SkinSelector() {
  const { skin, setSkin, skins, dark } = useTheme()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })

    const onResize = () => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left, width: r.width })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  return (
    <div className="relative">
      {/* 当前皮肤触发按钮 */}
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group"
        style={{
          background: 'var(--skin-muted)',
          border: '2px solid var(--skin-border)',
        }}
        aria-expanded={open}
        aria-label={`当前皮肤: ${skin.name}，点击切换`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{skin.emoji}</span>
          <div className="text-left">
            <p className="text-sm font-extrabold tracking-wider" style={{ color: 'var(--skin-text)' }}>
              {skin.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--skin-text-secondary)' }}>
              {skin.description}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`size-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--skin-text-secondary)' }}
        />
      </button>

      {/* 遮罩层 — 点击关闭 */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 皮肤选择面板 — fixed 定位，脱离父级层叠上下文 */}
      {open && (
        <div
          className="fixed z-40 rounded-xl overflow-hidden shadow-xl"
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            background: 'var(--skin-surface)',
            border: '2px solid var(--skin-border)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center gap-2 px-2 pb-1">
              <SwatchBook className="size-4" style={{ color: 'var(--skin-accent)' }} />
              <span className="text-xs font-bold tracking-wider" style={{ color: 'var(--skin-text-secondary)' }}>
                选择皮肤主题
              </span>
            </div>
            {skins.map((s) => {
              const isActive = s.id === skin.id
              const palette = dark ? s.dark : s.light
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSkin(s.id)
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-300 group"
                  style={{
                    background: isActive ? 'var(--skin-primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--skin-text)',
                    border: '2px solid',
                    borderColor: isActive ? 'var(--skin-primary)' : 'transparent',
                  }}
                >
                  <span className="text-2xl shrink-0">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold tracking-wider">{s.name}</p>
                    <p className={`text-xs mt-0.5 ${isActive ? 'opacity-80' : ''}`} style={{ color: isActive ? '#fff' : 'var(--skin-text-secondary)' }}>
                      {s.description}
                    </p>
                    {/* 配色小样 */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <ColorDot color={palette.primary} />
                      <ColorDot color={palette.background} />
                      <ColorDot color={palette.surface} />
                      <ColorDot color={palette.accent} />
                      <ColorDot color={palette.text} />
                    </div>
                  </div>
                  {isActive && (
                    <div className="size-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Check className="size-3.5 text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-4 rounded-full border"
      style={{
        backgroundColor: color,
        borderColor: 'rgba(0,0,0,0.08)',
      }}
      title={color}
    />
  )
}
