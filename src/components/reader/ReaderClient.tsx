"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ 类型 */
type Book = {
  id: string;
  title: string;
  author?: string;
  source: string;
  chapters: number;
  state?: string;
};
type TocItem = { i: number; title: string; state: string };
type Chapter = { title: string; paragraphs: string[]; idx: number };

type Settings = {
  fontSize: number;
  lineHeight: number;
  width: number;
  font: string;
  theme: string;
  paragraphGap: number;
};

/* ------------------------------------------------------------------ 常量 */
const DEFAULT_SETTINGS: Settings = {
  fontSize: 18,
  lineHeight: 1.9,
  width: 760,
  font: "默认",
  theme: "纸白",
  paragraphGap: 1.1,
};

const FONTS: Record<string, string> = {
  默认: '-apple-system, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif',
  宋体: '"Songti SC", SimSun, "Noto Serif SC", serif',
  楷体: '"Kaiti SC", KaiTi, STKaiti, serif',
  黑体: '"Microsoft YaHei", "PingFang SC", "Heiti SC", sans-serif',
  等宽: '"Cascadia Code", Consolas, "Courier New", monospace',
};

const THEMES: Record<string, { bg: string; text: string; dim: string }> = {
  纸白: { bg: "#ffffff", text: "#1b1b1b", dim: "#9a9a9a" },
  米黄: { bg: "#f6efdf", text: "#3b3226", dim: "#a2967f" },
  灰蓝: { bg: "#eef1f4", text: "#22282e", dim: "#8e979f" },
  夜间: { bg: "#1a1b1e", text: "#c8c9cc", dim: "#6a6d73" },
};

const SETTINGS_KEY = "novel.settings";
const LAST_KEY = "novel.last";
const readKey = (id: string) => `novel.read.${id}`;

/* ------------------------------------------------------------------ 工具 */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/novel${path}`, { cache: "no-store", ...init });
  const t = await r.text();
  let j: unknown;
  try {
    j = JSON.parse(t);
  } catch {
    j = { error: `返回异常（HTTP ${r.status}）：${t.slice(0, 120)}` };
  }
  return j as T;
}

function loadReadSet(id: string): Set<number> {
  try {
    const raw = localStorage.getItem(readKey(id));
    return new Set<number>(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set<number>();
  }
}

/* ------------------------------------------------------------------ 组件 */
export default function ReaderClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [cur, setCur] = useState<Book | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [ch, setCh] = useState<Chapter | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [shelfOpen, setShelfOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [kw, setKw] = useState("");
  const [found, setFound] = useState<{ title: string; url: string; site: string }[]>([]);
  const [cfg, setCfg] = useState<Settings>(DEFAULT_SETTINGS);
  const [prog, setProg] = useState(0);
  const [showProg, setShowProg] = useState(false);
  const [readSet, setReadSet] = useState<Set<number>>(new Set());
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------- 设置持久化 ---------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setCfg({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
  }, [cfg]);

  const theme = THEMES[cfg.theme] || THEMES["纸白"];

  /* ---------------- 书库 ---------------- */
  const refreshBooks = useCallback(async () => {
    const r = await api<{ books?: Book[]; error?: string }>("/books");
    if (r.books) setBooks(r.books);
    else if (r.error) setErr(r.error);
  }, []);

  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks]);

  // 有书还在解析目录时自动刷新
  useEffect(() => {
    const parsing = books.some((b) => (b.state || "").includes("解析"));
    if (!parsing) return;
    const t = setTimeout(() => void refreshBooks(), 5000);
    return () => clearTimeout(t);
  }, [books, refreshBooks]);

  /* ---------------- 打开书 ---------------- */
  const openToc = useCallback(async (b: Book) => {
    setCur(b);
    setCh(null);
    setToc([]);
    setReadSet(loadReadSet(b.id));
    setBusy("读取目录…");
    localStorage.setItem(LAST_KEY, b.id);
    const r = await api<{ toc?: TocItem[]; error?: string }>(`/toc?b=${encodeURIComponent(b.id)}`);
    setBusy("");
    if (r.toc) {
      setToc(r.toc);
      const saved = Number(localStorage.getItem(`novel.pos.${b.id}`) ?? "");
      await loadChapter(b.id, Number.isFinite(saved) && saved > 0 ? saved : 0, b);
    } else setErr(r.error || "目录读取失败");
  }, []);

  const loadChapter = useCallback(
    async (bookId: string, i: number, book?: Book) => {
      setBusy("加载章节…");
      setErr("");
      const r = await api<Chapter & { error?: string }>(
        `/chapter?b=${encodeURIComponent(bookId)}&i=${i}`
      );
      setBusy("");
      if (r.error) {
        setErr(r.error);
        return;
      }
      setCh(r);
      localStorage.setItem(`novel.pos.${bookId}`, String(i));
      const b = book || cur;
      if (b) {
        const rs = loadReadSet(b.id);
        rs.add(i);
        localStorage.setItem(readKey(b.id), JSON.stringify([...rs]));
        setReadSet(new Set(rs));
      }
      window.scrollTo({ top: 0 });
      setProg(0);
    },
    [cur]
  );

  const go = useCallback(
    (d: number) => {
      if (!cur || !ch) return;
      const n = ch.idx + d;
      if (n < 0 || n >= toc.length) return;
      void loadChapter(cur.id, n);
    },
    [cur, ch, toc.length, loadChapter]
  );

  /* ---------------- 打开上次的书 ---------------- */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !books.length) return;
    const last = localStorage.getItem(LAST_KEY);
    const b = books.find((x) => x.id === last) || books[0];
    if (b) {
      opened.current = true;
      void openToc(b);
    }
  }, [books, openToc]);

  /* ---------------- 进度条 ---------------- */
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      setProg(p);
      setShowProg(true);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setShowProg(false), 1400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [ch]);

  /* ---------------- 快捷键 ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") {
        setShelfOpen(false);
        setTocOpen(false);
        setCfgOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /* ---------------- 操作 ---------------- */
  const addBook = async (url: string) => {
    if (!url.trim()) return;
    setBusy("已提交，云端正在解析目录…");
    const r = await api<{ error?: string; title?: string }>(
      `/addbook?url=${encodeURIComponent(url.trim())}`
    );
    setBusy("");
    setNewUrl("");
    if (r.error) setErr(r.error);
    else void refreshBooks();
  };

  const delBook = async (b: Book) => {
    const local = b.id.startsWith("local:");
    if (!confirm(`${local ? "删除本地文件" : "从书库移除"}：${b.title}\n${local ? "（服务器上的 txt 会被删掉，不可恢复）" : "（已缓存章节会清掉）"}`)) return;
    await api(`/delbook?b=${encodeURIComponent(b.id)}`);
    if (cur?.id === b.id) {
      setCur(null);
      setCh(null);
      setToc([]);
      localStorage.removeItem(LAST_KEY);
      opened.current = false;
    }
    void refreshBooks();
  };

  const upload = async (f: File) => {
    setBusy(`上传 ${f.name} …`);
    await api(`/upload?name=${encodeURIComponent(f.name)}`, { method: "POST", body: await f.text() });
    setBusy("");
    void refreshBooks();
  };

  const search = async () => {
    if (!kw.trim()) return;
    setBusy("搜索（御宅屋）…");
    const r = await api<{ results?: typeof found; error?: string }>(
      `/search?q=${encodeURIComponent(kw.trim())}`
    );
    setBusy("");
    setFound(r.results || []);
    if (r.error) setErr(`搜索失败：${r.error}`);
    else if (!r.results?.length) setErr("没搜到结果（换个关键词，或改用书号/网址加入）");
  };

  const fontFamily = FONTS[cfg.font] || FONTS["默认"];
  const pct = Math.round(prog * 100);
  const parsing = useMemo(() => books.filter((b) => (b.state || "").includes("解析")).length, [books]);

  /* ---------------- 渲染 ---------------- */
  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: "100vh" }}>
      {/* 顶部工具条（含进度线，永不出现在正文上） */}
      <div
        className="fixed left-0 right-0 top-0 z-40 border-b md:top-14"
        style={{ background: theme.bg, borderColor: "rgba(125,125,125,.25)" }}
      >
        <div className="mx-auto flex h-11 max-w-5xl items-center gap-2 px-3">
          <button
            className="truncate text-sm font-semibold"
            style={{ maxWidth: "38vw" }}
            onClick={() => setShelfOpen(true)}
            title="书库"
          >
            {cur?.title || "书库"}
          </button>
          <span className="hidden text-xs sm:inline" style={{ color: theme.dim }}>
            {ch ? `第 ${ch.idx + 1} / ${toc.length} 章` : ""}
          </span>
          <span className="flex-1" />
          {busy && <span className="truncate text-xs" style={{ color: theme.dim }}>{busy}</span>}
          <button className="px-2 text-sm" onClick={() => go(-1)} disabled={!ch || ch.idx === 0} title="上一章 ←">‹</button>
          <button className="px-2 text-sm" onClick={() => go(1)} disabled={!ch || ch.idx >= toc.length - 1} title="下一章 →">›</button>
          <button className="px-2 text-sm" onClick={() => { setTocOpen(true); setShelfOpen(false); }}>目录</button>
          <button className="px-2 text-sm" onClick={() => { setCfgOpen((v) => !v); setTocOpen(false); }}>设置</button>
          <button className="px-2 text-sm" onClick={() => { setShelfOpen(true); setTocOpen(false); }}>书库</button>
        </div>
        <div
          className="h-[2px] origin-left"
          style={{
            transform: `scaleX(${prog})`,
            background: "var(--skin-primary, #E8315B)",
            opacity: showProg ? 0.75 : 0,
            transition: "transform .12s linear, opacity .5s ease",
          }}
        />
      </div>

      {/* 设置面板 */}
      {cfgOpen && (
        <div className="mx-auto max-w-5xl px-3 pt-14 md:pt-28">
          <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "rgba(125,125,125,.3)" }}>
            <Row label={`字号 ${cfg.fontSize}px`}>
              <input type="range" min={14} max={30} value={cfg.fontSize} onChange={(e) => setCfg({ ...cfg, fontSize: +e.target.value })} />
            </Row>
            <Row label={`行距 ${cfg.lineHeight.toFixed(2)}`}>
              <input type="range" min={1.3} max={2.6} step={0.05} value={cfg.lineHeight} onChange={(e) => setCfg({ ...cfg, lineHeight: +e.target.value })} />
            </Row>
            <Row label={`段距 ${cfg.paragraphGap.toFixed(2)}`}>
              <input type="range" min={0.2} max={2.2} step={0.05} value={cfg.paragraphGap} onChange={(e) => setCfg({ ...cfg, paragraphGap: +e.target.value })} />
            </Row>
            <Row label={`页宽 ${cfg.width}px`}>
              <input type="range" min={480} max={1200} step={20} value={cfg.width} onChange={(e) => setCfg({ ...cfg, width: +e.target.value })} />
            </Row>
            <Row label="字体">
              {Object.keys(FONTS).map((f) => (
                <button key={f} className="mr-1 rounded border px-2 py-0.5 text-xs"
                  style={{ borderColor: cfg.font === f ? "var(--skin-primary)" : "rgba(125,125,125,.35)" }}
                  onClick={() => setCfg({ ...cfg, font: f })}>{f}</button>
              ))}
            </Row>
            <Row label="底色">
              {Object.keys(THEMES).map((t) => (
                <button key={t} className="mr-1 rounded border px-2 py-0.5 text-xs"
                  style={{ borderColor: cfg.theme === t ? "var(--skin-primary)" : "rgba(125,125,125,.35)" }}
                  onClick={() => setCfg({ ...cfg, theme: t })}>{t}</button>
              ))}
            </Row>
            <button className="mt-1 text-xs underline" style={{ color: theme.dim }}
              onClick={() => setCfg(DEFAULT_SETTINGS)}>恢复默认</button>
          </div>
        </div>
      )}

      {/* 书库抽屉 */}
      {shelfOpen && (
        <Panel onClose={() => setShelfOpen(false)} theme={theme} side="left">
          <h3 className="mb-2 text-sm font-bold">书库（{books.length}）{parsing ? ` · ${parsing} 本解析中` : ""}</h3>
          {books.map((b) => (
            <div key={b.id} className="flex items-center gap-2 border-b py-2 text-sm"
              style={{ borderColor: "rgba(125,125,125,.2)" }}>
              <button className="flex-1 truncate text-left"
                onClick={() => { setShelfOpen(false); void openToc(b); }}>
                <span className={cur?.id === b.id ? "font-bold" : ""}>{b.title}</span>
                <span className="ml-2 text-xs" style={{ color: theme.dim }}>
                  {b.source} · {b.chapters}章{b.state && !b.state.includes("完成") ? ` · ${b.state}` : ""}
                </span>
              </button>
              <button className="px-1 text-xs" style={{ color: theme.dim }} onClick={() => void delBook(b)}>✕</button>
            </div>
          ))}
          {!books.length && <p className="text-sm" style={{ color: theme.dim }}>书库是空的</p>}

          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">加入在线书（顶点小说网）{" "}
              <a href="https://m.xslcb.cc" target="_blank" rel="noreferrer"
                className="text-xs font-normal underline" style={{ color: theme.dim }}>m.xslcb.cc</a>
            </p>
            <div className="flex gap-2">
              <input className="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 text-sm"
                style={{ borderColor: "rgba(125,125,125,.35)" }}
                placeholder="书号（如 666688）或书页网址"
                value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addBook(newUrl)} />
              <button className="rounded border px-2 py-1" style={{ borderColor: "rgba(125,125,125,.35)" }}
                onClick={() => void addBook(newUrl)}>加入</button>
            </div>
            <p className="text-xs" style={{ color: theme.dim }}>
              顶点站禁止搜索，只能按书号加；加完云端后台解析目录（几十章约几秒，上千章约 1-2 分钟），列表会自动刷新。
            </p>

            <p className="pt-2 font-semibold">上传本地 txt</p>
            <input type="file" accept=".txt" className="text-xs"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />

            <p className="pt-2 font-semibold">搜索（御宅屋）{" "}
              <a href="https://yushuwuxs.cc" target="_blank" rel="noreferrer"
                className="text-xs font-normal underline" style={{ color: theme.dim }}>yushuwuxs.cc</a>
            </p>
            <div className="flex gap-2">
              <input className="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 text-sm"
                style={{ borderColor: "rgba(125,125,125,.35)" }}
                placeholder="书名关键词" value={kw} onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void search()} />
              <button className="rounded border px-2 py-1" style={{ borderColor: "rgba(125,125,125,.35)" }}
                onClick={() => void search()}>搜索</button>
            </div>
            {found.map((s) => (
              <div key={s.url} className="flex items-center gap-2 border-b py-1 text-xs"
                style={{ borderColor: "rgba(125,125,125,.2)" }}>
                <span className="flex-1 truncate">{s.title}</span>
                <button className="underline" onClick={() => void addBook(s.url)}>加入</button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* 目录抽屉 */}
      {tocOpen && (
        <Panel onClose={() => setTocOpen(false)} theme={theme} side="right">
          <h3 className="mb-2 text-sm font-bold">目录（{toc.length}）</h3>
          {toc.map((t) => (
            <button key={t.i} className="block w-full truncate border-b py-1.5 text-left text-sm"
              style={{
                borderColor: "rgba(125,125,125,.15)",
                color: ch?.idx === t.i ? "var(--skin-primary,#E8315B)" : readSet.has(t.i) ? theme.dim : theme.text,
                fontWeight: ch?.idx === t.i ? 700 : 400,
              }}
              onClick={() => { setTocOpen(false); void loadChapter(cur!.id, t.i); }}>
              {t.title}
            </button>
          ))}
          {!toc.length && <p className="text-sm" style={{ color: theme.dim }}>目录为空</p>}
        </Panel>
      )}

      {/* 正文 */}
      <main className="mx-auto px-4 pb-24 pt-14 md:pt-28" style={{ maxWidth: cfg.width + 32 }}>
        {err && (
          <div className="mb-4 rounded border px-3 py-2 text-sm"
            style={{ borderColor: "#c0392b55", color: "#c0392b" }}
            onClick={() => setErr("")}>
            {err}（点此关闭）
          </div>
        )}
        {ch ? (
          <article style={{ fontFamily, fontSize: cfg.fontSize, lineHeight: cfg.lineHeight }}>
            <h1 className="mb-6 text-center font-bold" style={{ fontSize: cfg.fontSize + 4 }}>
              {ch.title}
            </h1>
            {ch.paragraphs.map((p, i) => (
              <p key={i} style={{ marginBottom: `${cfg.paragraphGap}em`, textIndent: "2em" }}>
                {p}
              </p>
            ))}
            <div className="mt-10 flex items-center justify-between gap-3 text-sm">
              <button className="rounded border px-3 py-1.5" style={{ borderColor: "rgba(125,125,125,.35)" }}
                disabled={ch.idx === 0} onClick={() => go(-1)}>上一章</button>
              <button className="rounded border px-3 py-1.5" style={{ borderColor: "rgba(125,125,125,.35)" }}
                onClick={() => { setTocOpen(true); }}>目录</button>
              <button className="rounded border px-3 py-1.5" style={{ borderColor: "rgba(125,125,125,.35)" }}
                disabled={ch.idx >= toc.length - 1} onClick={() => go(1)}>下一章</button>
            </div>
          </article>
        ) : (
          <p className="text-sm" style={{ color: theme.dim }}>
            {busy || "从「书库」里选一本书开始阅读。"}
          </p>
        )}
      </main>

      <span className="fixed bottom-2 left-1/2 hidden -translate-x-1/2 text-[11px] md:block" style={{ color: theme.dim }}>
        {ch ? `${pct}%` : ""}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ 小件 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs opacity-70">{label}</span>
      {children}
    </div>
  );
}

function Panel({
  children,
  onClose,
  side,
  theme,
}: {
  children: React.ReactNode;
  onClose: () => void;
  side: "left" | "right";
  theme: { bg: string; text: string };
}) {
  return (
    <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,.35)" }} onClick={onClose}>
      <div
        className="absolute top-0 h-full w-[88vw] max-w-sm overflow-y-auto p-4 shadow-2xl"
        style={{ background: theme.bg, color: theme.text, [side]: 0 } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
