# 迷你兔的秘密花园 (garden) — 工作文档

> **用途**：保存业务需求、实现方案、问题记录、进展、工作日志。
> **规则**：每次开始工作前先读此文档，完成后更新此文档。

---

## 一、业务需求

个人数字花园网站，主人可记录笔记、管理资源、收藏音乐和编织图解。

### 核心模块

| 模块 | 说明 | 状态 |
|------|------|:----:|
| **笔记** | Markdown 笔记 + 多图片上传 | ✅ 稳定 |
| **资源库** | 链接/图片/书籍/工具 CRUD | ✅ 稳定 |
| **合集** | 资源归类管理 | ✅ 稳定 |
| **音乐播放器** | 154 首曲目，专辑/歌手/歌单管理，播放队列 | 🟡 已重构 |
| **织集** | 编织图解收藏 | ✅ 稳定 |
| **A股扫描** | 股票评分 + K线 | ⏸️ 暂停 |
| **文件管理** | 文件上传/删除 | ✅ 稳定 |

### 域名与部署

- 前端：https://minitu.online (Vercel)
- 存储：https://storage.minitu.online/storage (Nginx WebDAV @ VPS)
- 数据库：https://storage.minitu.online/api/db (PostgREST @ VPS)
- 密码：HMAC-SHA256 token，30 天有效

---

## 二、实现方案

### 技术架构

```
Next.js 16.2 + React 19 + TypeScript 5 + Tailwind 4 + Ant Design 6
  ↓ 部署 Vercel
页面路由 → 密码验证 → 服务端 API → VPS PostgREST / Nginx WebDAV
  ↓
MusicContext (React Context + 全局 Audio 单例)
```

### 音乐模块（已重构）

**页面结构**：
```
MusicPage
├── 左侧边栏 (桌面端) — 当前播放 + 队列
│   ├── 封面转盘 (144x144, 播放时旋转)
│   ├── 曲名 · 歌手 · 专辑
│   ├── 进度条 + 播放控件 (🔁 ⏮ ▶ ⏭ ❤)
│   └── 播放队列 (带「返回全部」按钮)
├── 顶部固定栏 — 统计 + Tab 切换 + 搜索 + 排序 + 上传
└── 内容区 — 全部/专辑/歌手/歌单/收藏
```

**队列规则**：
- 挂载时快照完整曲库到 `fullLibrary`
- 全部视图使用 `fullLibrary` 展示（不受队列影响）
- 专辑/歌手/歌单「播放全部」→ `playTracks()` 替换队列
- 全部页「播放全部全部曲目」→ `playTracks(fullLibrary)` 恢复队列
- 侧栏队列 < 全库时显示「返回全部」按钮

### 目录结构

```
C:\Projects\garden\
├── src/
│   ├── app/              # 页面 + API 路由
│   │   ├── music/        # 音乐页面 (已重构)
│   │   ├── notes/        # 笔记 CRUD (多图支持)
│   │   ├── api/          # sync, stock, files 等
│   │   └── ...
│   ├── components/       # UI 组件
│   │   ├── music/        # MiniPlayer, HomeMusicPlayer
│   │   └── ...
│   ├── lib/              # 核心库
│   │   ├── music/        # MusicContext, music-store, lyrics-store
│   │   ├── db/           # 本地存储
│   │   └── ...
│   └── ...
├── scripts/
│   ├── stock-scanner/    # A股数据管道
│   └── migrate-junction.mjs  # collection_resources 迁移
├── .env.local            # 环境变量（已清理）
├── .env.example          # 环境变量模板
├── garden-工作文档.md     # ← 当前文件
└── WORKLOG.md            # 工作日志
```

### 部署流程

```bash
cd C:\Projects\garden
npm run build          # 本地构建验证
vercel --prod --yes    # 部署到 minitu.online
```

---

## 三、问题记录

### 2026-07-19 笔记多图支持
- **现象**：笔记只能上传一张图片
- **原因**：Note 类型只有 `image`/`imageThumb` 单字段，`<input>` 无 `multiple`
- **解决**：新增 `images[]`/`imageThumbs[]`，压缩函数批量处理，详情页画廊 + lightbox，列表页取第一张
- **避免**：至少保持 `image`/`imageThumb` 向下兼容

### 2026-07-19 音乐模块重构
- **现象**：播放逻辑混乱，菜单闪烁，上传入口隐藏，专辑/歌手播放全部不符预期
- **原因**：旧 `music/page.tsx` 1000 行巨石组件，多处 useState 违反 Hooks 规则
- **解决**：重写 460 行，侧边栏 + 内容区 + Tab 切换架构
- **避免**：条件渲染函数里不用 `useState`

### 2026-07-19 playTracks 导致其他音乐消失
- **现象**：播放指定歌手后回到全部页只剩该歌手曲目
- **原因**：`allTracks = ctx.playlist`，`playTracks` 替换队列后展示源也变了
- **解决**：新增 `fullLibrary` 快照，全部视图始终用 `fullLibrary`
- **避免**：展示源和播放队列必须分离

### 2026-07-19 歌单删除后复活
- **现象**：删掉的歌单页面刷新后重新出现
- **原因**：`useEffect` 从云端 merge 回已删除数据，云端同步 POST 路径不通
- **解决**：移除云 merge 逻辑，歌单完全使用 localStorage
- **避免**：云同步只写出不读入 merge

### 2026-07-19 useState 在 render 函数中
- **现象**：`renderPlaylists()` 内 `const [editing, setEditing] = useState(...)` 违反 Hooks 规则
- **原因**：条件调用 useState
- **解决**：迁到组件层 `plEditId`/`plEditName`
- **避免**：render 函数只返回 JSX，不声明 hooks

### 2026-07-19 封面留白
- **现象**：专辑卡片和侧栏封面四周有空白
- **原因**：`AlbumArt` 组件固定尺寸 (`size-20 sm:size-28`) 小于父容器
- **解决**：直接 `img w-full h-full object-cover`，无图时内联渐变铺满

---

## 四、进展记录

| 日期 | 里程碑 | 状态 |
|------|--------|:----:|
| 2026-07-19 | 接手项目，完整审计 | ✅ |
| 2026-07-19 | 清理 .env.local (移除 17 个残留变量) | ✅ |
| 2026-07-19 | collection_resources 迁移 (1→4 行) | ✅ |
| 2026-07-19 | 笔记多图支持 (最多 9 张 + 画廊) | ✅ |
| 2026-07-19 | 音乐模块重构 (新页面 + 播放队列规则) | ✅ |
| 2026-07-19 | TrackActions 菜单闪烁修复 | ✅ |
| 2026-07-19 | 歌单修复 + 播放全部按钮 | ✅ |
| 2026-07-19 | 专辑/歌单卡片缩小 + 封面铺满 | ✅ |

---

## 五、工作日志

### 2026-07-19

- 全面审计项目：代码、数据、环境变量
- 清理 .env.local：移除 Vercel 残留 15 个 + Supabase 未用 2 个变量
- 创建并运行 `scripts/migrate-junction.mjs`：回填 collection_resources 表 (1→4 行)
- 笔记多图支持：edit 页多图上传，detail 页画廊 + lightbox，列表页兼容旧数据
- 音乐模块全面重构：`music/page.tsx` 从 1000→460 行，侧边栏 + 内容区 + 5 Tab 视图
- 修复 TrackActions 菜单闪烁（mousedown + 持久监听器）
- 修复全库/队列分离（fullLibrary 快照）
- 修复歌单删除复活（移除云 merge）
- 修复 useState 违规（render 函数内 hooks）
- 新增歌单/收藏「播放全部」按钮
- 缩小专辑/歌单卡片，封面铺满不留白
- 封面转盘铺满侧栏
- 多次迭代部署 `minitu.online`

**下一步**：
- A股扫描模块恢复（暂停中）
- 修复 VPS Nginx DELETE 405
- 清理孤立音乐文件 (~2.3GB)
- 补全缺失专辑封面 (24个)
