/**
 * P1-4: BroadcastChannel 跨标签页协调。
 *
 * 用 BroadcastChannel('garden-sync') 广播写/同步事件，各标签页监听并刷新
 * 本地视图，避免各自独立 sync 导致冲突，也补充 `storage` 事件无法覆盖的
 * 场景（例如同一 origin 的两个标签页写入相同 key 时 storage 事件不触发）。
 */

'use client';

const CHANNEL_NAME = 'garden-sync';

export type SyncBroadcastMessage =
  | { type: 'write'; table: string; action: string; id?: string }
  | { type: 'sync-success'; table: string }
  | { type: 'sync-error'; table: string; error: string }
  | { type: 'request-refresh' };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

/** 广播一条同步事件给其他标签页。 */
export function broadcastSync(message: SyncBroadcastMessage): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage(message);
  } catch {
    /* non-fatal */
  }
}

/** 订阅来自其他标签页的同步事件。返回取消订阅函数。 */
export function subscribeSyncBroadcast(
  handler: (message: SyncBroadcastMessage) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent<SyncBroadcastMessage>) => {
    try {
      handler(e.data);
    } catch {
      /* non-fatal */
    }
  };
  ch.addEventListener('message', listener);
  return () => {
    try {
      ch.removeEventListener('message', listener);
    } catch {
      /* non-fatal */
    }
  };
}
