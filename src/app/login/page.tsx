"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogIn } from "lucide-react";

export default function Login() {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/login", { method: "POST" });
      if (r.ok) router.push("/");
      else setErr("密码错误");
    } catch { setErr("网络错误"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-zinc-950 dark:via-amber-950/20 dark:to-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-in fade-in zoom-in duration-500">
          <span className="text-5xl">🐰</span>
          <h1 className="mt-3 text-2xl font-bold text-zinc-800 dark:text-white">迷你兔</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">个人数字花园</p>
        </div>
        <form onSubmit={login} className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-zinc-200/50 dark:border-zinc-700/50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
            <Lock className="w-5 h-5 text-amber-600" />
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="输入密码" autoFocus className="flex-1 bg-transparent outline-none text-zinc-800 dark:text-white placeholder:text-zinc-400" />
          </div>
          {err && <p className="text-red-500 text-xs mb-3">{err}</p>}
          <button type="submit" disabled={loading || !pwd} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:scale-[1.02] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" />{loading ? "验证中..." : "进入花园"}
          </button>
        </form>
      </div>
    </div>
  );
}
