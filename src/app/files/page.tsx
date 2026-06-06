"use client";
import { useState, useRef } from "react";
import { Upload, File, Trash2, Download, FileText } from "lucide-react";

interface MyFile { id: string; name: string; url: string; size: string; type: string; }
const STORAGE_KEY = "minitu_files";

export default function Files() {
  const [files, setFiles] = useState<MyFile[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (f: MyFile[]) => { setFiles(f); localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); };

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files; if (!fl) return;
    const newFiles: MyFile[] = [];
    for (const f of Array.from(fl)) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      const typeMap: Record<string, string> = { pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", ppt: "PPT", pptx: "PPT", zip: "压缩包", rar: "压缩包", "7z": "压缩包", png: "图片", jpg: "图片", jpeg: "图片", gif: "图片", mp4: "视频", mov: "视频", mp3: "音频", txt: "文本" };
      newFiles.push({ id: Date.now().toString(36) + Math.random().toString(36), name: f.name, url: URL.createObjectURL(f), size: (f.size / 1024 / 1024).toFixed(1) + "MB", type: typeMap[ext] || ext.toUpperCase() });
    }
    save([...newFiles, ...files]);
  };

  const del = (id: string) => save(files.filter(f => f.id !== id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-orange-500" />文件</h1>
        <label className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-sm cursor-pointer hover:bg-orange-200 transition-colors">
          <Upload className="w-4 h-4" />上传<input ref={fileRef} type="file" multiple className="hidden" onChange={upload} />
        </label>
      </div>
      <div className="space-y-1">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800/60 border hover:shadow-sm transition-shadow group">
            <File className="w-5 h-5 text-orange-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.name}</p>
              <p className="text-xs text-zinc-400">{f.type} · {f.size}</p>
            </div>
            <a href={f.url} download={f.name} className="p-1.5 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100"><Download className="w-4 h-4" /></a>
            <button onClick={() => del(f.id)} className="p-1.5 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {files.length === 0 && <p className="text-center py-16 text-zinc-400 dark:text-zinc-500 text-sm"><File className="w-10 h-10 mx-auto mb-3 opacity-50" />还没有文件</p>}
      </div>
    </div>
  );
}
