'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { THEME, applyTheme, getStoredMode, setStoredMode, resolveDark, type ThemeMode } from '@/lib/theme/skins'

type ThemeContextType = {
  mode: ThemeMode       // 'light' | 'dark' | 'system'
  dark: boolean         // resolved actual dark state
  setMode: (m: ThemeMode) => void
  toggleMode: () => void  // cycle: light → dark → system → light
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  dark: false,
  setMode: () => {},
  toggleMode: () => {},
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
  const [mounted, setMounted] = useState(false)

  // 初始化 + 监听系统偏好变化
  useEffect(() => {
    const stored = getStoredMode()
    setModeState(stored)
    const resolved = resolveDark(stored)
    setDark(resolved)
    applyTheme(resolved)
    setMounted(true)

    // 监听系统配色变化（仅在 system 模式时需要）
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (getStoredMode() === 'system') {
        const sysDark = mq.matches
        setDark(sysDark)
        applyTheme(sysDark)
      }
    }
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    setStoredMode(m)
    const resolved = resolveDark(m)
    setDark(resolved)
    applyTheme(resolved)
  }, [])

  const toggleMode = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
    setMode(next)
  }, [mode, setMode])

  // 防止 hydration mismatch：两个 value 都用 useMemo，避免每次渲染创建新对象导致全局重渲染
  const unmountedValue = useMemo(() => ({ mode: 'system' as ThemeMode, dark: false, setMode, toggleMode }), [setMode, toggleMode])
  const themeValue = useMemo(() => ({ mode, dark, setMode, toggleMode }), [mode, dark, setMode, toggleMode])

  if (!mounted) {
    return (
      <ThemeContext.Provider value={unmountedValue}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  )
}
