// 迷你兔 · 多皮肤主题系统 v2
// 每个皮肤独立控制：配色 + 圆角 + 阴影 + 字体 + 卡片风格 + 动画

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

/** 非颜色维度的皮肤样式 */
export interface ThemeStyle {
  // 圆角体系
  radiusSm: string
  radiusMd: string
  radiusLg: string
  radiusXl: string

  // 字体
  fontDisplay: string
  fontBody: string

  // 卡片样式
  cardBg: string
  cardBorder: string
  cardBorderWidth: string
  cardShadow: string
  cardBackdrop?: string  // 毛玻璃 blur 值 (e.g. 'blur(16px)')
  cardHover: string
  cardHoverShadow: string
  cardHoverBorder: string

  // 毛玻璃
  glassBg?: string
  glassBlur?: string
  glassBorder?: string

  // 按钮
  btnRadius: string
  btnShadow: string

  // 标签
  tagRadius: string

  // 页面
  pageBg: string
  sectionGap: string
}

export interface ThemeDefinition {
  id: string
  name: string
  emoji: string
  description: string
  light: ThemeColors
  dark: ThemeColors
  style: ThemeStyle
}

// ========== 编辑狂想 · 时尚杂志美学（保持不变）==========

export const EDITORIAL_RAVE: ThemeDefinition = {
  id: 'editorial-rave',
  name: '编辑狂想',
  emoji: '📰',
  description: '杂志玫红 × 电光金 · 时尚杂志美学',
  light: {
    primary:       '#E8315B',
    background:    '#F6F3EF',
    surface:       '#FFFFFF',
    muted:         '#F0EBE3',
    border:        '#E0D9CE',
    accent:        '#FFB800',
    text:          '#12100E',
    textSecondary: '#7A7268',
  },
  dark: {
    primary:       '#FF5277',
    background:    '#0E0C0A',
    surface:       '#1C1815',
    muted:         '#24201A',
    border:        '#322C24',
    accent:        '#FFB800',
    text:          '#F5F0E8',
    textSecondary: '#9A9084',
  },
  style: {
    radiusSm:     '0.375rem',
    radiusMd:     '0.75rem',
    radiusLg:     '1rem',
    radiusXl:     '1.25rem',

    fontDisplay:  "'Noto Serif SC', 'STSong', 'Songti SC', 'Georgia', serif",
    fontBody:     "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",

    cardBg:           '#FFFFFF',
    cardBorder:       '#E0D9CE',
    cardBorderWidth:  '1px',
    cardShadow:       '0 4px 8px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06), 0 16px 32px rgba(0,0,0,0.04)',
    cardHover:        'translateY(-6px)',
    cardHoverShadow:  '0 16px 32px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.1), 0 48px 96px rgba(0,0,0,0.08)',
    cardHoverBorder:  'var(--skin-primary)',

    btnRadius:        '0.5rem',
    btnShadow:        '0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04)',

    tagRadius:        '9999px',

    pageBg:           'var(--skin-bg)',
    sectionGap:       '3rem',
  },
}

// ========== 森系纸墨 · Forest Paper ==========
// 手写笔记本质感 — 圆润纸张、手绘感边框、衬线字体
export const FOREST_PAPER: ThemeDefinition = {
  id: 'forest-paper',
  name: '森系纸墨',
  emoji: '🌿',
  description: '米纸宣纸 × 墨绿木色 · 自然手写质感',
  light: {
    primary:       '#2E5C45',
    background:    '#F5F1E8',
    surface:       '#FDFCF8',
    muted:         '#EAE4D8',
    border:        '#D9D2C3',
    accent:        '#B89A6A',
    text:          '#1A2F1F',
    textSecondary: '#5A6B5E',
  },
  dark: {
    primary:       '#5B9E7D',
    background:    '#141C17',
    surface:       '#1E2A22',
    muted:         '#25362B',
    border:        '#334A3D',
    accent:        '#C4A76E',
    text:          '#E9E5DA',
    textSecondary: '#8A9B8A',
  },
  style: {
    radiusSm:     '0.625rem',
    radiusMd:     '1rem',
    radiusLg:     '1.25rem',
    radiusXl:     '1.75rem',

    fontDisplay:  "'Noto Serif SC', 'STSong', 'ZCOOL XiaoWei', 'Georgia', serif",
    fontBody:     "'Noto Serif SC', 'PingFang SC', system-ui, sans-serif",

    cardBg:           '#FDFCF8',
    cardBorder:       '#D9D2C3',
    cardBorderWidth:  '1.5px',
    cardShadow:       '0 2px 6px rgba(0,0,0,0.04)',
    cardHover:        'translateY(-3px)',
    cardHoverShadow:  '0 6px 16px rgba(0,0,0,0.08)',
    cardHoverBorder:  '#2E5C45',

    btnRadius:        '0.75rem',
    btnShadow:        '0 2px 4px rgba(0,0,0,0.05)',

    tagRadius:        '9999px',

    pageBg:           'var(--skin-bg)',
    sectionGap:       '4rem',
  },
}

// ========== 暖阳陶土 · Warm Terracotta ==========
// 地中海阳光 — 超大圆角、暖光投影、浑厚衬线
export const WARM_TERRACOTTA: ThemeDefinition = {
  id: 'warm-terracotta',
  name: '暖阳陶土',
  emoji: '🌅',
  description: '奶油燕麦 × 陶土橙 · 地中海午后阳光',
  light: {
    primary:       '#C65D3B',
    background:    '#F9F1E8',
    surface:       '#FFFBF5',
    muted:         '#F3E6D8',
    border:        '#E8D5C4',
    accent:        '#E9A319',
    text:          '#3D2B1F',
    textSecondary: '#8B6B53',
  },
  dark: {
    primary:       '#E27B56',
    background:    '#1E1814',
    surface:       '#2C231C',
    muted:         '#382D25',
    border:        '#4A3D33',
    accent:        '#F4B942',
    text:          '#F5E8D8',
    textSecondary: '#B89A82',
  },
  style: {
    radiusSm:     '1rem',
    radiusMd:     '1.25rem',
    radiusLg:     '1.5rem',
    radiusXl:     '2rem',

    fontDisplay:  "'Noto Serif SC', 'STSong', 'Georgia', 'Times New Roman', serif",
    fontBody:     "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",

    cardBg:           '#FFFBF5',
    cardBorder:       '#E8D5C4',
    cardBorderWidth:  '1px',
    cardShadow:       '0 4px 16px rgba(198,93,59,0.10), 0 8px 24px rgba(0,0,0,0.04)',
    cardHover:        'translateY(-4px)',
    cardHoverShadow:  '0 12px 32px rgba(198,93,59,0.15), 0 24px 48px rgba(0,0,0,0.06)',
    cardHoverBorder:  '#C65D3B',

    btnRadius:        '9999px',
    btnShadow:        '0 4px 12px rgba(198,93,59,0.20)',

    tagRadius:        '9999px',

    pageBg:           'var(--skin-bg)',
    sectionGap:       '3.5rem',
  },
}

// ========== 午夜蓝金 · Midnight Blue ==========
// 奢华毛玻璃 — 半透明卡片、金色细边框、无衬线精致感
export const MIDNIGHT_BLUE: ThemeDefinition = {
  id: 'midnight-blue',
  name: '午夜蓝金',
  emoji: '🌙',
  description: '午夜蓝 × 月光金 · 毛玻璃奢华质感',
  light: {
    primary:       '#1E3A8A',
    background:    '#F4F6F9',
    surface:       '#FFFFFF',
    muted:         '#E8EDF3',
    border:        '#D5DDE8',
    accent:        '#C9A227',
    text:          '#0F172A',
    textSecondary: '#5A6B8A',
  },
  dark: {
    primary:       '#3B82F6',
    background:    '#0B1120',
    surface:       'rgba(21,30,50,0.6)',
    muted:         '#1C2744',
    border:        '#2A3A5C',
    accent:        '#F0C050',
    text:          '#F0F4F8',
    textSecondary: '#8FA4BF',
  },
  style: {
    radiusSm:     '0.25rem',
    radiusMd:     '0.5rem',
    radiusLg:     '0.75rem',
    radiusXl:     '1rem',

    fontDisplay:  "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
    fontBody:     "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",

    // 浅色用半透明白+模糊，深色用半透明深蓝+模糊
    cardBg:           'rgba(255,255,255,0.55)',
    cardBorder:       'rgba(201,162,39,0.25)',
    cardBorderWidth:  '1px',
    cardShadow:       '0 4px 16px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.02)',
    cardBackdrop:     'blur(16px)',
    cardHover:        'translateY(-3px)',
    cardHoverShadow:  '0 12px 32px rgba(30,58,138,0.10), 0 8px 16px rgba(201,162,39,0.08)',
    cardHoverBorder:  'rgba(201,162,39,0.6)',

    glassBg:          'rgba(255,255,255,0.55)',
    glassBlur:        '16px',
    glassBorder:      'rgba(201,162,39,0.2)',

    btnRadius:        '0.375rem',
    btnShadow:        '0 2px 8px rgba(30,58,138,0.15)',

    tagRadius:        '0.25rem',

    pageBg:           'var(--skin-bg)',
    sectionGap:       '2.5rem',
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
  const s = skin.style
  const root = document.documentElement

  root.classList.toggle('dark', dark)

  const vars: Record<string, string> = {
    '--skin-primary':          palette.primary,
    '--skin-primary-rgb':      hexToRgb(palette.primary),
    '--skin-bg':               palette.background,
    '--skin-bg-rgb':           hexToRgb(palette.background),
    '--skin-surface':          palette.surface,
    '--skin-surface-rgb':      hexToRgb(palette.surface),
    '--skin-muted':            palette.muted,
    '--skin-border':           palette.border,
    '--skin-accent':           palette.accent,
    '--skin-accent-rgb':       hexToRgb(palette.accent),
    '--skin-text':             palette.text,
    '--skin-text-secondary':   palette.textSecondary,

    '--skin-radius-sm':        s.radiusSm,
    '--skin-radius-md':        s.radiusMd,
    '--skin-radius-lg':        s.radiusLg,
    '--skin-radius-xl':        s.radiusXl,

    '--font-display':          s.fontDisplay,
    '--font-body':             s.fontBody,

    '--skin-card-bg':          s.cardBg,
    '--skin-card-border':      s.cardBorder,
    '--skin-card-border-width': s.cardBorderWidth,
    '--skin-card-shadow':      s.cardShadow,
    '--skin-card-backdrop':    s.cardBackdrop ?? 'none',
    '--skin-card-hover':       s.cardHover,
    '--skin-card-hover-shadow': s.cardHoverShadow,
    '--skin-card-hover-border': s.cardHoverBorder,

    '--skin-glass-bg':         s.glassBg ?? 'rgba(255,255,255,0.1)',
    '--skin-glass-blur':       s.glassBlur ?? '12px',
    '--skin-glass-border':     s.glassBorder ?? 'rgba(255,255,255,0.15)',

    '--skin-btn-radius':       s.btnRadius,
    '--skin-btn-shadow':       s.btnShadow,

    '--skin-tag-radius':       s.tagRadius,

    '--skin-page-bg':          s.pageBg,
    '--skin-section-gap':      s.sectionGap,

    // shadcn/ui 兼容变量
    '--background':            palette.background,
    '--foreground':            palette.text,
    '--card':                  s.cardBg,
    '--card-foreground':       palette.text,
    '--popover':               palette.surface,
    '--popover-foreground':    palette.text,
    '--primary':               palette.primary,
    '--primary-foreground':    dark ? palette.background : '#FFFFFF',
    '--secondary':             palette.muted,
    '--secondary-foreground':  palette.text,
    '--muted':                 palette.muted,
    '--muted-foreground':      palette.textSecondary,
    '--accent':                palette.accent,
    '--accent-foreground':     palette.text,
    '--destructive':           dark ? '#F87171' : '#DC2626',
    '--border':                palette.border,
    '--input':                 palette.border,
    '--ring':                  palette.primary,
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
