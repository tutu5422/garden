'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  THEMES,
  DEFAULT_SKIN_ID,
  applyTheme,
  getStoredMode,
  setStoredMode,
  getStoredSkinId,
  setStoredSkinId,
  resolveDark,
  getThemeById,
  type ThemeMode,
  type ThemeDefinition,
} from '@/lib/theme/skins'

type ThemeContextType = {
  mode: ThemeMode       // 'light' | 'dark' | 'system'
  dark: boolean         // resolved actual dark state
  setMode: (m: ThemeMode) => void
  toggleMode: () => void  // cycle: light → dark → system → light
  skin: ThemeDefinition  // current skin
  setSkin: (id: string) => void
  skins: ThemeDefinition[]
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  dark: false,
  setMode: () => {},
  toggleMode: () => {},
  skin: getThemeById(DEFAULT_SKIN_ID),
  setSkin: () => {},
  skins: THEMES,
})

export function useTheme() {
  return useContext(ThemeContext)
}

// legacy alias for existing code that uses useSkin
export function useSkin() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [dark, setDark] = useState(false)
  const [skinId, setSkinId] = useState<string>(DEFAULT_SKIN_ID)
  const [mounted, setMounted] = useState(false)

  const skin = getThemeById(skinId)

  const applyCurrentTheme = useCallback((nextMode: ThemeMode, nextSkinId: string) => {
    const resolved = resolveDark(nextMode)
    setDark(resolved)
    applyTheme(nextSkinId, resolved)
  }, [])

  // 初始化 + 监听系统偏好变化
  useEffect(() => {
    const storedMode = getStoredMode()
    const storedSkinId = getStoredSkinId()
    setModeState(storedMode)
    setSkinId(storedSkinId)
    applyCurrentTheme(storedMode, storedSkinId)
    setMounted(true)

    // 监听系统配色变化（仅在 system 模式时需要）
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (getStoredMode() === 'system') {
        applyCurrentTheme('system', getStoredSkinId())
      }
    }
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [applyCurrentTheme])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    setStoredMode(m)
    applyCurrentTheme(m, skinId)
  }, [skinId, applyCurrentTheme])

  const setSkin = useCallback((id: string) => {
    const nextSkin = getThemeById(id)
    setSkinId(nextSkin.id)
    setStoredSkinId(nextSkin.id)
    applyCurrentTheme(mode, nextSkin.id)
  }, [mode, applyCurrentTheme])

  const toggleMode = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
    setMode(next)
  }, [mode, setMode])

  // 防止 hydration mismatch
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{
        mode: 'system',
        dark: false,
        setMode,
        toggleMode,
        skin: getThemeById(DEFAULT_SKIN_ID),
        setSkin,
        skins: THEMES,
      }}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ mode, dark, setMode, toggleMode, skin, setSkin, skins: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}
