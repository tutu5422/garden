import { NextRequest, NextResponse } from 'next/server';
import { getPass, isAuth } from '@/lib/auth';
import { dbConfigOk, dbUpsertOwned, resolveStorageUrl } from '@/lib/supabase-admin';

/**
 * 生成安全的文件名片段（只保留字母数字和连字符）
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/**
 * 使用 pdfjs-dist 提取 PDF 页数（纯 JS，不依赖 canvas 原生包）
 */
async function getPdfPageCount(pdfBuffer: ArrayBuffer): Promise<number | undefined> {
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const count = doc.numPages;
    doc.cleanup();
    return count;
  } catch (e: any) {
    console.warn('[upload] 获取 PDF 页数失败:', e?.message || e);
    return undefined;
  }
}

/**
 * POST /api/patterns/upload
 * 上传图解 PDF + 可选封面缩略图 + 元数据
 *
 * multipart/form-data:
 *   - file: PDF 文件（必填）
 *   - cover: 封面图片 JPEG/PNG（可选，前端用 pdfjs 渲染后生成）
 *   - title: 图解名称
 *   - brand: 品牌（可选）
 *   - yarn: 线材（可选）
 *   - difficulty: 难度（可选: beginner/easy/intermediate/advanced/expert）
 *   - patternType: 类型（可选，逗号分隔）
 *   - craftType: 编织方式 knit/crochet/both（可选，默认 knit）
 *   - categoryId: 目标分类 ID（可选）
 *   - hash: 文件 SHA-256 哈希（可选，用于去重）
 *
 * 封面缩略图策略：
 *   优先使用上传的 cover 图片（前端渲染方案），
 *   如果 cover 为空则跳过封面（用户后续可手动上传）。
 */
export async function POST(req: NextRequest) {
  if (!getPass()) return NextResponse.json({ error: '配置缺失' }, { status: 500 });
  if (!(await isAuth(req))) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!dbConfigOk()) return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const coverFile = form.get('cover') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传PDF文件' }, { status: 400 });
    }
    // 只接受 PDF
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: '仅支持 PDF 文件' }, { status: 400 });
    }

    const title = (form.get('title') as string)?.trim() || file.name.replace(/\.pdf$/i, '');
    const brand = (form.get('brand') as string)?.trim() || '';
    const yarn = (form.get('yarn') as string)?.trim() || '';
    const difficulty = (form.get('difficulty') as string)?.trim() || 'beginner';
    const patternTypeStr = (form.get('patternType') as string)?.trim() || '';
    const craftType = (form.get('craftType') as string)?.trim() || 'knit';
    const categoryId = (form.get('categoryId') as string)?.trim() || '';
    const hash = (form.get('hash') as string)?.trim() || '';
    // 批量导入时可传 skipPageCount=1 跳过服务端 pdfjs 页数计算以提速
    const skipPageCount = (form.get('skipPageCount') as string)?.trim() === '1';

    // 生成 VPS 存储路径
    const year = new Date().getFullYear();
    const brandSlug = slugify(brand) || 'unknown';
    const titleSlug = slugify(title).substring(0, 30);
    const ts = Date.now().toString(36);
    const dirName = `${brandSlug}-${titleSlug}-${ts}`;
    const storagePath = `patterns/${year}/${dirName}/pattern.pdf`;
    const thumbPath = `patterns/${year}/${dirName}/cover.jpg`;

    const vpsBase = (process.env.VPS_STORAGE_URL || '').replace(/\/+$/, '');
    if (!vpsBase) {
      return NextResponse.json({ error: 'VPS_STORAGE_URL 未配置' }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    // 上传 PDF 到 VPS
    const pdfUrl = `${vpsBase}/${storagePath}`;
    const pdfRes = await fetch(pdfUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
      },
      body: pdfBuffer,
    });

    if (!pdfRes.ok) {
      // 尝试创建目录（WebDAV 需要）
      const dirUrl = `${vpsBase}/patterns/${year}/${dirName}/`;
      await fetch(dirUrl, { method: 'MKCOL' }).catch(() => {});
      const retryRes = await fetch(pdfUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfBuffer,
      });
      if (!retryRes.ok) {
        return NextResponse.json(
          { error: 'PDF 上传到 VPS 失败', detail: `${retryRes.status}` },
          { status: 500 },
        );
      }
    }

    // 上传封面缩略图（前端已渲染好传过来的）
    let coverUrl = '';
    if (coverFile) {
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
      const coverVpsUrl = `${vpsBase}/${thumbPath}`;
      const coverRes = await fetch(coverVpsUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': coverFile.type || 'image/jpeg',
          'Content-Length': coverBuffer.length.toString(),
        },
        body: coverBuffer,
      });
      if (coverRes.ok) {
        coverUrl = resolveStorageUrl(thumbPath) || coverVpsUrl;
      }
    }

    // 获取 PDF 页数（纯 js，无原生依赖）；批量导入时可跳过以提速
    const pages = skipPageCount ? 0 : await getPdfPageCount(pdfBuffer.buffer);

    // 写入 resources 表
    const resourceId = crypto.randomUUID();
    const patternTypeArr = patternTypeStr
      ? patternTypeStr.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const resourceData = {
      id: resourceId,
      title,
      resource_type: 'other',
      status: 'active',
      url: resolveStorageUrl(storagePath) || pdfUrl,
      cover_image_url: coverUrl || undefined,
      category_id: categoryId || null,
      metadata: {
        is_pattern: true,
        patternBrand: brand,
        patternYarn: yarn,
        patternDifficulty: difficulty,
        patternType: patternTypeArr,
        patternCraftType: craftType,
        patternStatus: 'not-started',
        patternProgress: 0,
        patternPages: pages || 0,
        patternStoragePath: storagePath,
        patternThumbnailPath: coverUrl ? thumbPath : undefined,
        patternUsageCount: 0,
        patternLastUsedAt: new Date().toISOString(),
        patternHash: hash || undefined,
      },
      created_at: new Date().toISOString(),
    };

    const { ok, error } = await dbUpsertOwned('resources', resourceData);
    if (!ok) {
      return NextResponse.json({ error: '写入资源失败', detail: error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: resourceId });
  } catch (e: any) {
    console.error('图解上传错误:', e?.message || e);
    return NextResponse.json({ error: e.message || '上传失败' }, { status: 500 });
  }
}
