import { describe, it, expect } from 'vitest';
import {
  normalizeTrackTitle,
  normalizeTrackPath,
  sanitizeMusicTracks,
  sanitizeMusicTracksDeep,
} from './music-tracks';

describe('normalizeTrackTitle', () => {
  it('剥离「歌手 - 」前缀（前缀确实等于歌手时）', () => {
    expect(normalizeTrackTitle('Rileigh Grey - Hello, Goodbye', 'Rileigh Grey')).toBe('Hello, Goodbye');
    expect(normalizeTrackTitle('陈小春 - 街角的晚风', '陈小春')).toBe('街角的晚风');
    expect(normalizeTrackTitle('Adele: Hello', 'adele')).toBe('Hello');
  });

  it('前缀不是歌手时原样保留（不误伤正常标题）', () => {
    expect(normalizeTrackTitle('A - B', 'C')).toBe('A - B');
    expect(normalizeTrackTitle('借过一下 (Live)', '陈小春')).toBe('借过一下 (Live)');
    expect(normalizeTrackTitle('Hello, Goodbye', 'Rileigh Grey')).toBe('Hello, Goodbye');
  });

  it('空值安全', () => {
    expect(normalizeTrackTitle(undefined, 'X')).toBe('');
    expect(normalizeTrackTitle('X - Y', undefined)).toBe('X - Y');
    expect(normalizeTrackTitle('X - ', 'X')).toBe('X -');
  });
});

describe('normalizeTrackPath', () => {
  it('裸 uuid 路径补 music/ 前缀', () => {
    const u = '55b8ae0c-1b94-472b-82d5-b8647f762a3e/55b8ae0c-1b94-472b-82d5-b8647f762a3e.mp3';
    expect(normalizeTrackPath(u)).toBe(`music/${u}`);
  });

  it('已带前缀 / 去前导斜杠 / http 直链不动', () => {
    expect(normalizeTrackPath('music/a/b.mp3')).toBe('music/a/b.mp3');
    expect(normalizeTrackPath('/music/a/b.mp3')).toBe('music/a/b.mp3');
    expect(normalizeTrackPath('patterns/x.pdf')).toBe('patterns/x.pdf');
    expect(normalizeTrackPath('https://cdn.example.com/a.mp3')).toBe('https://cdn.example.com/a.mp3');
    expect(normalizeTrackPath('  ')).toBe('');
  });
});

describe('sanitizeMusicTracks', () => {
  it('同曲两种写法去重，保留带正确前缀的那条', () => {
    const { tracks, stats } = sanitizeMusicTracks([
      {
        id: 'z1',
        title: 'Rileigh Grey - Hello, Goodbye',
        artist: 'Rileigh Grey',
        storagePath: '607aa27c-a77a-bb85-f02a-a7100dd2d020/607aa27c-a77a-bb85-f02a-a7100dd2d020.mp3',
      },
      {
        id: 'good',
        title: 'Hello, Goodbye',
        artist: 'Rileigh Grey',
        storagePath: 'music/607aa27c-a77a-bb85-f02a-a7100dd2d020/607aa27c-a77a-bb85-f02a-a7100dd2d020.mp3',
      },
    ]);
    expect(tracks).toHaveLength(1);
    expect(stats.removed).toBe(1);
    expect(tracks[0].id).toBe('good');
    expect(tracks[0].title).toBe('Hello, Goodbye');
    expect(tracks[0].storagePath).toMatch(/^music\//);
  });

  it('僵尸路径被修好（不是被删）', () => {
    const { tracks, stats } = sanitizeMusicTracks([
      { title: '三峰', artist: '布衣乐队', storagePath: '099e1f81-0a94-478b-90ef-bdb19c78eba4/099e1f81-0a94-478b-90ef-bdb19c78eba4.mp3' },
    ]);
    expect(tracks[0].storagePath).toBe(
      'music/099e1f81-0a94-478b-90ef-bdb19c78eba4/099e1f81-0a94-478b-90ef-bdb19c78eba4.mp3',
    );
    expect(stats.pathFixed).toBe(1);
  });

  it('不同歌、缺字段、非对象元素都不炸', () => {
    const { tracks, stats } = sanitizeMusicTracks([
      { title: 'A' },
      null,
      'x',
      { title: 'B', storagePath: 'music/b.mp3' },
    ]);
    expect(tracks).toHaveLength(2);
    expect(stats.removed).toBe(0);
    expect(stats.total).toBe(4);
  });

  it('非数组输入返回空', () => {
    expect(sanitizeMusicTracks(undefined).tracks).toEqual([]);
    expect(sanitizeMusicTracks({}).tracks).toEqual([]);
  });

  it('完全相同的路径只留一条', () => {
    const p = 'music/x/y.mp3';
    const { tracks } = sanitizeMusicTracks([{ title: 'S', storagePath: p }, { title: 'S2', storagePath: p }]);
    expect(tracks).toHaveLength(1);
  });
});

describe('sanitizeMusicTracksDeep', () => {
  it('metadata.tracks 被净化', () => {
    const out = sanitizeMusicTracksDeep({
      metadata: { tracks: [{ title: 'Rileigh Grey - X', artist: 'Rileigh Grey', storagePath: 'music/a.mp3' }], updated_at: 't' },
      title: '__music_playlist__',
    }) as { metadata: { tracks: { title: string }[]; updated_at: string } };
    expect(out.metadata.tracks[0].title).toBe('X');
    expect(out.metadata.updated_at).toBe('t');
  });

  it('不含曲库的对象原样返回（同一引用）', () => {
    const payload = { metadata: { is_pattern: true } };
    expect(sanitizeMusicTracksDeep(payload)).toBe(payload);
    expect(sanitizeMusicTracksDeep({ rows: [] })).toEqual({ rows: [] });
  });
});
