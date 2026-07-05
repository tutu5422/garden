import { NextRequest, NextResponse } from 'next/server';
import { vpsDbFetch } from '@/lib/vps-db';

const STOCK_DAILY_ID = 'b19cd519-787a-56b3-a674-424c0484534c';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  try {
    const res = await vpsDbFetch(
      `resources?id=eq.${STOCK_DAILY_ID}&select=metadata`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok || !Array.isArray(res.body) || !res.body[0]) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    const metadata = (res.body[0] as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    const latest = (metadata?.latest || {}) as Record<string, Record<string, unknown>>;
    
    // Return just the latest day for the requested stock
    const stockData = latest[code];
    if (!stockData) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    return NextResponse.json(stockData);
  } catch (e) {
    console.error('Kline API error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
