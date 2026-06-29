# 笔记保存失败——精确 Debug 任务

## 问题
编辑笔记后保存，内容不更新。可能是任何一种原因。

## 已知信息
- 代码在 https://minitu.online 生产环境
- Devin 上次改了 edit/page.tsx：添加了 toast 反馈和错误处理
- 改动已经部署
- 用户说"还是没保存上"——可能根本没看到 toast，或者看到成功 toast 但内容没变

## 必须要做

### 1. 检查 edit/page.tsx 的 save 函数
当前代码路径（编辑已有笔记）：
1. 从 localStorage 读 `minitu_notes`
2. `notes.find(n => n.id === noteId)` 找笔记
3. `notes.map()` 更新笔记内容
4. `localStorage.setItem('minitu_notes', JSON.stringify(updated))`
5. POST /api/sync 同步云端
6. `router.push('/notes')`

**关键问题排查**：
- `syncedNote` 对象到底包含什么字段？特别注意 `image`/`imageThumb` 在没选新图片时是 `undefined`
- JSON.stringify 会丢掉值为 undefined 的 key → `/api/sync` 收到的请求体没有 image/imageThumb → **sync-schema.ts 中 noteUpsertDataSchema 的 image/imageThumb 接受 `z.string().nullable().optional()`，接收 undefined 没问题是吧？**

### 2. 检查 /api/sync POST 处理
- sync/route.ts line 280-305: 处理 table='notes' upsert
- dbData.metadata 包含 content/image/imageThumb/tags/collectionId/collectionName/type
- 调用 dbUpsertOwned('resources', dbData)
- vps-db.ts 的 vpsDbUpsert: 有 id 先 GET 查是否已存在，存在则 PATCH

### 3. 看看 notes/page.tsx 的 loadNotes
- syncNotesFromCloud 做 GET /api/sync
- 可能云端返回了旧数据覆盖了 localStorage 的新数据？

### 4. 最可疑的地方——打印实际运行时的日志
**请在 edit/page.tsx 的 save 函数开头、localStorage 写后、router.push 前，各加一行 console.log，格式为：**
```
console.log('[DEBUG] save: starting, noteId=', noteId)
console.log('[DEBUG] save: existing note=', JSON.stringify(existing).substring(0,200))
console.log('[DEBUG] save: syncedNote=', JSON.stringify(syncedNote).substring(0,300))
console.log('[DEBUG] save: localStorage written, length=', updated.length)
```

**然后在 notes/page.tsx 的 loadNotes 也加日志：**
```
console.log('[DEBUG] loadNotes: local count=', local.length)
console.log('[DEBUG] loadNotes: cloud count=', cloud.length)
console.log('[DEBUG] loadNotes: merged count=', mergedList.length)
```

## 要求
1. 读当前版源码（包含之前 Devin 的改动）
2. 找出为什么用户保存后内容不更新
3. 修复根因
4. **不要删除之前的 toast 改动**，保留用户反馈
5. 只改 notes 相关文件
