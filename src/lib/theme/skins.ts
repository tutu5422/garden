// 迷你兔 · 多皮肤主题系统
// 编辑狂想 + 森系纸墨 + 暖阳陶土 + 午夜蓝金

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
  id: string
  name: string
  emoji: string
  description: string
  light: ThemeColors
  dark: ThemeColors
}

// ========== 编辑狂想 · 时尚杂志美学（原始主题，保持不变）==========

export const EDITORIAL_RAVE: ThemeDefinition = {
  id: 'editorial-rave',
  name: '编辑狂想',
  emoji: '📰',
  description: '杂志玫红 × 电光金 · 时尚杂志美学',
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

// ========== 森系纸墨 · Forest Paper ==========
// 米纸底 + 墨绿 + 木色，手绘自然质感

export const FOREST_PAPER: ThemeDefinition = {
  id: 'forest-paper',
  name: '森系纸墨',
  emoji: '🌿',
  description: '米纸宣纸 × 墨绿木色 · 自然手绘质感',
  light: {
    primary:       '#2E5C45',   // 森林绿
    background:    '#F5F1E8',   // 暖米纸
    surface:       '#FDFCF8',   // 白宣纸
    muted:         '#EAE4D8',   // 旧纸色
    border:        '#D9D2C3',   // 淡墨边
    accent:        '#B89A6A',   // 木色金
    text:          '#1A2F1F',   // 墨绿黑
    textSecondary: '#5A6B5E',   // 苔绿灰
  },
  dark: {
    primary:       '#5B9E7D',   // 翡翠绿
    background:    '#141C17',   // 深森林
    surface:       '#1E2A22',   // 深苔藓
    muted:         '#25362B',   // 暗绿影
    border:        '#334A3D',   // 深绿边
    accent:        '#C4A76E',   // 旧金木
    text:          '#E9E5DA',   // 羊皮纸白
    textSecondary: '#8A9B8A',   // 鼠尾草灰
  },
}

// ========== 暖阳陶土 · Warm Terracotta ==========
// 奶油色 + 陶土橙，地中海午后阳光

export const WARM_TERRACOTTA: ThemeDefinition = {
  id: 'warm-terracotta',
  name: '暖阳陶土',
  emoji: '🌅',
  description: '奶油燕麦 × 陶土橙 · 地中海午后阳光',
  light: {
    primary:       '#C65D3B',   // 陶土橙
    background:    '#F9F1E8',   // 奶油底
    surface:       '#FFFBF5',   // 暖白
    muted:         '#F3E6D8',   // 燕麦色
    border:        '#E8D5C4',   // 沙色边
    accent:        '#E9A319',   // 阳光金
    text:          '#3D2B1F',   // 咖啡黑
    textSecondary: '#8B6B53',   // 暖褐灰
  },
  dark: {
    primary:       '#E27B56',   // 珊瑚陶土
    background:    '#1E1814',   // 深咖啡
    surface:       '#2C231C',   // 暖棕卡
    muted:         '#382D25',   // 暗橡木
    border:        '#4A3D33',   // 陶土影
    accent:        '#F4B942',   // 落日金
    text:          '#F5E8D8',   // 奶油白
    textSecondary: '#B89A82',   // 暖沙灰
  },
}

// ========== 午夜蓝金 · Midnight Blue ==========
// 深蓝 + 金色，沉稳奢华的夜间花园

export const MIDNIGHT_BLUE: ThemeDefinition = {
  id: 'midnight-blue',
  name: '午夜蓝金',
  emoji: '🌙',
  description: '午夜蓝 × 月光金 · 沉稳奢华的夜间花园',
  light: {
    primary:       '#1E3A8A',   // 皇家蓝
    background:    '#F4F6F9',   // 冰白
    surface:       '#FFFFFF',   // 纯白
    muted:         '#E8EDF3',   // 雾蓝
    border:        '#D5DDE8',   // 霜边
    accent:        '#C9A227',   // 皇家金
    text:          '#0F172A',   // 午夜墨
    textSecondary: '#5A6B8A',   // 钢蓝灰
  },
  dark: {
    primary:       '#3B82F6',   // 电光蓝
    background:    '#0B1120',   // 深午夜
    surface:       '#151E32',   // 夜蓝卡
    muted:         '#1C2744',   // 暗海军
    border:        '#2A3A5C',   // 影蓝边
    accent:        '#F0C050',   // 月光金
    text:          '#F0F4F8',   // 月光白
    textSecondary: '#8FA4BF',   // 软钢蓝
  },
}

// ========== 导出 ==========

export const THEMES: ThemeDefinition[] = [
  EDITORIAL_RAVE,
  FOREST_PAPER,
  WARM_TERRACOTTA,
  MIDNIGHT_BLUE,
]

export const DEFAULT_SKIN_ID = EDITORIAL_RAVE.id

// 向后兼容：保留 THEME 别名
export const THEME = EDITORIAL_RAVE

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find(t => t.id === id) || EDITORIAL_RAVE
}

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

export function getStoredSkinId(): string {
  if (typeof window === 'undefined') return DEFAULT_SKIN_ID
  const stored = localStorage.getItem('theme-skin')
  if (stored && THEMES.some(t => t.id === stored)) return stored
  return DEFAULT_SKIN_ID
}

export function setStoredSkinId(id: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('theme-skin', id)
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

export function applyTheme(skinId: string, dark: boolean) {
  if (typeof document === 'undefined') return
  const skin = getThemeById(skinId)
  const palette = dark ? skin.dark : skin.light
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
