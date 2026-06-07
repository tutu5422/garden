// 迷你兔 · 丝绒金 — 单主题 / 深浅双模 / 系统跟随
// Velvet & Gold — a single luxurious palette with light/dark/system modes

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeColors {
  primary: string
  background: string
  surface: string
  muted: string
  border: string
  accent: string
  text: string
  textSecondary: string
}

export interface ThemeDefinition {
  name: string
  emoji: string
  light: ThemeColors
  dark: ThemeColors
}

// ========== 丝绒金 · 唯一主题 ==========

const VELVET_GOLD: ThemeDefinition = {
  name: '丝绒金',
  emoji: '🪶',
  light: {
    primary:       '#7B2D3B',   // 深酒红 — 主力按钮、强调色
    background:    '#FBF9F6',   // 暖象牙白 — 页面底色
    surface:       '#FFFFFF',   // 纯白 — 卡片底色
    muted:         '#F3EFE8',   // 暖浅灰 — 次要区域
    border:        '#E6E0D6',   // 暖灰边框 — 柔和分割
    accent:        '#C4A44A',   // 古董金 — 点缀、高亮
    text:          '#1C1719',   // 深暖黑 — 主文字
    textSecondary: '#8A7E78',   // 暖褐灰 — 辅助文字
  },
  dark: {
    primary:       '#D4A853',   // 暖金 — 主力按钮、强调色
    background:    '#0D0B0E',   // 丝绒黑 — 页面底色
    surface:       '#19161C',   // 深茄紫 — 卡片底色
    muted:         '#1F1B22',   // 暗紫灰 — 次要区域
    border:        '#2E2830',   // 暗紫边框
    accent:        '#C41E3A',   // 烈绯红 — 点缀、警示
    text:          '#EDE8E0',   // 暖奶油 — 主文字
    textSecondary: '#9A9298',   // 薰衣草灰 — 辅助文字
  },
}

// ========== 导出 ==========

export const THEME = VELVET_GOLD

// ========== localStorage 存储 ==========

export function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem('theme-mode')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function setStoredMode(mode: ThemeMode) {
  if (typeof window === 'undefined') return
  localStorage.setItem('theme-mode', mode)
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// 根据 mode 解析实际是否 dark
export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'light') return false
  if (mode === 'dark') return true
  return getSystemPrefersDark()
}

// ========== 应用主题到 DOM ==========

export function applyTheme(dark: boolean) {
  if (typeof document === 'undefined') return
  const palette = dark ? THEME.dark : THEME.light
  const root = document.documentElement

  // 切换 Tailwind dark class
  root.classList.toggle('dark', dark)

  const vars: Record<string, string> = {
    '--skin-primary':        palette.primary,
    '--skin-primary-rgb':    hexToRgb(palette.primary),
    '--skin-bg':             palette.background,
    '--skin-bg-rgb':         hexToRgb(palette.background),
    '--skin-surface':        palette.surface,
    '--skin-surface-rgb':    hexToRgb(palette.surface),
    '--skin-muted':          palette.muted,
    '--skin-border':         palette.border,
    '--skin-accent':         palette.accent,
    '--skin-accent-rgb':     hexToRgb(palette.accent),
    '--skin-text':           palette.text,
    '--skin-text-secondary': palette.textSecondary,

    // shadcn/ui 兼容
    '--background':          palette.background,
    '--foreground':          palette.text,
    '--card':                palette.surface,
    '--card-foreground':     palette.text,
    '--popover':             palette.surface,
    '--popover-foreground':  palette.text,
    '--primary':             palette.primary,
    '--primary-foreground':  dark ? palette.background : '#FFFFFF',
    '--secondary':           palette.muted,
    '--secondary-foreground':palette.text,
    '--muted':               palette.muted,
    '--muted-foreground':    palette.textSecondary,
    '--accent':              palette.accent,
    '--accent-foreground':   palette.text,
    '--destructive':         dark ? '#F87171' : '#DC2626',
    '--border':              palette.border,
    '--input':               palette.border,
    '--ring':                palette.primary,
  }

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
