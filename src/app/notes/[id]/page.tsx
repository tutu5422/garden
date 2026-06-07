"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Calendar, Layers, Tag } from "lucide-react";

interface Note {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; image?: string; imageThumb?: string;
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    try {
      const notes: Note[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      const found = notes.find((n) => n.id === id);
      if (found) setNote(found);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  const handleDelete = () => {
    if (!note || !confirm("确定要删除这篇笔记吗？")) return;
    try {
      const notes: Note[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      const updated = notes.filter((n) => n.id !== note.id);
      localStorage.setItem("minitu_notes", JSON.stringify(updated));
      router.push("/notes");
    } catch {}
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

      {/* Cover Image */}
      {note.image && (
        <div className="rounded-2xl overflow-hidden mb-8 border-2 border-[var(--skin-border)]">
          <img
            src={note.image}
            alt={note.title}
            className="w-full max-h-96 object-cover"
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

      {/* Empty content hint */}
      {!note.content && (
        <div className="text-center py-16">
          <p className="text-sm text-[var(--skin-text-secondary)] font-bold tracking-wider">
            这篇笔记还没有内容
          </p>
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
