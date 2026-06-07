"use client";

import { useState } from "react";
import { useMusic, type LoopMode } from "@/lib/music/MusicContext";
import { Play, Pause, SkipBack, SkipForward, Music, ListMusic, Repeat, Repeat1, Shuffle } from "lucide-react";

const loopIcons: Record<LoopMode, any> = { none: Repeat, all: Repeat, one: Repeat1, shuffle: Shuffle };

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <Music className="size-8 mb-2 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
      <span className="text-xs font-bold tracking-wider text-[var(--skin-text-secondary)]">还没有音乐</span>
      <span className="text-[10px] mt-1 opacity-50 text-[var(--skin-text-secondary)]">上传音频自动加入</span>
    </div>
  );
}

export default function HomeMusicPlayer() {
  const ctx = useMusic();

  if (!ctx) return <EmptyState />;

  const { playlist, currentIndex, currentTrack, playing, loopMode,
    togglePlay, play, next, prev, cycleLoopMode } = ctx;
  const [showList, setShowList] = useState(false);

  if (playlist.length === 0) return <EmptyState />;

  const LoopIcon = loopIcons[loopMode];

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="text-center">
        <p className="text-sm font-extrabold truncate px-1" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
          {currentTrack?.title || "未选择"}
        </p>
        <div className="flex items-center justify-center gap-3 mt-1.5">
          <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">{currentIndex + 1}/{playlist.length}</span>
          <button onClick={(e) => { e.preventDefault(); cycleLoopMode(); }}
                  className="p-0.5" style={{ color: loopMode !== 'none' ? 'var(--skin-primary)' : 'var(--skin-text-secondary)' }}>
            <LoopIcon className="size-3.5" />
          </button>
          <button onClick={(e) => { e.preventDefault(); setShowList(!showList); }}
                  className={`p-0.5 ${showList ? '' : ''}`} style={{ color: showList ? 'var(--skin-primary)' : 'var(--skin-text-secondary)' }}>
            <ListMusic className="size-3.5" />
          </button>
        </div>
      </div>

      {/* EQ Bars */}
      {playing && (
        <div className="flex items-end justify-center gap-0.5 h-6">
          {[5, 9, 4, 11, 6, 8, 5, 10, 4, 7].map((h, i) => (
            <span key={i} className="w-[2.5px] rounded-full eq-bar"
                  style={{ height: `${h}px`, background: 'var(--skin-primary)', animationDelay: `${i * 110}ms` }} />
          ))}
        </div>
      )}

      {/* Playlist */}
      {showList && (
        <div className="max-h-44 overflow-y-auto p-2 space-y-0.5 animate-fade-in-scale border-2 border-[var(--skin-border)]"
             style={{ background: 'var(--skin-muted)' }}>
          {playlist.map((t, i) => (
            <button key={t.id}
              onClick={(e) => { e.preventDefault(); play(i); }}
              className="w-full flex items-center gap-2 px-2 py-2 text-xs text-left transition-colors hover:bg-[var(--skin-surface)] font-medium"
              style={i === currentIndex ? { color: 'var(--skin-primary)', fontWeight: 700, background: 'rgba(var(--skin-primary-rgb), 0.08)' } : {}}>
              <span className="shrink-0 w-5 text-right text-[var(--skin-text-secondary)] font-mono">
                {i === currentIndex && playing ? (
                  <span className="flex gap-px justify-center">
                    {[2, 4, 2].map((h, j) => <span key={j} className="w-0.5 rounded-full eq-bar" style={{ height: `${h * 2}px`, background: 'var(--skin-primary)', animationDelay: `${j * 150}ms` }} />)}
                  </span>
                ) : (i + 1)}
              </span>
              <span className="truncate flex-1">{t.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-5">
        <button onClick={(e) => { e.preventDefault(); prev(); }}
                className="p-2 transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
          <SkipBack className="size-4" />
        </button>
        <button onClick={(e) => { e.preventDefault(); togglePlay(); }}
                className="size-11 flex items-center justify-center border-2 border-[var(--skin-primary)] transition-all duration-200 hover:scale-105"
                style={{ background: 'var(--skin-primary)', color: '#fff', borderRadius: '50%' }}>
          {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
        </button>
        <button onClick={(e) => { e.preventDefault(); next(); }}
                className="p-2 transition-colors hover:text-[var(--skin-primary)]" style={{ color: 'var(--skin-text-secondary)' }}>
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  );
}
