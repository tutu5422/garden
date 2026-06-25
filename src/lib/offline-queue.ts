// Offline write queue — persists failed / offline /api/sync POST operations to
// IndexedDB and replays them when the network recovers.
//
// Why this exists:
// - Before this module, `syncToCloud` in local-store.ts was fire-and-forget:
//   if the POST failed (offline, 5xx, network error) the write was silently
//   lost. The cloud copy of the data never got created/updated.
// - This module intercepts those failures, stores the { table, action, data }
//   payload in IDB, and flushes the queue on `online` event, on startup, and
//   after every subsequent successful write.
//
// Storage shape:
// - DB: `minitu-offline-queue`, store: `queue`, keyPath: `id`
// - Each row: { id, table, action, data, createdAt, attempts, lastError? }
//
// Concurrency:
// - A single in-flight flush guard (`flushInFlight`) prevents parallel flushes
//   from double-replaying the same rows.
// - Subscribers are notified whenever the visible queue length changes so the
//   UI (SyncStatus) stays in sync without polling.

'use client';

import type { SyncPostPayload } from '@/lib/sync-schema';
import { OFFLINE_FLUSH_INTERVAL_MS } from '@/lib/constants/config';

const DB_NAME = 'minitu-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

export interface QueueItem {
  id: string;
  table: string;
  action: string;
  data: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

type Listener = (length: number, flushing: boolean) => void;

const listeners = new Set<Listener>();
let cachedLength = 0;
let flushInFlight = false;
let lastFlushAllSucceeded = true;

// ---------------------------------------------------------------------------
// IDB helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txAll(mode: IDBTransactionMode): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as QueueItem[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function txPut(item: QueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function txDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function txClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ---------------------------------------------------------------------------
// Length tracking + subscriptions
// ---------------------------------------------------------------------------

async function refreshLength(): Promise<number> {
  try {
    const items = await txAll('readonly');
    cachedLength = items.length;
    return cachedLength;
  } catch {
    return cachedLength;
  }
}

function notify(flushing: boolean) {
  for (const l of listeners) {
    try { l(cachedLength, flushing); } catch { /* listener error is non-fatal */ }
  }
}

/** Subscribe to queue-length + flushing-state changes. Returns an unsubscribe fn. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Immediately emit the current state so new subscribers don't need to poll.
  try { listener(cachedLength, flushInFlight); } catch { /* ignore */ }
  return () => { listeners.delete(listener); };
}

/** Current cached queue length (no IDB round-trip). */
export function getQueueLength(): number {
  return cachedLength;
}

// ---------------------------------------------------------------------------
// Enqueue / flush
// ---------------------------------------------------------------------------

function uid(): string {
  return crypto.randomUUID?.() || `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Add a failed write to the queue. Called by `syncToCloud` when the POST to
 * /api/sync fails or the browser is offline.
 */
export async function enqueue(
  table: string,
  action: string,
  data: unknown,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const item: QueueItem = {
    id: uid(),
    table,
    action,
    data,
    createdAt: Date.now(),
    attempts: 0,
  };
  try {
    await txPut(item);
    await refreshLength();
    notify(false);
    // Try a flush immediately — the failure may have been transient.
    void flush();
  } catch { /* IDB unavailable; nothing we can do */ }
}

/**
 * Replay every queued item via POST /api/sync. Items that succeed are removed;
 * items that fail again stay in the queue (with attempts++ and lastError).
 * Safe to call concurrently — a single in-flight guard serializes calls.
 */
export async function flush(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (flushInFlight) return;
  // Don't bother starting a flush while offline — the POSTs would all fail.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  flushInFlight = true;
  notify(true);
  try {
    let items: QueueItem[];
    try {
      items = await txAll('readonly');
    } catch {
      return;
    }
    if (items.length === 0) {
      lastFlushAllSucceeded = true;
      return;
    }

    // Replay in insertion order (oldest first) so dependent writes apply in
    // the order the user performed them.
    items.sort((a, b) => a.createdAt - b.createdAt);

    let allOk = true;
    for (const item of items) {
      const ok = await replayOne(item);
      if (ok) {
        await txDelete(item.id).catch(() => {});
      } else {
        allOk = false;
        // Bump attempts and persist the updated error info.
        await txPut({ ...item, attempts: item.attempts + 1 }).catch(() => {});
      }
    }
    lastFlushAllSucceeded = allOk;
    await refreshLength();
    notify(false);
  } finally {
    flushInFlight = false;
    notify(false);
  }
}

async function replayOne(item: QueueItem): Promise<boolean> {
  try {
    const payload = { table: item.table, action: item.action, data: item.data } as SyncPostPayload;
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Clear the entire queue (used by "discard pending" UI action). */
export async function clearQueue(): Promise<void> {
  await txClear().catch(() => {});
  await refreshLength();
  notify(false);
}

/** True iff the last flush attempt replayed every item successfully. */
export function isFullySynced(): boolean {
  return cachedLength === 0 && lastFlushAllSucceeded;
}

// ---------------------------------------------------------------------------
// Auto-flush wiring: flush on startup, on `online`, and periodically.
// ---------------------------------------------------------------------------

let wired = false;

/** Wire up window event listeners. Idempotent — safe to call from multiple components. */
export function wireAutoFlush(): void {
  if (typeof window === 'undefined' || wired) return;
  wired = true;

  // Initial length read so the UI shows the right count on first paint.
  void refreshLength().then(() => notify(false));

  // Flush on startup (in case there's a backlog from a previous session).
  void flush();

  // Flush whenever the browser transitions to online.
  window.addEventListener('online', () => { void flush(); });

  // Periodic retry — covers flaky networks where `online` doesn't fire.
  setInterval(() => { void flush(); }, OFFLINE_FLUSH_INTERVAL_MS);

  // Re-read length on focus (another tab may have drained the queue).
  window.addEventListener('focus', () => { void refreshLength().then(() => notify(false)); });
}
