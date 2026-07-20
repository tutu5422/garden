"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Calendar, Layers, Tag, ChevronLeft, ChevronRight, X } from "lucide-react";
import { getPatternsForNote } from "@/lib/api/patterns-api";
import type { Resource } from "@/lib/types";

interface Note {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; updatedAt?: string;
  image?: string; imageThumb?: string;
  images?: string[]; imageThumbs?: string[];
}

/** Helper: 获取所有可用图片（兼容旧单图格式） */
function getNoteImages(note: Note): { full: string; thumb: string }[] {
  const result: { full: string; thumb: string }[] = []
  if (note.images?.length) {
    const thumbs = note.imageThumbs?.length === note.images.length ? note.imageThumbs : []
    for (let i = 0; i < note.images.length; i++) {
      result.push({ full: note.images[i], thumb: thumbs[i] || note.images[i] })
    }
  } else if (note.image || note.imageThumb) {
    result.push({ full: note.image!, thumb: note.imageThumb || note.image! })
  }
  return result
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [linkedPatterns, setLinkedPatterns] = useState<Resource[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const notes: Note[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
        const found = notes.find((n) => n.id === id);
        if (found) {
          setNote(found);
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'notes', action: 'upsert', data: found }),
          }).catch((e) => console.warn('[sync] note detail sync failed:', e));
          return;
        }
        try {
          const cloudRes = await fetch('/api/sync');
          if (cloudRes.ok) {
            const data = await cloudRes.json();
            const cloudNote = (data.notes || []).find((n: any) => n.id === id);
            if (cloudNote) {
              setNote({
                id: cloudNote.id,
                title: cloudNote.title,
                content: cloudNote.content || '',
                type: cloudNote.type || 'article',
                tags: cloudNote.tags || [],
                collectionId: cloudNote.collectionId,
                collectionName: cloudNote.collectionName,
                createdAt: cloudNote.createdAt || cloudNote.created_at,
                image: cloudNote.image,
                imageThumb: cloudNote.imageThumb,
                images: cloudNote.images,
                imageThumbs: cloudNote.imageThumbs,
              });
              return;
            }
          }
        } catch (e) {
          console.warn('[sync] 从云端加载笔记失败:', e);
        }
        setNotFound(true);
      } catch {
        setNotFound(true);
      }
    };
    load();
    if (id) {
      void (async () => {
        try {
          const patterns = await getPatternsForNote(id);
          setLinkedPatterns(patterns);
        } catch (e) {
          console.error("加载关联图解失败:", e);
        }
      })();
    }
  }, [id]);

  const handleDelete = async () => {
    if (!note || !confirm("确定要删除这篇笔记吗？")) return;
    try {
      const notes: Note[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      const updated = notes.filter((n) => n.id !== note.id);
      localStorage.setItem("minitu_notes", JSON.stringify(updated));
      try {
        const deleted = JSON.parse(localStorage.getItem("minitu_notes_deleted") || "[]");
        if (!deleted.includes(note.id)) deleted.push(note.id);
        localStorage.setItem("minitu_notes_deleted", JSON.stringify(deleted));
      } catch {}
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'notes', action: 'delete', data: { id: note.id } }),
      }).catch((e) => console.warn('[sync] note detail delete failed:', e));
      router.push("/notes");
    } catch {
      console.warn('[notes] 删除笔记异常');
    }
  };

  // Simple markdown-like rendering
  const renderContent = (md: string) => {
    return md
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("### ")) return `<h3 class="text-lg font-extrabold mt-6 mb-2" style="font-family:var(--font-display);color:var(--skin-text)">${line.slice(4)}</h3>`;
        if (line.startsWith("## ")) return `<h2 class="text-xl font-extrabold mt-8 mb-3" style="font-family:var(--font-display);color:var(--skin-text)">${line.slice(3)}</h2>`;
        if (line.startsWith("# ")) return `<h1 class="text-2xl font-extrabold mt-8 mb-3" style="font-family:var(--font-display);color:var(--skin-text)">${line.slice(2)}</h1>`;
        if (line.startsWith("- ")) return `<li class="ml-4 text-sm leading-relaxed" style="color:var(--skin-text-secondary)">${line.slice(2)}</li>`;
        if (line.startsWith("> ")) return `<blockquote class="border-l-[3px] pl-4 my-3 text-sm italic" style="border-color:var(--skin-primary);color:var(--skin-text-secondary);font-family:var(--font-display)">${line.slice(2)}</blockquote>`;
        if (line.trim() === "") return '<br/>';
        return `<p class="text-sm leading-relaxed" style="color:var(--skin-text)">${line}</p>`;
      })
      .join("");
  };

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center page-enter">
        <p className="text-sm font-bold tracking-wider text-[var(--skin-text-secondary)]">笔记不存在或已被删除</p>
        <button onClick={() => router.push("/notes")} className="mt-4 btn">
          <ArrowLeft className="size-4" />返回笔记
        </button>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center page-enter">
        <div className="size-8 mx-auto mb-4 rounded-full border-2 border-[var(--skin-primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const images = getNoteImages(note);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 page-enter">
      {/* Back */}
      <button
        onClick={() => router.push("/notes")}
        className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] transition-colors mb-8"
      >
        <ArrowLeft className="size-3.5" />
        返回笔记
      </button>

      {/* Image Gallery */}
      {images.length > 0 && (
        <div className={images.length === 1 ? "rounded-2xl overflow-hidden mb-8 border-2 border-[var(--skin-border)]" : "mb-8 space-y-2"}>
          {images.length === 1 ? (
            <img
              src={images[0].full}
              alt={note.title}
              className="w-full max-h-96 object-cover cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => setLightboxIdx(0)}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="rounded-xl overflow-hidden border-2 border-[var(--skin-border)] aspect-square cursor-pointer hover:opacity-90 transition-opacity"
                     onClick={() => setLightboxIdx(i)}>
                  <img src={img.thumb} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && images[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
             onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                  onClick={() => setLightboxIdx(null)}>
            <X className="size-8" />
          </button>
          {images.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); setLightboxIdx(prev => Math.max(0, prev! - 1)); }}>
                <ChevronLeft className="size-10" />
              </button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); setLightboxIdx(prev => Math.min(images.length - 1, prev! + 1)); }}>
                <ChevronRight className="size-10" />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-mono">
                {lightboxIdx + 1} / {images.length}
              </span>
            </>
          )}
          <img
            src={images[lightboxIdx].full}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {note.collectionName && (
          <span className="tag">
            <Layers className="size-3 mr-1" />
            {note.collectionName}
          </span>
        )}
        <span className="tag">
          <Calendar className="size-3 mr-1" />
          {new Date(note.createdAt).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        {note.tags.map((t) => (
          <span key={t} className="tag">
            <Tag className="size-3 mr-1" />
            {t}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1
        className="editorial-section-title mb-8"
        style={{ color: "var(--skin-text)" }}
      >
        {note.title}
      </h1>

      {/* Content */}
      {note.content && (
        <div
          className="prose-custom drop-cap"
          dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
        />
      )}

      {!note.content && (
        <div className="text-center py-16">
          <p className="text-sm text-[var(--skin-text-secondary)] font-bold tracking-wider">
            这篇笔记还没有内容
          </p>
        </div>
      )}

      {/* 关联图解 */}
      {linkedPatterns.length > 0 && (
        <div className="mt-8 pt-6 border-t-2 border-[var(--skin-border)]">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="size-4" style={{ color: "var(--skin-primary)" }} />
            <h2
              className="text-sm font-extrabold tracking-wider uppercase"
              style={{ color: "var(--skin-text)", fontFamily: "var(--font-display)" }}
            >
              关联图解
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {linkedPatterns.map((p) => (
              <a
                key={p.id}
                href={`/patterns/${p.id}`}
                className="tag inline-flex items-center gap-1.5 transition-all hover:scale-105"
                style={{ textDecoration: "none" }}
              >
                <ArrowLeft className="size-3 rotate-180" />
                {p.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-8 mt-8 border-t-2 border-[var(--skin-border)]">
        <button
          onClick={() => router.push(`/notes/edit?id=${note.id}`)}
          className="btn btn-ghost btn-sm"
        >
          <Pencil className="size-3.5" />
          编辑
        </button>
        <button onClick={handleDelete} className="btn btn-ghost btn-sm hover:text-red-500">
          <Trash2 className="size-3.5" />
          删除
        </button>
      </div>
    </div>
  );
}
