'use client';

import { useEffect, useRef, useState } from 'react';
import { CloudOff, RefreshCw, Check, Loader2, AlertTriangle } from 'lucide-react';
import { subscribe, subscribeSyncError, flush, clearQueue, wireAutoFlush, getQueueLength } from '@/lib/offline-queue';
import { SYNC_BADGE_DURATION_MS } from '@/lib/constants/config';

/**
 * Sync status indicator.
 *
 - Shows "待同步 N 条" with a retry button when the offline queue has backlog.
 - Shows a spinner while flushing.
 - Shows nothing when the queue is empty and the last flush succeeded.
 *
 Mount this once in the layout (it wires up auto-flush on mount).
 */
export default function SyncStatus() {
  const [length, setLength] = useState(getQueueLength());
  const [flushing, setFlushing] = useState(false);
  const [showSynced, setShowSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Track previous length in a ref so the subscribe callback can detect the
  // "drained to 0 after having had items" transition without re-subscribing
  // on every length change (which would cause repeated unsubscribe/wire cycles).
  const prevLengthRef = useRef(length);

  useEffect(() => {
    wireAutoFlush();
    const unsub = subscribe((next, nextFlushing) => {
      const prevLength = prevLengthRef.current;
      setLength(next);
      setFlushing(nextFlushing);
      prevLengthRef.current = next;
      // When the queue drains to 0 after having had items, briefly show "已同步".
      if (next === 0 && prevLength > 0) {
        setShowSynced(true);
        const t = setTimeout(() => setShowSynced(false), SYNC_BADGE_DURATION_MS);
        return () => clearTimeout(t);
      }
    });
    const unsubErr = subscribeSyncError((err) => { setSyncError(err); });
    return () => { unsub(); unsubErr(); };
    // Only subscribe once on mount; prevLengthRef handles the transition logic.
  }, []);

  const handleRetry = () => { void flush(); };
  const handleDiscard = () => {
    if (confirm('确认丢弃所有待同步的写入？这将导致这些更改不会同步到云端。')) {
      void clearQueue();
    }
  };

  // P1-6: 同步错误优先展示
  if (syncError && !flushing) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
        style={{ background: 'var(--skin-surface)', color: 'var(--skin-text-muted)' }}
        title={syncError}
      >
        <AlertTriangle className="size-3" style={{ color: 'var(--skin-primary)' }} />
        同步异常
        <button
          onClick={handleRetry}
          className="ml-1 inline-flex items-center hover:opacity-80"
          style={{ color: 'var(--skin-primary)' }}
          aria-label="立即重试同步"
        >
          <RefreshCw className="size-3" />
        </button>
      </span>
    );
  }

  if (length === 0 && !showSynced) return null;

  if (flushing) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
        style={{ background: 'var(--skin-surface)', color: 'var(--skin-text-muted)' }}
        title="正在同步到云端"
      >
        <Loader2 className="size-3 animate-spin" />
        同步中…
      </span>
    );
  }

  if (length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
        style={{ background: 'var(--skin-surface)', color: 'var(--skin-text-muted)' }}
        title={`待同步 ${length} 条写入（离线时累积）`}
      >
        <CloudOff className="size-3" />
        待同步 {length} 条
        <button
          onClick={handleRetry}
          className="ml-1 inline-flex items-center hover:opacity-80"
          style={{ color: 'var(--skin-primary)' }}
          aria-label="立即重试同步"
        >
          <RefreshCw className="size-3" />
        </button>
        <button
          onClick={handleDiscard}
          className="ml-0.5 text-[10px] hover:opacity-80"
          style={{ color: 'var(--skin-text-muted)' }}
          aria-label="丢弃待同步队列"
        >
          丢弃
        </button>
      </span>
    );
  }

  // showSynced === true
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full animate-fade-in-up"
      style={{ background: 'var(--skin-surface)', color: 'var(--skin-primary)' }}
    >
      <Check className="size-3" />
      已同步
    </span>
  );
}
