"use client";
import { useState } from "react";
import { Settings, Sun, Moon, Monitor } from "lucide-react";

export default function SettingsPage() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("minitu_theme") || "system";
    return "system";
  });

  const apply = (t: string) => {
    setTheme(t);
    localStorage.setItem("minitu_theme", t);
    const root = document.documentElement;
    if (t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) root.classList.add("dark");
    else root.classList.remove("dark");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6"><Settings className="w-6 h-6 text-zinc-500" />设置</h1>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border">
          <h2 className="font-medium mb-3">外观</h2>
          <div className="flex gap-2">
            {[{ k: "light", icon: Sun, label: "浅色" }, { k: "dark", icon: Moon, label: "深色" }, { k: "system", icon: Monitor, label: "跟随系统" }].map(({ k, icon: Icon, label }) => (
              <button key={k} onClick={() => apply(k)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${theme === k ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium" : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400"}`}><Icon className="w-4 h-4" />{label}</button>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">🐰 迷你兔 v2.0 · 运行在浏览器本地存储 · 数据仅在你的设备上</p>
        </div>
      </div>
    </div>
  );
}
