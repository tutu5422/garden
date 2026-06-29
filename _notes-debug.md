# 笔记编辑保存失败 Debug 任务

## 问题描述
在 https://minitu.online/notes 编辑笔记后，点击保存按钮，笔记保存失败（可能页面无响应或报错）。

## 项目概述
- Next.js 16 + React 19 + TypeScript 5
- 数据存储：localStorage + VPS PostgREST 云端同步
- API 路由：`/api/sync` 是核心数据同步端点
- 部署在 Vercel

## 笔记保存链路（请逐行检查）

### 1. 编辑页：src/app/notes/edit/page.tsx
保存函数 `save()` 在 line 104-201：
- 从 localStorage 读取笔记列表
- 修改目标笔记数据
- 写回 localStorage
- POST 到 `/api/sync` 做云端同步 `{ table: 'notes', action: 'upsert', data: syncedNote }`
- 然后 `router.push('/notes')` 跳转

### 2. API 端点：src/app/api/sync/route.ts
POST handler 在 line 207-438：
- 先用 `syncPostSchema` 做 zod 校验 (line 220)
- `table === 'notes'` 逻辑在 line 280-305
- 构造 dbData 后调用 `dbUpsertOwned('resources', dbData)` 写 VPS PostgREST

### 3. 数据库层：src/lib/vps-db.ts
- `dbUpsertOwned()` → `dbUpsert()` → `vpsDbUpsert()` 
- `vpsDbUpsert()` 逻辑 (line 66-92)：
  - 有 id 时先 GET 查是否存在
  - 存在则 PATCH（去掉 id 字段）
  - 不存在则 POST

### 4. 数据 schema 校验：src/lib/sync-schema.ts
- `noteUpsertDataSchema` (line 48-59) 定义了 notes 的 upsert 数据格式

### 5. 笔记列表页：src/app/notes/page.tsx
- `syncNotesFromCloud()` (line 33-57) 通过 GET /api/sync 拉取云端笔记
- 初始加载 merge 本地+云端 (line 125-190)

### 6. 笔记详情页：src/app/notes/[id]/page.tsx
- 编辑按钮跳转到 `router.push(/notes/edit?id=${note.id})`

## 可能的问题点（请逐一排查）

1. **云同步失败导致保存感觉"失败"**：本地 localStorage 保存可能成功，但 `/api/sync` 返回 400/500，用户只看跳转后的列表页没看到刚编辑的内容就认为失败了。

2. **zod 校验不通过**：检查 edit/page.tsx 发送的 `syncedNote` 对象是否完全符合 `noteUpsertDataSchema`。特别注意：
   - `tags` 可能不是数组（用户输入逗号分隔字符串，代码 `form.tags.split(',').map(t => t.trim()).filter(Boolean)` 确保是数组）
   - `createdAt` 是否可能是 undefined（旧笔记没有这个字段？）
   - `id` 是否为空

3. **PostgREST PATCH 失败**：`vpsDbUpsert` 中 PATCH 请求的 body 包含了 `updated_at` 字段，可能 PostgREST PATCH 时某些字段类型不匹配。

4. **auth 检查**：`/api/sync` POST 先做 `isAuth(req)` 检查，如果 cookie/session 过期会返回 401 未登录，保存被静默忽略（edit/page.tsx line 167-169 只 console.warn 不提示用户）。

5. **edit/page.tsx line 171 的 catch 块**：整个 try 块被空 catch 包围（line 201: `} catch {}`），任何异常都被吞掉，用户看不到错误提示。

## 要求
1. 先读相关文件，理解完整保存链路
2. 重点检查：edit/page.tsx 的 save 函数、api/sync/route.ts 的 notes upsert 逻辑
3. 修复 find 的问题后，确保：
   - 保存成功时用户看到确认反馈
   - 保存失败时用户看到错误提示
   - localStorage 和云端同步都正确
4. 不改动与其 notes 无关的代码
5. 改完直接告诉我改了什么，不要做调研
