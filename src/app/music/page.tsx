"use client";
import { useState, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Upload, Music, Trash2 } from "lucide-react";

interface Track {
  id: string; name: string; url: string;
}

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("minitu_music") || "[]"); } catch { return []; }
    }
    return [];
  });
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (t: Track[]) => { setTracks(t); localStorage.setItem("minitu_music", JSON.stringify(t)); };

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newTracks: Track[] = [];
    for (const f of Array.from(files)) {
      newTracks.push({ id: Date.now() + Math.random().toString(36), name: f.name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(f) });
    }
    save([...tracks, ...newTracks]);
  };

  const play = (i: number) => { setCurrent(i); setPlaying(true); setTimeout(() => audioRef.current?.play(), 100); };
  const toggle = () => { if (playing) audioRef.current?.pause(); else audioRef.current?.play(); setPlaying(!playing); };
  const prev = () => { const i = current > 0 ? current - 1 : tracks.length - 1; play(i); };
  const next = () => { const i = current < tracks.length - 1 ? current + 1 : 0; play(i); };
  const del = (i: number) => { save(tracks.filter((_, idx) => idx !== i)); if (i === current) setPlaying(false); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2"><Music className="w-6 h-6 text-rose-500" />音乐</h1>
        <label className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm cursor-pointer hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors">
          <Upload className="w-4 h-4" />上传<input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={upload} />
        </label>
      </div>

      {tracks.length === 0 && <div className="text-center py-20 text-zinc-400 dark:text-zinc-500"><Music className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>还没有音乐，点击上传添加</p></div>}

      <div className="space-y-1">
        {tracks.map((t, i) => (
          <div key={t.id} onClick={() => play(i)} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${i === current ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300"}`}>
            <span className="text-xs text-zinc-400 w-6">{i + 1}</span>
            <span className="flex-1 truncate text-sm">{t.name}</span>
            <button onClick={e => { e.stopPropagation(); del(i); }} className="p-1 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {tracks.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200/50 dark:border-zinc-800/50 p-4">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate flex-1">{tracks[current]?.name || "未选择"}</p>
            <div className="flex items-center gap-3">
              <button onClick={prev}><SkipBack className="w-5 h-5" /></button>
              <button onClick={toggle} className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white flex items-center justify-center hover:scale-105 transition-all">{playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}</button>
              <button onClick={next}><SkipForward className="w-5 h-5" /></button>
            </div>
            <Volume2 className="w-4 h-4 text-zinc-400" />
          </div>
          <audio ref={audioRef} src={tracks[current]?.url} onEnded={next} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
        </div>
      )}
    </div>
  );
}
