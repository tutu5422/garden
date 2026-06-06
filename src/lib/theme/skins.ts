// 配色方案定义 — 每组 [primary, foreground, background]
export interface SkinColors {
  primary: string
  foreground: string
  background: string
}

// 从三个主色派生完整的主题变量
export function deriveTheme(p: string, f: string, b: string) {
  const isDark = isDarkColor(b)
  const cardBg = isDark
    ? `${b}cc`
    : `rgba(${hexToRgb(b)}, 0.55)`
  const mutedBg = isDark
    ? `${b}99`
    : `rgba(${hexToRgb(b)}, 0.6)`

  return {
    '--background': b,
    '--foreground': f,
    '--card': cardBg,
    '--card-foreground': f,
    '--popover': b,
    '--popover-foreground': f,
    '--primary': p,
    '--primary-foreground': isDark ? f : '#fff',
    '--secondary': isDark ? `${p}33` : `${p}1a`,
    '--secondary-foreground': f,
    '--muted': mutedBg,
    '--muted-foreground': isDark ? `${f}99` : `${f}88`,
    '--accent': isDark ? `${p}33` : `${p}15`,
    '--accent-foreground': f,
    '--destructive': '#c94b4b',
    '--border': isDark ? `${p}44` : `${p}22`,
    '--input': isDark ? `${p}33` : `${p}18`,
    '--ring': `${p}55`,
    '--sidebar': cardBg,
    '--sidebar-foreground': f,
    '--sidebar-primary': p,
    '--sidebar-primary-foreground': '#fff',
    '--sidebar-accent': isDark ? `${p}33` : `${p}15`,
    '--sidebar-accent-foreground': f,
    '--sidebar-border': isDark ? `${p}44` : `${p}22`,
    '--sidebar-ring': `${p}55`,
    // 透传原始色值给组件使用
    '--skin-primary': p,
    '--skin-foreground': f,
    '--skin-background': b,
  } as Record<string, string>
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function isDarkColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

// 四组配色方案
export const SKINS: { name: string; emoji: string; colors: SkinColors }[] = [
  {
    name: '蓝白',
    emoji: '🌿',
    colors: { primary: '#47709B', foreground: '#1a2a38', background: '#FEFFFF' },
  },
  {
    name: '暖红',
    emoji: '🍂',
    colors: { primary: '#8C3232', foreground: '#363636', background: '#CAD2C5' },
  },
  {
    name: '暗黑',
    emoji: '🌙',
    colors: { primary: '#F2F2F2', foreground: '#A6A6A6', background: '#1A1A1A' },
  },
  {
    name: '紫调',
    emoji: '💜',
    colors: { primary: '#6D5B71', foreground: '#B8B0B9', background: '#FDFBF7' },
  },
]

export function applySkin(index: number) {
  const skin = SKINS[index % SKINS.length]
  const vars = deriveTheme(skin.colors.primary, skin.colors.foreground, skin.colors.background)
  const root = document.documentElement

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  // 存储当前皮肤索引
  localStorage.setItem('skin-index', String(index))
  return index
}

export function getStoredSkinIndex(): number {
  if (typeof window === 'undefined') return 0
  const stored = localStorage.getItem('skin-index')
  return stored ? Number(stored) : 0
}
