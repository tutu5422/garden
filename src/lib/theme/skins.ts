// 迷你兔 · 编辑狂想 — Editorial Rave · 时尚杂志美学
// 大胆色块 · 几何切割 · 光影统一 · 细节丰富

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

// ========== 编辑狂想 · 唯一主题 ==========

const EDITORIAL_RAVE: ThemeDefinition = {
  name: '编辑狂想',
  emoji: '📰',
  light: {
    primary:       '#E8315B',   // 杂志玫红 — 主力色
    background:    '#F6F3EF',   // 暖灰白 — 页面底
    surface:       '#FFFFFF',   // 纯白卡片
    muted:         '#F0EBE3',   // 暖灰
    border:        '#E0D9CE',   // 暖边框
    accent:        '#FFB800',   // 电光金 — 强调点缀
    text:          '#12100E',   // 极黑 — 主文字
    textSecondary: '#7A7268',   // 暖灰褐 — 辅文字
  },
  dark: {
    primary:       '#FF5277',   // 亮玫红 — 主力色
    background:    '#0E0C0A',   // 深黑暖底
    surface:       '#1C1815',   // 深棕卡片
    muted:         '#24201A',   // 暗暖灰
    border:        '#322C24',   // 暗金边
    accent:        '#FFB800',   // 电光金
    text:          '#F5F0E8',   // 暖白
    textSecondary: '#9A9084',   // 灰褐
  },
}

// ========== 导出 ==========

export const THEME = EDITORIAL_RAVE

// ========== localStorage ==========

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

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'light') return false
  if (mode === 'dark') return true
  return getSystemPrefersDark()
}

export function applyTheme(dark: boolean) {
  if (typeof document === 'undefined') return
  const palette = dark ? THEME.dark : THEME.light
  const root = document.documentElement

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
