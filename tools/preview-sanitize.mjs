#!/usr/bin/env node
// 预演：把净化器跑在云端现有曲库上，看会改哪些标题/路径、会不会误删（只读，不写云端）
// 用法：node --experimental-strip-types scripts/preview-sanitize.mjs
import { readFileSync } from 'node:fs';
import { sanitizeMusicTracks, normalizeTrackPath } from '../src/lib/music-tracks.ts';

const env = {};
for (const line of readFileSync('C:/Projects/garden/.env.local', 'utf-8').split(/\r\n|\r|\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const DB = (env.VPS_DB_URL || '').replace(/\/$/, '');
const res = await fetch(
  `${DB}/resources?id=eq.254e932e-ac70-4320-8944-92107bcc4eb1&select=metadata`,
  { headers: { 'x-storage-key': env.VPS_DB_KEY } },
);
const tracks = (await res.json())[0].metadata.tracks;
console.log(`云端曲库：${tracks.length} 首`);

const { tracks: clean, stats } = sanitizeMusicTracks(tracks);
console.log(`净化统计：`, stats);

const changedTitle = [], changedPath = [];
for (let i = 0; i < tracks.length; i++) {
  if ((tracks[i].title || '') !== (clean[i]?.title || '')) {
    changedTitle.push(`  ${i + 1}. 「${tracks[i].title}」→「${clean[i].title}」 (artist=${tracks[i].artist})`);
  }
  if (normalizeTrackPath(tracks[i].storagePath) !== (tracks[i].storagePath || '')) {
    changedPath.push(`  ${i + 1}. ${tracks[i].storagePath} → ${clean[i].storagePath}`);
  }
}
console.log(`\n标题会被改写 ${changedTitle.length} 条：`);
console.log(changedTitle.join('\n') || '  （无）');
console.log(`\n路径会被补前缀 ${changedPath.length} 条：`);
console.log(changedPath.join('\n') || '  （无）');

if (stats.removed > 0) {
  const keptPaths = new Set(clean.map((t) => t.storagePath));
  console.log(`\n⚠️ 会被去重丢掉 ${stats.removed} 条：`);
  for (const t of tracks) {
    if (!keptPaths.has(normalizeTrackPath(t.storagePath))) continue;
    if (clean.filter((c) => c.storagePath === normalizeTrackPath(t.storagePath)).length > 0) continue;
    console.log(`  - ${t.title} | ${t.artist} | ${t.storagePath}`);
  }
}
console.log(`\n净身后数量：${clean.length}（原 ${tracks.length}）`);
