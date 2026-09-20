/**
 * 音乐封面清单（带读签名）
 *
 * `public/music-covers-manifest.json` 是静态文件，里面的封面是**不带签名**的存储 URL；
 * `/storage/` 读现在需要签名，所以改由这里下发：JSON 直接 import（随函数打包，免 fs 路径问题），
 * 出口处把 coverUrl 换成签名版本。
 *
 * 前端优先用本接口，失败则退回静态文件（本地开发/极端情况下封面可能 403，不影响播放）。
 */
import { NextResponse } from 'next/server';
import manifest from '../../../../public/music-covers-manifest.json';
import { signStorageDeep } from '@/lib/storage-sign';

type CoverEntry = { albumKey?: string; coverUrl?: string | null; status?: string };

export async function GET() {
  const entries = (manifest as CoverEntry[]).map((e) => ({
    ...e,
    coverUrl: e.coverUrl ? signStorageDeep(e.coverUrl) : e.coverUrl,
  }));
  return NextResponse.json(entries, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}
