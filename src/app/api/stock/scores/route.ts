import { NextResponse } from 'next/server';
import { vpsDbFetch } from '@/lib/vps-db';

const STOCK_SCORE_ID = 'c1ad27bc-1a67-5ef8-b93b-e08bc15a4a11';
const STOCK_BASIC_ID = 'e481099f-8508-5ff5-880a-a7457b62b7e7';

// Cache for 5 minutes
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    // Fetch scores
    const scoreRes = await vpsDbFetch(
      `resources?id=eq.${STOCK_SCORE_ID}&select=metadata`,
      { next: { revalidate: 300 } }
    );
    if (!scoreRes.ok || !Array.isArray(scoreRes.body) || !scoreRes.body[0]) {
      return NextResponse.json({ error: 'Failed to fetch stock scores' }, { status: 500 });
    }

    const metadata = (scoreRes.body[0] as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    if (!metadata) {
      return NextResponse.json({ error: 'No metadata found' }, { status: 500 });
    }

    cache = { data: metadata, ts: Date.now() };
    return NextResponse.json(metadata);
  } catch (e) {
    console.error('Stock scores API error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
