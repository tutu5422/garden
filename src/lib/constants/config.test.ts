import { describe, it, expect } from 'vitest';
import {
  MAX_FILE_SIZE,
  SYNC_PAGE_LIMIT,
  OFFLINE_FLUSH_INTERVAL_MS,
  SYNC_BADGE_DURATION_MS,
  AUTH_TOKEN_TTL_MS,
  LYRICS_FETCH_TIMEOUT_MS,
  NOTE_DESCRIPTION_MAX_LENGTH,
} from './config';

describe('app constants', () => {
  it('MAX_FILE_SIZE is 50 MB', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  it('SYNC_PAGE_LIMIT is a positive integer', () => {
    expect(SYNC_PAGE_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(SYNC_PAGE_LIMIT)).toBe(true);
  });

  it('OFFLINE_FLUSH_INTERVAL_MS is 60 seconds', () => {
    expect(OFFLINE_FLUSH_INTERVAL_MS).toBe(60_000);
  });

  it('SYNC_BADGE_DURATION_MS is positive', () => {
    expect(SYNC_BADGE_DURATION_MS).toBeGreaterThan(0);
  });

  it('AUTH_TOKEN_TTL_MS is 30 days', () => {
    expect(AUTH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('LYRICS_FETCH_TIMEOUT_MS is 8 seconds', () => {
    expect(LYRICS_FETCH_TIMEOUT_MS).toBe(8000);
  });

  it('NOTE_DESCRIPTION_MAX_LENGTH is 500', () => {
    expect(NOTE_DESCRIPTION_MAX_LENGTH).toBe(500);
  });
});
