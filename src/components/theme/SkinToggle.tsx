'use client'

import { useSkin } from './SkinProvider'
import { SKINS } from '@/lib/theme/skins'

export default function SkinToggle() {
  const { skinIndex, nextSkin } = useSkin()
  const skin = SKINS[skinIndex]

  return (
    <button
      onClick={nextSkin}
      className="relative inline-flex items-center justify-center size-8 rounded-lg hover:bg-white/30 dark:hover:bg-white/5 transition-all duration-300 hover:scale-110 active:scale-95"
      title={`当前: ${skin.name} — 点击切换`}
      aria-label={`切换配色，当前${skin.name}`}
    >
      <span className="text-lg leading-none">{skin.emoji}</span>
    </button>
  )
}
