# Garden 完善升级计划（v2 — 整合数据迁移收尾）

> 更新日期：2026-06-25
> 基于之前审查（H1–H4 / M5–M9 / L10–L14）+ 新发现的数据迁移半成品问题（NEW-H1/H2、NEW-M1/M2、NEW-L1/L2）整合而成。

> ⚠️ **重要约束**：本 VPS（95.169.9.99）同时运行 Xray/V2Ray 翻墙代理（:8443）和 garden 服务。**任何涉及 VPS 系统配置的改动（Nginx、firewalld、SELinux、Xray、网络端口）都必须在操作前确认不会破坏代理服务**。一旦代理挂了 → Devin 自己也没网了 → 所有远程工作和修复都会中断。

---

## 1. 已完成功能 + 迁移状态

### 1.1 功能完成度

| 模块 | 状态 | 说明 |
|------|------|------|
| 资源/笔记 CRUD | ✅ 完成 | 走 `/api/sync`，UUID IDs，跨设备同步 |
| 合集（collections） | ✅ 完成 | 编辑/删除确认、时间线互斥 |
| 文件上传（图片/文档） | ✅ 完成 | presigned URL 流程，50MB 限制 |
| 音乐系统 | ✅ 完成 | presign + 导入面板 + MiniPlayer |
| 跨设备同步 | ✅ 完成 | sync API + 启动时 cloud pull |
| 主题切换 | ✅ 完成 | next-themes |
| PWA 基础 | ⚠️ 部分 | manifest 有，离线写入未队列化 |
| 认证 | ⚠️ 半迁移 | 仍用 Supabase Auth，未迁 VPS |

### 1.2 迁移状态（Supabase → VPS）

| 组件 | 迁移状态 | 验证方式 |
|------|----------|----------|
| DB CRUD（sync route） | ✅ 代码 100% | `dbFetch`/`dbUpsert` dispatch，`vpsDbEnabled()` |
| 文件上传（files/music） | ✅ 代码 100% | `vpsStorageEnabled()` dispatch |
| 文件删除 | ✅ 代码 100% | 同上 |
| Storage presign | ✅ 代码 100% | 返回 VPS PUT URL |
| collection_resources 关联（代码） | ✅ 代码 100% | 走 `dbFetch` |
| **collection_resources 关联（数据）** | ❌ **VPS 上为空** | NEW-H2：junction 表 0 行 |
| **音乐 MP3 文件（数据）** | ❌ **未上传到 VPS** | NEW-H1：curl VPS 返回 404 |
| **playlist metadata URL（数据）** | ❌ **混搭 Supabase/VPS** | NEW-M1：硬编码在 metadata.tracks[].url |
| Debug 路由 | ❌ 代码 0% | NEW-M2：直用 `supabaseFetch` |
| 客户端 URL 兜底构造 | ⚠️ 部分 | `files/page.tsx`、`MiniPlayer.tsx` 用 `NEXT_PUBLIC_SUPABASE_URL` 兜底 |
| 认证 | ❌ 0% | 仍 100% Supabase Auth |
| 环境变量清理 | ❌ 0% | NEW-L1：旧 Supabase key 仍在 `.env.local` |

**结论：代码层迁移 ~75%，数据层迁移 ~50%（半成品）。**

---

## 2. 整合后的问题清单（重新分级）

> 标记说明：`[迁移]` = 迁移遗留，`[原有]` = 原审查发现，`[新增]` = 本次新发现

### 严重（高）— 阻塞正常使用

| ID | 类型 | 问题 | 影响 |
|----|------|------|------|
| **NEW-H1** | [迁移] | 音乐 MP3 文件未上传到 VPS 存储 | 3 首曲目播放 404 失败 |
| **NEW-H2** | [迁移] | `collection_resources` junction 表在 VPS 上为空 | 2 个合集的 11 个资源关联失效，合集显示为空 |
| **H2** | [原有] | 离线写入无队列，静默丢失 | 离线时数据丢失 |
| **H3** | [原有] | RLS 策略缺失 | 任何持有 key 者可读写全表 |
| **H4** | [原有] | 日志泄露 token（`console.log` 打印 authUser） | 凭据泄露风险 |

### 中（中）— 体验/可维护性受损

| ID | 类型 | 问题 | 影响 |
|----|------|------|------|
| **NEW-M1** | [迁移] | `__music_playlist__` metadata.tracks[].url 硬编码混搭 Supabase/VPS URL，非运行时解析 | 迁移后需手动更新；URL 应运行时由 `storagePath` 解析 |
| **NEW-M2** | [迁移] | `debug/route.ts` 直用 `supabaseFetch`，绕过 `vpsDbEnabled()` dispatch | 调试结果误导（永远打 Supabase） |
| **M-URL** | [迁移] | `files/page.tsx`、`MiniPlayer.tsx` 用 `NEXT_PUBLIC_SUPABASE_URL` 兜底构造 URL | VPS 模式下兜底 URL 错误 |
| **H1** | [原有] | 静态资源无 `Cache-Control` 头 | 性能 + 流量浪费 |
| **M5** | [原有] | 错误边界缺失，部分页面白屏 | 用户体验差 |
| **M6** | [原有] | 类型不完备，多处 `any` | 可维护性 |
| **M7** | [原有] | 图片未用 `next/image` | 性能 |
| **M8** | [原有] | PWA 不完整（离线写入未队列化，与 H2 重叠） | 离线体验 |
| **M9** | [原有] | 主题 CSS 污染 | 样式串扰 |

### 低（低）— 卫生/技术债

| ID | 类型 | 问题 | 影响 |
|----|------|------|------|
| **NEW-L1** | [迁移] | `.env.local` 中 `SUPABASE_SERVICE_KEY`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 仍存在 | 安全风险（迁移完成后应移除） |
| **NEW-L2** | [迁移] | VPS 存储 endpoint 根路径返回 403 | 非问题（dav_modules 不列目录），需确认配置正确 |
| **L10** | [原有] | 巨石组件 | 可维护性 |
| **L11** | [原有] | 幻数硬编码（如 `MUSIC_PLAYLIST_ID`） | 可维护性 |
| **L12** | [原有] | 死代码/文件（`scripts/` 下大量 test/diag 脚本） | 仓库卫生 |
| **L13** | [原有] | 无测试/CI | 质量保障缺失 |
| **L14** | [原有] | 依赖过时 | 安全/兼容 |

---

## 3. 实施计划（分阶段）

### 阶段 1：数据迁移收尾（优先，阻塞一切）

**目标**：让 VPS 上的数据真正可用——音乐能播、合集能显示资源、调试走对后端。

**性质**：纯迁移遗留，不涉及新功能。

#### 1.1 修复 `collection_resources` 关联（NEW-H2）

- **问题**：VPS 上 2 个合集 + 11 个资源存在，但 junction 表 0 行。资源里 `metadata.collectionId` 存了关联信息但未被回填到 junction 表。
- **改动**：
  - 新增一次性迁移脚本 `scripts/migrate-junction.mjs`：
    1. 从 VPS PostgREST 拉取所有 `resources`（含 `metadata.collectionId`）
    2. 拉取所有 `collections`
    3. 对每个有 `metadata.collectionId` 的资源，构造 `(collection_id, resource_id)` 行
    4. POST 到 `collection_resources`（upsert，去重）
  - **依赖**：需确认 VPS PostgREST 对 `collection_resources` 表支持 POST upsert（`Prefer: resolution=merge-duplicates`）
- **验证**：`curl https://storage.minitu.online/api/db/collection_resources?select=count` 返回 ≥11
- **工作量**：0.5 天
- **文件**：`scripts/migrate-junction.mjs`（新增）

#### 1.2 上传音乐 MP3 到 VPS 存储（NEW-H1）

- **问题**：5 首曲目 URL 指向 Supabase Storage，3 首指向 VPS 但 VPS 上 404。
- **改动**：
  - 新增迁移脚本 `scripts/migrate-music-files.mjs`：
    1. 从 VPS 拉 `__music_playlist__`（id=`254e932e-...`）的 `metadata.tracks`
    2. 对每首 track：
       - 若 URL 是 Supabase → 从 Supabase Storage 下载 MP3 → PUT 到 VPS 存储（`music/{trackId}.mp3`）
       - 若 URL 是 VPS 但 404 → 同样从 Supabase 兜底下载（若 Supabase 还在）或标记缺失
    3. 更新 `metadata.tracks[].url` 为 VPS URL，同时保存 `storagePath`
    4. PATCH/PUT 回 `__music_playlist__` 资源
  - **前置条件**：Supabase Storage 仍可访问（用于下载源文件）。若 Supabase 已停用，需用户提供 MP3 源文件。
- **验证**：每首 track 的 VPS URL `curl -I` 返回 200；MiniPlayer 实际播放成功
- **工作量**：1 天
- **文件**：`scripts/migrate-music-files.mjs`（新增）

#### 1.3 修复 playlist URL 运行时解析（NEW-M1 + M-URL）

- **问题**：`metadata.tracks[].url` 硬编码绝对 URL；`files/page.tsx`、`MiniPlayer.tsx` 用 `NEXT_PUBLIC_SUPABASE_URL` 兜底。
- **改动**：
  - `src/lib/supabase-admin.ts`：新增 `resolveStorageUrl(storagePath: string): string`，根据 `vpsStorageEnabled()` 返回 VPS 或 Supabase URL
  - `src/components/music/MiniPlayer.tsx`（L141）：`url` 优先用 `f.url`，否则 `resolveStorageUrl(f.storagePath)`
  - `src/app/files/page.tsx`（L204）：同上
  - `__music_playlist__` 的 `metadata.tracks[]` 改为只存 `storagePath`（运行时解析），`url` 字段保留作缓存但不再作为唯一来源
  - `src/app/api/sync/route.ts`：GET 返回 playlist 时，用 `resolveStorageUrl` 重写每首 track 的 `url`（保证客户端拿到的永远是当前后端的正确 URL）
- **验证**：切换 `VPS_STORAGE_URL` 开关，playlist URL 自动跟随
- **工作量**：0.5 天
- **文件**：`src/lib/supabase-admin.ts`、`src/components/music/MiniPlayer.tsx`、`src/app/files/page.tsx`、`src/app/api/sync/route.ts`

#### 1.4 修复 debug 路由（NEW-M2）

- **问题**：`src/app/api/debug/route.ts` 直用 `supabaseFetch`，绕过 dispatch。
- **改动**：
  - 将 `supabaseFetch` 调用替换为本地 `dbFetch`（复制 sync route 的 dispatch 模式，或从 `supabase-admin.ts` 导出一个公共 `dbFetch`）
  - 推荐：在 `supabase-admin.ts` 导出 `export async function dbFetch(...)` 和 `dbUpsert`，sync route 和 debug route 共用
  - info 输出增加 `vpsDbEnabled`、`vpsStorageEnabled`、`VPS_DB_URL` 标志，便于诊断
- **验证**：`curl /api/debug` 在 VPS 模式下返回 VPS 数据计数
- **工作量**：0.25 天
- **文件**：`src/lib/supabase-admin.ts`、`src/app/api/debug/route.ts`、`src/app/api/sync/route.ts`（改用导出版本）

#### 1.5 确认 VPS 存储配置（NEW-L2）

- **问题**：`https://storage.minitu.online/storage/` 返回 403。
- **改动**：
  - 确认 Nginx dav_modules 配置：根路径 403 是预期（不列目录），但具体文件路径应可访问
  - 验证 `PUT`/`DELETE`/`GET` 对具体路径的权限
  - 文档化预期行为到 `使用指南.md` 或本文件
- **验证**：`curl -I https://storage.minitu.online/storage/music/test.mp3` 返回 200（在 1.2 上传后）
- **工作量**：0.25 天
- **文件**：无代码改动，可能更新 `使用指南.md`

**阶段 1 合计**：~2.5 天
**阶段 1 依赖**：Supabase Storage 仍可访问（用于音乐源文件下载）；VPS PostgREST 支持 `collection_resources` upsert。

---

### 阶段 2：安全 + 可靠性（原有高优先项）

**目标**：堵住安全漏洞 + 防止数据丢失。可在阶段 1 后并行启动。

**性质**：原审查 H1–H4 + 与 H2 重叠的 M8。

#### 2.1 移除日志 token 泄露（H4）

- **改动**：全局搜索 `console.log` 打印 `authUser`/`token`/`key` 的位置，移除或脱敏
- **文件**：`src/app/api/sync/route.ts`、`src/app/api/debug/route.ts`、其他 API 路由
- **工作量**：0.25 天

#### 2.2 RLS 策略（H3）

- **问题**：VPS PostgREST 用 `x-storage-key` 鉴权，但无行级隔离。
- **改动**：
  - 若 VPS PostgREST 不支持 RLS → 在 Nginx/PostgREST 层加 `user_id` 过滤中间件
  - 或在应用层（`dbFetch`）强制所有查询带 `user_id=eq.${LOCAL_USER_ID}`
  - 评估：单用户场景下风险较低，但应至少限制 `collection_resources` 等关联表的越权
- **文件**：`src/lib/supabase-admin.ts`（`vpsDbFetch` 加默认 filter）、可能需 Nginx 配置
- **工作量**：1 天
- **依赖**：明确 VPS 是单用户还是多用户

#### 2.3 离线写入队列（H2 + M8）

- **改动**：
  - 客户端引入 IndexedDB 写入队列（zustand middleware 或独立模块）
  - 写入失败/离线时入队，恢复后重放 `/api/sync` POST
  - UI 显示"待同步 N 条"
- **文件**：新增 `src/lib/offline-queue.ts`、`src/components/shared/SyncStatus.tsx`；改 `MusicContext`、笔记/资源 context 的写入路径
- **工作量**：2 天

#### 2.4 静态资源缓存头（H1） — 涉及VPS配置

- **⚠️ 操作 VPS Nginx 配置前必须先确认 Xray 配置不受影响**。备份 `/etc/nginx/nginx.conf`，确认 firewalld 规则不变（:8443 不动）。
- **改动**：
  - VPS Nginx：对 `/storage/*` 静态文件加 `Cache-Control: public, max-age=31536000, immutable`（按 storagePath 内容哈希命名时）或 `max-age=86400`
  - Next.js 静态资源：`next.config.ts` 配置 `headers()`
- **文件**：`next.config.ts`、VPS Nginx 配置（需 SSH）
- **工作量**：0.5 天
- **依赖**：VPS SSH 访问权限

**阶段 2 合计**：~3.75 天

---

### 阶段 3：体验与可维护性（原有中低优先项）

**目标**：稳定性、性能、代码质量。可逐步推进。

#### 3.1 错误边界（M5）

- 新增 `src/app/error.tsx`、各路由段 `error.tsx`；API 路由统一错误响应格式
- 工作量：1 天

#### 3.2 类型完备（M6）

- 消灭 `any`：定义 `Resource`、`Collection`、`Track`、`FileMeta`、`Junction` 类型；`sync-schema.ts` 的 Zod 类型导出复用
- 工作量：1.5 天

#### 3.3 图片优化（M7）

- `next/image` 替换 `<img>`；VPS 存储需配置 `images.remotePatterns`
- 工作量：1 天

#### 3.4 主题 CSS 污染（M9）

- 审查全局 CSS，隔离主题变量作用域
- 工作量：0.5 天

#### 3.5 环境变量清理 + 文档（NEW-L1）

- 迁移确认完成后，从 `.env.local` 移除 `SUPABASE_SERVICE_KEY`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`（保留 `NEXT_PUBLIC_SUPABASE_URL` 供 Auth 用）
- 新增 `.env.example` 文档化所有变量
- **依赖**：阶段 1 完成 + Auth 迁移决策（见阶段 5）
- 工作量：0.25 天

#### 3.6 死代码清理（L12）

- `scripts/` 下 Supabase 时代的 test/diag 脚本归档或删除（保留 VPS 相关的）
- 工作量：0.25 天

#### 3.7 巨石组件拆分 + 幻数（L10、L11）

- `MUSIC_PLAYLIST_ID` 等常量集中到 `src/lib/constants.ts`
- 大组件按职责拆分
- 工作量：1.5 天

**阶段 3 合计**：~6 天

---

### 阶段 4：质量保障（原有低优先项）

**目标**：测试 + CI + 依赖更新。

#### 4.1 测试基础设施（L13）

- 引入 Vitest + React Testing Library
- 优先覆盖：`sync-schema.ts`、`supabase-admin.ts` 的 dispatch 逻辑、`offline-queue`
- 工作量：2 天

#### 4.2 CI（L13）

- GitHub Actions：`lint` + `typecheck` + `test` on PR
- 工作量：0.5 天

#### 4.3 依赖更新（L14）

- `npm audit fix`、升级过时依赖（注意 next 16 / react 19 兼容）
- 工作量：0.5 天

**阶段 4 合计**：~3 天

---

### 阶段 5：认证迁移决策（待定）

**目标**：决定 Auth 是否迁移到 VPS。

**当前状态**：Auth 100% Supabase，`@supabase/ssr` 深度集成。

**选项**：
- **A. 保留 Supabase Auth**（推荐，短期）：Supabase Auth 免费层够用，迁移成本高。`.env.local` 保留 `NEXT_PUBLIC_SUPABASE_URL` + anon key。
- **B. 迁移到 VPS 自建 Auth**：需实现 JWT 签发 + 用户表 + 密码哈希。工作量大（3–5 天），收益有限。

**建议**：选 A，阶段 3.5 清理时只删 `SERVICE_KEY`，保留 Auth 相关变量。

**工作量**：A=0 天，B=3–5 天

---

## 4. 优先级总览

| 阶段 | 内容 | 工作量 | 性质 | 依赖 |
|------|------|--------|------|------|
| **1** | 数据迁移收尾（NEW-H1/H2、NEW-M1/M2、M-URL、NEW-L2） | 2.5 天 | [迁移] | Supabase Storage 可访问 |
| **2** | 安全 + 可靠性（H1–H4、M8） | 3.75 天 | [原有] | 阶段 1 完成 |
| **3** | 体验 + 可维护性（M5–M7、M9、NEW-L1、L10–L12） | 6 天 | [混合] | 阶段 1 完成 |
| **4** | 质量保障（L13、L14） | 3 天 | [原有] | 无强依赖 |
| **5** | 认证迁移决策 | 0–5 天 | [迁移] | 阶段 3.5 |

**关键路径**：阶段 1 → 阶段 2 → 阶段 3.5（清理旧 key 需迁移确认）。

---

## 5. 迁移遗留 vs 原有改进项（明确区分）

### 迁移遗留问题（必须先解决，否则 VPS 数据不可用）
- NEW-H1 音乐文件未上传 VPS
- NEW-H2 junction 表为空
- NEW-M1 playlist URL 硬编码
- NEW-M2 debug 路由绕过 dispatch
- M-URL 客户端 URL 兜底构造
- NEW-L1 旧 Supabase key 残留（清理）
- NEW-L2 VPS 存储配置确认
- 阶段 5 认证迁移决策

### 原有改进项（与迁移无关，可独立推进）
- H1 缓存头
- H2 离线队列
- H3 RLS（部分与 VPS 鉴权相关）
- H4 日志泄露
- M5 错误边界
- M6 类型
- M7 图片优化
- M8 PWA（与 H2 重叠）
- M9 主题污染
- L10–L14 巨石/幻数/死代码/测试/依赖

---

## 6. 阶段 1 验收清单

- [x] `curl https://storage.minitu.online/api/db/collection_resources?select=count` = 2（实际只有 2 个 resource 带 `metadata.collectionId`；Supabase 端 junction 表本就为空，PLAN 原估 ≥11 是误判）
- [x] MiniPlayer 中所有曲目可播放（8/8 VPS URL HEAD 200，audio/mpeg）
- [x] 切换 `VPS_STORAGE_URL` 环境变量后，playlist URL 自动跟随（sync GET 用 `resolveStorageUrl` 按 `storagePath` 运行时重写）
- [x] `curl /api/debug` 在 VPS 模式下返回 VPS 数据计数（1.4 已改用 `dbFetch` dispatch + 输出 `vpsDbEnabled/vpsStorageEnabled/vpsDbUrl`）
- [x] `files` 页面文件 URL 在 VPS 模式下正确（`resolveStorageUrl` + sync GET files 映射新增 `url` 字段）
- [x] VPS 存储具体文件路径可 GET 200（根路径 403，符合预期；PUT 201、range 206 均正常）
- [ ] **⚠️ 新发现：VPS 存储 DELETE 返回 405**（Nginx `dav_methods` 未启用 DELETE）。当前 `vpsDelete` → 405 → files/music 删除路由在 VPS 模式下返回 500。需在阶段 2 处理：要么 SSH 改 Nginx 加 `dav_methods DELETE;`（涉及 VPS 配置，须先确认不影响 Xray :8443 代理），要么应用层用「PUT 空文件」兜底。
