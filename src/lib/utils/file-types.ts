/**
 * 文件类型校验工具：扩展名 + MIME 双重校验
 * 防止仅靠扩展名伪造文件类型。
 */

// 扩展名 → 允许的 MIME 集合（小写）
const EXT_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  mp3: ['audio/mpeg', 'audio/mp3', 'audio/mpeg3'],
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav'],
  flac: ['audio/flac', 'audio/x-flac'],
  ogg: ['audio/ogg', 'application/ogg'],
  m4a: ['audio/m4a', 'audio/x-m4a', 'audio/mp4'],
  aac: ['audio/aac', 'audio/x-aac'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
}

export interface ValidateTypeResult {
  ok: boolean
  reason?: string
}

/**
 * 校验文件扩展名与 MIME 是否匹配。
 * @param fileName 文件名（用于提取扩展名）
 * @param mimeType 浏览器报告的 MIME 类型
 * @param allowedExts 允许的扩展名白名单（小写，不含点）。若未提供则允许 EXT_MIME_MAP 中所有类型。
 */
export function validateFileType(
  fileName: string,
  mimeType: string | undefined,
  allowedExts?: string[],
): ValidateTypeResult {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (!ext) return { ok: false, reason: '缺少文件扩展名' }

  if (allowedExts && !allowedExts.includes(ext)) {
    return { ok: false, reason: `不支持的文件类型: .${ext}` }
  }

  const allowedMimes = EXT_MIME_MAP[ext]
  if (!allowedMimes) {
    // 未知扩展名：若提供了白名单则拒绝，否则放行（向后兼容）
    if (allowedExts) return { ok: false, reason: `不支持的文件类型: .${ext}` }
    return { ok: true }
  }

  // 已知类型：若浏览器提供了 MIME，则必须匹配
  if (mimeType) {
    const mime = mimeType.toLowerCase()
    // 允许 octet-stream 透传（部分浏览器对部分类型不识别）
    if (mime !== 'application/octet-stream' && !allowedMimes.includes(mime)) {
      return { ok: false, reason: `文件 MIME 类型 (${mime}) 与扩展名 (.${ext}) 不匹配` }
    }
  }

  return { ok: true }
}
