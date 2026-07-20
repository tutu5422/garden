# 工作日志 — 迷你兔的秘密花园 (garden)

## 2026-07-19

### 项目接手与全面审计
- 完整审计项目代码、数据、环境变量
- 确认 debug 路由、音乐 URL 硬编码等 PLAN.md 中描述的问题已实际修复

### 环境清理
- `.env.local` 移除 15 个 Vercel 残留变量 + 2 个未用 Supabase 变量
- 更新 `.env.example` 同步结构

### collection_resources 迁移
- 创建 `scripts/migrate-junction.mjs`
- 回填 3 行缺失的 junction 数据（1→4 行）

### 笔记多图支持
- Note 类型新增 `images[]` / `imageThumbs[]`
- 编辑页：`<input multiple>`、网格预览、单张删除、9 张上限
- 详情页：网格 → lightbox 画廊（左右翻页 + 页码）
- 列表页：quick-add 多图、卡片取第一张
- 全部渲染页面接口兼容旧单图数据

### 音乐模块全面重构
- 重写 `src/app/music/page.tsx`（1000+→460 行）
- 桌面端：左侧边栏（当前播放 + 队列） + 右侧内容区
- 移动端：紧凑横条 + 内容区
- Tab 切换：全部/专辑/歌手/歌单/收藏
- 专辑网格 3→5 列，封面 object-cover 铺满
- 歌单修复：移除云端 merge 避免删除后复活
- 修复 renderPlaylists 内 useState 违规
- 修复 TrackActions 菜单闪烁（mousedown + 持久监听器）
- 新增全库「播放全部全部曲目」、收藏「播放全部」、歌单「播放全部」

### 播放队列规则
- `fullLibrary` 快照：挂载时保存完整曲库
- 全部视图使用 fullLibrary 展示
- 专辑/歌手/歌单「播放全部」→ playTracks 替换队列
- 侧栏显示队列状态 + 「返回全部」按钮

### 其他
- 修复封面留白（直接用 img 替代 AlbumArt 组件）
- 缩小专辑/歌单卡片（5 列 + 小圆角 + 薄边框 + 小字号）
- 多次部署到 minitu.online
