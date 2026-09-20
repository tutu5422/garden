// 把 pdfjs-dist 的浏览器运行时资源复制到 public/pdfjs/（npm install 后与构建前自动跑，见 package.json）
//
// 为什么自托管而不用 CDN：
//   1) PDF 阅读器属关键路径，不该依赖第三方 CDN（cdnjs/unpkg 国内不稳；旧版 pdf.js 有安全公告）
//   2) 旧实现里 pdf-viewer 用 cdnjs 的 3.11.174、ImportDialog 用 unpkg 的 `pdfjsLib.version`，
//      与 package.json 里的 pdfjs-dist 版本脱钩 —— worker 与 API 版本不一致是隐形炸弹
//   3) 按 pdfjs-dist 整目录复制，升级 npm 包后资源自动跟着变
//
// 生成物 public/pdfjs/ 不进 git（已 gitignore），由本脚本在安装后/构建前生成。
import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
if (!existsSync(src)) {
  console.warn('[sync-pdfjs] 未找到 node_modules/pdfjs-dist，跳过（先 npm install）')
  process.exit(0)
}

const out = join(root, 'public', 'pdfjs')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

let copies = 0
function copyDir(from, to, filter) {
  if (!existsSync(from)) return
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const f = join(from, entry.name)
    const t = join(to, entry.name)
    if (entry.isDirectory()) copyDir(f, t, filter)
    else if (!filter || filter(entry.name)) {
      copyFileSync(f, t)
      copies++
    }
  }
}

// build 只取压缩运行时 + worker（非压缩版与 .map 是给调试用的，别塞进 public）
copyDir(join(src, 'build'), join(out, 'build'), (n) => n === 'pdf.min.mjs' || n === 'pdf.worker.min.mjs')
copyDir(join(src, 'wasm'), join(out, 'wasm'))
copyDir(join(src, 'cmaps'), join(out, 'cmaps'))
copyDir(join(src, 'standard_fonts'), join(out, 'standard_fonts'))

const version = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')).version
console.log(`[sync-pdfjs] pdfjs-dist ${version} → public/pdfjs/（${copies} 个文件）`)
