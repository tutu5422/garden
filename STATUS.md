# Garden 项目状态

> 最后更新: 2026-07-09

## 总体状态：🟢 正常

三个子系统均可运行，生产环境（Vercel+VPS）在线。

---

## 1. A股扫描子系统

| 维度 | 状态 |
|------|------|
| **数据管道** | ✅ 正常 (run.py 一条命令) |
| **800只覆盖率** | ✅ 100% |
| **前端页面** | ✅ minitu.online/stock-scanner 在线 |
| **Cron** | ⏸️ **暂停中** — 模型切换导致 job 被跳过，需显式 pin 模型后恢复 |
| **DB状态** | ⚠️ 本地 cache 仍为旧格式（kline_full.json 单体 vs 新分文件） |

### 已知问题
- **P0**: `phase1_pipeline.py` 空结果重试是死代码（break 在 if 分支内）——但已不推荐使用，新管道 run.py 无此问题
- **P0**: 评分循环的 hfq_degraded fallback 会静默用后复权价参与评分，无 adj 字段标注
- **P0**: backtest/audit/backfill 三个脚本字段名损坏，完全不可用
- **P0**: 证监会行业分类 vs 前端申万风格名称不匹配（"银行"筛不出"J66货币金融服务"）
- **P1**: scoring.py 的 `build_score_meta()` 缺少 signals 字段
- **P1**: `daily.metadata.date` 语义歧义（存的是管道运行日期而非 K线实际日期）
- **待批准**: qfq 统一重构方案（见 `.hermes/plans/stock-scanner-reorg-plan.md`）

---

## 2. 音乐播放器子系统

| 维度 | 状态 |
|------|------|
| **曲库在线** | ✅ 正常 (154首) |
| **播放功能** | ✅ 正常 |
| **歌单管理** | ✅ 正常 |
| **歌词同步** | ✅ 正常 (148/154首有 LRC) |
| **封面图** | ⚠️ 部分缺失 (86/110专辑有封面，78%) |

### 已知问题
- Playlist 双角色陷阱已修复（playTracks 不持久化）
- TrackRow 组件内定义问题已修复（提取到模块级）
- 缺失封面 24 个（偏门专辑/稀有中国歌手），显示渐变色占位

---

## 3. 数字花园（资源/笔记/合集）

| 功能 | 状态 |
|------|------|
| 浏览首页 | ✅ 正常 |
| 笔记/博客 | ✅ 正常 |
| 资源库 CRUD | ✅ 正常 |
| 合集管理 | ✅ 正常 |
| 时间线 | ✅ 正常 |
| 文件管理 | ✅ 正常 |
| 搜索 | ✅ 正常 |
| 暗色模式 | ✅ 正常 |
| 密码保护 | ✅ 正常 |
| 登录注册 | ⏳ **待配置**（需先配 Supabase） |

### 已知问题
- VPS Nginx Storage DELETE 405（需 `dav_methods PUT DELETE`，当前仅 PUT）
- Cache-Control 头未配置（建议改 nginx.conf 加长缓存）

---

## 基础设施

| 组件 | 状态 |
|------|------|
| Vercel 部署 | ✅ 正常 (auto-deploy from GitHub) |
| VPS 服务器 | ✅ 正常 (95.169.9.99) |
| PostgREST | ✅ 正常 (localhost:3000) |
| Nginx 代理 | ✅ 正常 |
| VPS 磁盘 | ⚠️ 音乐文件去重后仍有 504 个孤立文件占用 ~2.3GB（待清理） |
| 本地 build | ⚠️ Windows 中文路径下 Turbopack CSS bug（不影响 Vercel 生产） |

---

## 待办事项（按优先级）

1. **P0**: pin cron job 模型，恢复 A股每日自动扫描
2. **P0**: 执行 qfq 统一重构（评分循环也存 qfq）
3. **P0**: 清理 VPS 孤立音乐文件（504 个 ~2.3GB）
4. **P1**: 修复 VPS Nginx DELETE 405 + 加 Cache-Control
5. **P1**: 补全剩余 24 个专辑封面
6. **P2**: 重写 backtest/audit/backfill 脚本
