// P1-1: 主题 FOUC 防闪烁脚本。
//
// 这段脚本作为阻塞式 inline <script> 注入到 <head>，在 React hydration 之前
// 根据 localStorage('theme-mode') + prefers-color-scheme 决定 light/dark，
// 并把 CSS 变量直接写到 document.documentElement.style 上。
//
// 调色板与 src/lib/theme/skins.ts 中的 THEME 保持一致；若 skins.ts 改动，
// 这里也需要同步更新（两处都是常量，无法在运行时共享，因为脚本是纯字符串）。

// 内联调色板（与 skins.ts 的 EDITORIAL_RAVE 一致）
const PALETTES = {
  light: {
    primary: '#E8315B',
    background: '#F6F3EF',
    surface: '#FFFFFF',
    muted: '#F0EBE3',
    border: '#E0D9CE',
    accent: '#FFB800',
    text: '#12100E',
    textSecondary: '#7A7268',
  },
  dark: {
    primary: '#FF5277',
    background: '#0E0C0A',
    surface: '#1C1815',
    muted: '#24201A',
    border: '#322C24',
    accent: '#FFB800',
    text: '#F5F0E8',
    textSecondary: '#9A9084',
  },
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function buildVars(dark: boolean): Record<string, string> {
  const p = dark ? PALETTES.dark : PALETTES.light
  const vars: Record<string, string> = {
    '--skin-primary': p.primary,
    '--skin-primary-rgb': hexToRgb(p.primary),
    '--skin-bg': p.background,
    '--skin-bg-rgb': hexToRgb(p.background),
    '--skin-surface': p.surface,
    '--skin-surface-rgb': hexToRgb(p.surface),
    '--skin-muted': p.muted,
    '--skin-border': p.border,
    '--skin-accent': p.accent,
    '--skin-accent-rgb': hexToRgb(p.accent),
    '--skin-text': p.text,
    '--skin-text-secondary': p.textSecondary,
    '--background': p.background,
    '--foreground': p.text,
    '--card': p.surface,
    '--card-foreground': p.text,
    '--popover': p.surface,
    '--popover-foreground': p.text,
    '--primary': p.primary,
    '--primary-foreground': dark ? p.background : '#FFFFFF',
    '--secondary': p.muted,
    '--secondary-foreground': p.text,
    '--muted': p.muted,
    '--muted-foreground': p.textSecondary,
    '--accent': p.accent,
    '--accent-foreground': p.text,
    '--destructive': dark ? '#F87171' : '#DC2626',
    '--border': p.border,
    '--input': p.border,
    '--ring': p.primary,
  }
  return vars
}

// 序列化为可在浏览器执行的字符串脚本。
// 注意：脚本里不能引用任何外部变量，必须是自包含的纯字符串。
const varsLight = buildVars(false)
const varsDark = buildVars(true)

function serializeVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `'${k}':'${v}'`)
    .join(',')
}

export const THEME_NOFLASH_SCRIPT = `(function(){
  try {
    var stored = localStorage.getItem('theme-mode');
    var dark;
    if (stored === 'light') dark = false;
    else if (stored === 'dark') dark = true;
    else dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var vars = dark ? {${serializeVars(varsDark)}} : {${serializeVars(varsLight)}};
    var root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    for (var k in vars) { if (Object.prototype.hasOwnProperty.call(vars, k)) root.style.setProperty(k, vars[k]); }
  } catch (e) { /* noflash best-effort */ }
})();`
