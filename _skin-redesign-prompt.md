# 迷你兔 · 皮肤大胆重设计任务

## 项目信息
- 项目路径：`D:\项目\garden`
- Next.js 16 + React 19 + Tailwind CSS 4 + Ant Design 6

## 当前架构已扩展完成

我已将 `src/lib/theme/skins.ts` 的 `ThemeDefinition` 扩展，新增了 `style: ThemeStyle` 字段。每个皮肤现在能独立控制：

| 属性 | CSS 变量 | 影响 |
|------|----------|------|
| 圆角 sm/md/lg/xl | `--skin-radius-*` | 卡片、按钮、标签的圆角 |
| 字体 display/body | `--font-display`, `--font-body` | 全站标题和正文字体 |
| 卡片背景/边框色/边框宽 | `--skin-card-bg/border/border-width` | .card 和 .card-bento 的外观 |
| 卡片阴影 / 悬停阴影 | `--skin-card-shadow/hover-shadow` | 卡片的立体感 |
| 悬停变换 / 悬停边框变色 | `--skin-card-hover`, `--skin-card-hover-border` | hover 动效 |
| 毛玻璃背景/模糊/边框 | `--skin-glass-bg/blur/border` | 玻璃效果 |
| 按钮圆角/阴影 | `--skin-btn-radius/shadow` | 按钮风格 |
| 标签圆角 | `--skin-tag-radius` | 标签风格 |
| 章节间距 | `--skin-section-gap` | 页面呼吸感 |

CSS 类已全部改为引用这些变量（`.card`, `.card-bento`, `.btn`, `.tag`, `.section-gap-*`），globals.css 不需要再改。

## 你的任务

请你自己去以下网站找灵感：
- https://www.awwwards.com/ （最新获奖设计）
- https://recent.design/ （设计趋势）
- https://21st.dev/ （社区组件，搜索 backgrounds, cards, heroes）
- https://reactbits.dev/ （动效组件）

然后对以下 **3 个皮肤**进行大胆的全面重设计（保留「编辑狂想」不变）。

### 要求
1. **不局限于配色** — 每个皮肤要有独特的"质感"和"性格"
2. **排版大胆** — 标题字体和正文字体可以完全不同
3. **交互有辨识度** — 卡片 hover、按钮风格、圆角体系各具特色
4. **适合"个人数字花园"** — 虽然有创意但不能过于花哨影响阅读

### 风格方向

#### 🌿 森系纸墨
目标：手写笔记本 / 刺子绣 / 植物标本的质感
- 圆角：偏大且圆润
- 字体：标题用衬线/手写感字体，正文用温暖无衬线
- 卡片：有「纸」的质感（不反光、暖米色底），边框用淡墨
- 悬停：轻微抬升，边框晕染变深
- 标签：圆角药丸，像手写标签
- 间距：宽松，像笔记本的留白
- 可选：dashed 虚线边框、纸纹理背景

#### 🌅 暖阳陶土
目标：地中海阳光 / 陶土砖 / 夏日庭院
- 圆角：超大圆润（按钮近乎胶囊）
- 字体：标题用浑厚衬线体，正文用清爽无衬线
- 卡片：暖橙色底或奶油底，带暖色投影
- 悬停：抬升 + 暖光 glow
- 标签：圆润药丸，暖色填充
- 间距：舒适偏宽
- 可选：sunburst 渐变背景

#### 🌙 午夜蓝金
目标：夜空 / 奢华酒店 / 毛玻璃
- 圆角：偏小，精致
- 字体：全部用干净无衬线，强调锐利感
- 卡片：**毛玻璃（glassmorphism）** — 半透明背景 + backdrop-blur + 亮细边框
- 悬停：玻璃感加强，金色边框 glow
- 标签：小圆角，细边框
- 间距：紧凑精致
- 可选：golden glow 点缀，微妙的网格背景阴影
- **注意**：毛玻璃卡片的 `background`、`backdrop-filter`、`border` 需要特殊实现，你可以使用 `glassBg`、`glassBlur`、`glassBorder` 变量，或者直接在 globals.css 添加 `.card-glass` 类

### 实施步骤

1. 先用 webfetch 或 web_search 去上述网站调研，收集灵感
2. 返回一份设计方案（每个皮肤 2-3 句话的设计说明 + 关键参数）
3. 等我确认方案后，编辑 `src/lib/theme/skins.ts` 中对应皮肤的 `style` 字段

### 限制条件

- 不改动 `EDITORIAL_RAVE`（编辑狂想）
- 不改动 `globals.css`（CSS类已全部变量化）
- 不改动任何业务逻辑
- 不改动 `SkinProvider.tsx`、`SkinSelector.tsx`、`settings/page.tsx`
- 只修改 `skins.ts` 中三个新皮肤的 `style` 字段（配色 + 样式参数）
- 如果要加新的 CSS 类（如 `.card-glass`），确保不影响现有皮肤
