"use client";
import { Sun, Moon, Monitor, Palette, Info, SwatchBook } from "lucide-react";
import { useTheme } from "@/components/theme/SkinProvider";
import SkinSelector from "@/components/theme/SkinSelector";
import type { ThemeMode } from "@/lib/theme/skins";

const modeOptions: { mode: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
  { mode: "light", label: "浅色", icon: Sun, desc: "明亮优雅" },
  { mode: "dark", label: "深色", icon: Moon, desc: "暗夜杂志" },
  { mode: "system", label: "跟随系统", icon: Monitor, desc: "自动切换" },
];

export default function SettingsPage() {
  const { mode, dark, setMode, skin } = useTheme();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 page-enter">
      <h1 className="section-title">设置</h1>

      <div className="space-y-6">
        {/* 外观模式 */}
        <div className="card card-rounded-tr p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Palette className="size-5" style={{ color: 'var(--skin-accent)' }} />
            <h2 className="font-extrabold text-base tracking-wider"
                style={{ color: 'var(--skin-text)', fontFamily: "var(--font-display)" }}>
              外观模式
            </h2>
          </div>

          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl"
               style={{ background: 'var(--skin-muted)' }}>
            <div className="size-10 rounded-xl flex items-center justify-center"
                 style={{ background: dark ? 'var(--skin-primary)' : 'var(--skin-accent)', color: '#fff' }}>
              {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--skin-text)' }}>
                {dark ? '深色模式' : '浅色模式'}
              </p>
              <p className="text-xs" style={{ color: 'var(--skin-text-secondary)' }}>
                {mode === 'system' ? '由系统偏好决定' : mode === 'dark' ? '暗夜杂志风格' : '明亮优雅风格'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modeOptions.map(opt => {
              const isActive = mode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  onClick={() => setMode(opt.mode)}
                  className="relative p-4 rounded-xl text-left transition-all duration-300 group"
                  style={{
                    background: isActive ? 'var(--skin-primary)' : 'var(--skin-muted)',
                    color: isActive ? '#fff' : 'var(--skin-text)',
                    boxShadow: isActive ? 'var(--shadow-colored)' : 'none',
                    border: isActive ? '2px solid var(--skin-primary)' : '2px solid transparent',
                  }}>
                  <opt.icon className={`size-5 mb-3 transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`}
                            style={{ color: isActive ? '#fff' : 'var(--skin-primary)' }} />
                  <p className="text-sm font-extrabold tracking-wider">{opt.label}</p>
                  <p className="text-xs mt-1 opacity-70">{opt.desc}</p>
                  {isActive && (
                    <div className="absolute top-3 right-3 size-5 rounded-full bg-white/20 flex items-center justify-center">
                      <div className="size-2.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-4 rounded-xl flex items-center gap-3"
               style={{
                 background: 'linear-gradient(135deg, rgba(var(--skin-accent-rgb), 0.08), rgba(var(--skin-primary-rgb), 0.06))',
                 border: '1px solid rgba(var(--skin-accent-rgb), 0.15)',
               }}>
            <span className="text-3xl">{skin.emoji}</span>
            <div>
              <p className="text-sm font-extrabold tracking-wider" style={{ color: 'var(--skin-text)' }}>{skin.name}</p>
              <p className="text-xs" style={{ color: 'var(--skin-text-secondary)' }}>
                {skin.description}
              </p>
            </div>
          </div>
        </div>

        {/* 皮肤主题 */}
        <div className="card card-rounded-tl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <SwatchBook className="size-5" style={{ color: 'var(--skin-accent)' }} />
            <h2 className="font-extrabold text-base tracking-wider"
                style={{ color: 'var(--skin-text)', fontFamily: "var(--font-display)" }}>
              皮肤主题
            </h2>
          </div>

          <SkinSelector />
        </div>

        <div className="card card-rounded-br p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Info className="size-5" style={{ color: 'var(--skin-accent)' }} />
            <h2 className="font-extrabold text-base tracking-wider"
                style={{ color: 'var(--skin-text)', fontFamily: "var(--font-display)" }}>
              关于
            </h2>
          </div>
          <div className="space-y-2">
            <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--skin-text-secondary)' }}>
              🐰 迷你兔 v2.3 · 个人数字花园
            </p>
            <p className="text-[10px] leading-relaxed font-medium" style={{ color: 'var(--skin-text-secondary)', opacity: 0.7 }}>
              数据存储在浏览器本地 · 仅限主人访问 · minitu.online
            </p>
            <p className="text-[10px] leading-relaxed font-mono mt-2" style={{ color: 'var(--skin-text-secondary)', opacity: 0.5 }}>
              {skin.name} — {skin.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
