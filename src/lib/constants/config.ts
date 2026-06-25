/**
 * Centralized application constants — magic numbers that appear in multiple
 * files or have non-obvious meaning. Keeping them here makes tuning and
 * auditing easier.
 */

/** Maximum file size for uploads (files + music). 50 MB. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Page limit for sync GET queries (notes, resources, files). */
export const SYNC_PAGE_LIMIT = 200;

/** Offline queue auto-flush interval (ms). Runs on a timer to replay
 *  pending writes even if no online event fires. */
export const OFFLINE_FLUSH_INTERVAL_MS = 60_000;

/** Duration (ms) the "synced" badge stays visible before fading. */
export const SYNC_BADGE_DURATION_MS = 2500;

/** Auth token validity (ms). 30 days. */
export const AUTH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Lyrics API (lrclib.net) fetch timeout (ms). */
export const LYRICS_FETCH_TIMEOUT_MS = 8000;

/** Max note content length stored as `description` (truncated from full content). */
export const NOTE_DESCRIPTION_MAX_LENGTH = 500;
