"use client";

import { useState } from "react";
import { useMusic, type LoopMode } from "@/lib/music/MusicContext";
import { Play, Pause, SkipBack, SkipForward, Music, ListMusic, Repeat, Repeat1, Shuffle, Heart } from "lucide-react";
import { toggleFavorite, getFavoritedIds } from '@/lib/music/music-store'
import Link from 'next/link'
import { cn } from '@/lib/utils'

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

  const [showList, setShowList] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  if (!ctx) return <EmptyState />;

  const { playlist, currentIndex, currentTrack, playing, loopMode,
    currentTime, duration, togglePlay, play, seek, next, prev, cycleLoopMode } = ctx;

  const fmtTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const LoopIcon = loopIcons[loopMode];

  if (playlist.length === 0) {
    return (
      <div className="flex flex-col gap-3 py-1">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <p className="text-sm font-extrabold truncate px-1 max-w-[200px]" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
            {currentTrack?.title || "未选择"}
          </p>
          {currentTrack && (
            <button
              onClick={(e) => {
                e.preventDefault()
                toggleFavorite(currentTrack.id)
              }}
              className="p-0.5 shrink-0 transition-all hover:scale-110">
              <Heart className={cn('size-3', getFavoritedIds().has(currentTrack.id) && 'fill-current')}
                style={{ color: getFavoritedIds().has(currentTrack.id) ? '#ff6e6e' : 'rgba(255,255,255,0.4)' }} />
            </button>
          )}
        </div>
        {(currentTrack?.artist || currentTrack?.album) && (
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            {currentTrack.artist && (
              <span className="text-[10px] opacity-60 text-white/70">{currentTrack.artist}</span>
            )}
            {currentTrack.album && (
              <>
                <span className="text-[8px] opacity-30 text-white/50">·</span>
                <span className="text-[10px] opacity-60 text-white/70 truncate max-w-[120px]">{currentTrack.album}</span>
              </>
            )}
          </div>
        )}
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

      {/* Progress Bar */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] w-8 shrink-0">
          {seeking ? fmtTime(seekValue) : fmtTime(currentTime)}
        </span>
        <input
          type="range"
          min="0"
          max={duration && isFinite(duration) ? duration : 0}
          step="0.1"
          value={seeking ? seekValue : currentTime}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setSeeking(true);
            setSeekValue(v);
          }}
          onMouseUp={() => { seek(seekValue); setSeeking(false); }}
          onTouchEnd={() => { seek(seekValue); setSeeking(false); }}
          className="flex-1 h-1 accent-[var(--skin-primary)] cursor-pointer"
          style={{ background: 'var(--skin-muted)' }}
        />
        <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] w-8 shrink-0">
          {fmtTime(duration)}
        </span>
      </div>

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
