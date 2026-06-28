'use client'

import { useTheme } from './SkinProvider'
import { Check } from 'lucide-react'

export default function SkinSelector() {
  const { skin, setSkin, skins, dark } = useTheme()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {skins.map((s) => {
        const isActive = s.id === skin.id
        const palette = dark ? s.dark : s.light
        return (
          <button
            key={s.id}
            onClick={() => setSkin(s.id)}
            className="relative flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-300 group"
            style={{
              background: isActive ? 'var(--skin-primary)' : 'var(--skin-muted)',
              color: isActive ? '#fff' : 'var(--skin-text)',
              border: '2px solid',
              borderColor: isActive ? 'var(--skin-primary)' : 'var(--skin-border)',
              boxShadow: isActive ? 'var(--shadow-colored)' : 'none',
            }}
          >
            <span className="text-3xl shrink-0">{s.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold tracking-wider">{s.name}</p>
              <p
                className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'opacity-80' : ''}`}
                style={{ color: isActive ? '#fff' : 'var(--skin-text-secondary)' }}
              >
                {s.description}
              </p>
              {/* 配色小样 */}
              <div className="flex items-center gap-1 mt-2">
                <ColorDot color={palette.primary} />
                <ColorDot color={palette.background} />
                <ColorDot color={palette.surface} />
                <ColorDot color={palette.accent} />
                <ColorDot color={palette.text} />
              </div>
            </div>
            {isActive && (
              <div className="absolute top-2 right-2 size-5 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="size-3 text-white" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 rounded-full border"
      style={{
        backgroundColor: color,
        borderColor: 'rgba(0,0,0,0.08)',
      }}
      title={color}
    />
  )
}
