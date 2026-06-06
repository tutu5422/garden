'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { SKINS, applySkin, getStoredSkinIndex, type SkinColors } from '@/lib/theme/skins'

type SkinContextType = {
  skinIndex: number
  skin: { name: string; emoji: string; colors: SkinColors }
  nextSkin: () => void
}

const SkinContext = createContext<SkinContextType>({
  skinIndex: 0,
  skin: SKINS[0],
  nextSkin: () => {},
})

export function useSkin() {
  return useContext(SkinContext)
}

export default function SkinProvider({ children }: { children: ReactNode }) {
  const [skinIndex, setSkinIndex] = useState(0)

  useEffect(() => {
    const idx = getStoredSkinIndex()
    setSkinIndex(idx)
    applySkin(idx)
  }, [])

  const nextSkin = () => {
    const next = (skinIndex + 1) % SKINS.length
    setSkinIndex(next)
    applySkin(next)
  }

  return (
    <SkinContext.Provider value={{ skinIndex, skin: SKINS[skinIndex], nextSkin }}>
      {children}
    </SkinContext.Provider>
  )
}
