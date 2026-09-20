/**
 * 批量签发存储读 URL（客户端用）
 *
 * `/storage/` 读现在需要签名，浏览器自己算不出来（secret 只在服务端）。
 * 客户端拿到的是「本地缓存里的旧 URL」或「只有 storagePath」时，调这个接口换一批带签名的 URL。
 * 已有中间件鉴权（未登录 401），因此不会把签名发出去给外人。
 */
import { NextRequest, NextResponse } from 'next/server';
import { errMsg } from '@/lib/api-error';
import { signStorageReadUrl } from '@/lib/storage-sign';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const refs: unknown = body?.paths;
    if (!Array.isArray(refs) || refs.length === 0 || refs.length > 500) {
      return NextResponse.json({ error: 'paths 必须是 1-500 个元素的数组' }, { status: 400 });
    }
    const urls: Record<string, string> = {};
    for (const r of refs) {
      if (typeof r !== 'string' || !r) continue;
      urls[r] = signStorageReadUrl(r);
    }
    return NextResponse.json({ urls });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) || '签发失败' }, { status: 500 });
  }
}
