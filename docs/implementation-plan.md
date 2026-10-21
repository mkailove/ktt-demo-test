# 快团团素材生成器 V1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 PRD 实现可直接打开、在浏览器本地编辑并导出单商品 PNG 海报的 V1.0 网页。

**Architecture:** 根目录 `index.html` 是唯一应用文件，包含 HTML、CSS 和一个内联 JavaScript 闭包。闭包中的纯函数负责字段校验、图片几何、排版和文件名；DOM 事件负责编辑、上传和下载。预览与导出共用同一个 720 × 1280 Canvas 绘制入口。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Canvas 2D、Node 内置 `node:test`；无包管理器、构建步骤和运行时外部依赖。

**Spec:** [prd-example.md](prd-example.md)；项目约束见 [AGENTS.md](../AGENTS.md)。

## Global Constraints

- 根目录仅一个应用文件 `index.html`，CSS 和 JavaScript 均内联；可用 `file://` 直接打开。
- 不使用 React、Vite、`package.json`、依赖锁文件、后端或网络上传。
- 海报固定 720 × 1280、白底；三模板及字段上限严格取自 PRD 第 3–5 节。
- 上传仅接受 JPG、PNG、WebP；每张不超过 10 MB、解码像素不超过 1600 万；二维码另需宽高至少 320 像素、宽高比 0.95–1.05。
- 本地验证运行 `node --test`，并在 Windows Chrome 与 Edge 打开 `index.html` 执行 PRD 第 6 节验收；发布另行确认。
- 按当前项目规则在现有 checkout 工作；每个实现任务验证后独立提交，提交前核对暂存文件。

## Review Focus

1. 文件后缀与实际内容不符：上传任务测试 MIME/解码失败保留旧图。
2. 快速连续选择图片：上传任务测试慢请求不得覆盖后发起的选择。
3. 组合长文本虽然各自未超字数：排版任务测试溢出字段阻止导出且不绘制遮挡内容。
4. 原价与团购价的小数精度和边界：输入任务测试整数分计算、0、超过两位小数和原价低于团购价。
5. 导出期间继续编辑或重复点击：导出任务测试快照固定、并行导出锁和失败后重试。

---

## File Map

| 文件 | 职责 |
| --- | --- |
| `.gitignore` | 忽略 `/work/`，不隐藏源码或测试。 |
| `index.html` | 唯一应用文件；DOM、样式、状态、Canvas 绘制与下载。内部用 `app.core` 收纳可测试的纯函数，`app.init()` 连接 DOM；仅在存在 `document` 时初始化页面。 |
| `README.md` | 本地打开、操作、浏览器验证与发布边界。 |
| `tests/support.mjs` | 从 `index.html` 提取 `id="app-script"` 的内联脚本，用 Node `vm` 取得 `app.core`；不依赖 DOM 包。 |
| `tests/input.test.mjs` | 默认状态、字段、卖点、价格与恢复逻辑。 |
| `tests/upload.test.mjs` | 图片格式/大小/尺寸校验和异步选择顺序。 |
| `tests/render.test.mjs` | 三模板区域、图片适配、二维码静区与文字溢出。 |
| `tests/export.test.mjs` | 导出校验、冻结快照、重复点击和文件名。 |
| `tests/acceptance.md` | PRD AC01–AC11 的 Chrome、Edge 手工验收记录。 |
| `work/` | 仅在验收时放临时商品图、测试二维码与导出 PNG；始终忽略。 |

### Task 1: 页面、默认状态与字段输入

**Files:** Create `.gitignore`, `README.md`, `index.html`, `tests/support.mjs`, `tests/input.test.mjs`.

**Interfaces:** `app.core.createDefaultState() -> State`；`app.core.countCodePoints(text) -> number`；`app.core.parseMoneyToCents(text) -> number|null`；`app.core.validateFields(state) -> Error[]`。`State` 包含 `template, tag, brand, title, subtitle, bullets, originalPrice, groupPrice, leaderNote, shipping, ctaMain, ctaSub, ratioMode, fitMode, image, qr`。`Error` 至少含 `field` 与 `message`。

- [ ] 写 `input.test.mjs`：默认值与 PRD 第 2 节逐项相同；Unicode 码点计数；卖点最多六条；标题必填；团长说 48 字；价格按整数分比较，`0`、三位小数、超过 `999999.99` 和原价低于团购价均返回字段错误。
- [ ] 运行 `node --test tests/input.test.mjs`，确认新测试因接口不存在而失败。
- [ ] 先创建忽略 `/work/` 的 `.gitignore`，再实现 `README.md`、页面字段与纯函数；默认预览先显示占位，恢复示例确认后重建默认状态，取消时不变；360px 宽度下不遮挡字段。
- [ ] 运行 `node --test`；用浏览器打开页面，检查默认字段、卖点操作、恢复确认和控制台。
- [ ] 核对暂存清单并提交 `feat: add poster editor inputs`。

### Task 2: 本地图片上传

**Files:** Modify `index.html`; create `tests/upload.test.mjs`.

**Interfaces:** `app.core.validateImageMeta(file, width, height, kind) -> Error[]`；`app.core.createImageSelectionController(decode) -> { select(kind, file): Promise<Result>, current(kind): Image|null }`。`decode(file)` 返回 `{ bitmap, width, height }`；`kind` 为 `image` 或 `qr`，`Result` 包含是否应用新图及错误。

- [ ] 写上传测试：有效 JPG/PNG/WebP；类型与实际解码不符、超过 10 MB、超过 1600 万像素、二维码小于 320 像素或非方形；失败和取消保留旧图；较慢的旧选择不得覆盖新选择。
- [ ] 运行 `node --test tests/upload.test.mjs`，确认失败来自缺失接口。
- [ ] 在 `index.html` 使用浏览器本地文件读取与图片解码；校验通过后替换，替换时释放旧图片资源；错误显示在对应上传字段。
- [ ] 运行 `node --test`；在浏览器上传有效/无效图、连续选择图并检查预览与控制台。
- [ ] 核对暂存清单并提交 `feat: validate local image uploads`。

### Task 3: 三模板与实时 Canvas 预览

**Files:** Modify `index.html`; create `tests/render.test.mjs`.

**Interfaces:** `app.core.computeImagePlacement(source, box, ratioMode, fitMode) -> Placement`；`app.core.buildPosterLayout(state, measureText) -> { elements, errors }`；`app.core.drawPoster(ctx, state, layout) -> void`。`buildPosterLayout` 使用 PRD 第 4 节的坐标、主题色与字号下限；绘制层只消费布局，不另算预览几何。

- [ ] 写排版测试：三模板的主图与卖点区域、自动比例边界 0.9/1.1、完整展示与居中裁切、二维码 176 × 176 加四边 24 像素静区、组合长文本出现具体字段溢出错误。
- [ ] 运行 `node --test tests/render.test.mjs`，确认失败来自缺失接口。
- [ ] 实现三模板 Canvas 布局、图片比例/适配、价格与文案绘制及错误提示；输入和模板切换触发同一绘制入口；缺图时绘制 PRD 占位。
- [ ] 运行 `node --test`；浏览器检查三模板、三种主图方向、六条卖点、长文案和 360px 页面滚动。
- [ ] 核对暂存清单并提交 `feat: render three poster templates`。

### Task 4: PNG 导出与异常恢复

**Files:** Modify `index.html`; create `tests/export.test.mjs`.

**Interfaces:** `app.core.validateForExport(state, layout) -> Error[]`；`app.core.makeExportFilename(state, date) -> string`；`app.core.createExportController(renderToCanvas, downloadCanvas) -> { export(state): Promise<Result> }`。控制器在第一次异步等待前同步复制字段并绘制到独立 Canvas；之后上传替换旧图也不会改变该 Canvas 的像素。下载完成或失败时释放导出锁。

- [ ] 写导出测试：缺主图/二维码、无效金额或布局溢出不能导出；文件名清理非法字符与末尾空格/句点；导出中修改编辑状态不改变快照；重复点击只启动一个任务；失败后可重试。
- [ ] 运行 `node --test tests/export.test.mjs`，确认失败来自缺失接口。
- [ ] 实现 720 × 1280 离屏 Canvas：点击后同步校验并绘制快照，再异步编码 PNG 和下载；导出与预览调用相同的 `buildPosterLayout` 和 `drawPoster`，失败时恢复按钮状态。
- [ ] 运行 `node --test`；在浏览器打开生成的 PNG，核对分辨率、白底、内容和文件名。
- [ ] 核对暂存清单并提交 `feat: export validated poster PNG`。

### Task 5: 本地验收与交付说明

**Files:** Modify `README.md`; create `tests/acceptance.md`；按发现的问题修改 `index.html` 与对应测试。

**Interfaces:** 不新增应用接口；验收结果逐项对应 PRD AC01–AC11。

- [ ] 在 `work/` 准备横、方、竖商品图及编码 `https://example.com/ktt-v1-qr` 的测试二维码；确认 `.gitignore` 生效。
- [ ] 在 Windows Chrome 与 Edge 直接打开 `index.html`，逐项执行 AC01–AC11，记录浏览器、结果和失败证据；用系统相机完成规定的三次扫码测试。
- [ ] 修复发现的应用问题，并为可自动化的回归补充相应 `.test.mjs`；重新运行 `node --test` 和受影响的浏览器用例。
- [ ] 更新 `README.md` 的操作、浏览器要求、验证命令和本地文件处理说明；检查所有文档链接、Git 状态与暂存文件，确认 `work/` 未提交。
- [ ] 提交 `docs: record local acceptance`；汇报本地结果。GitHub 上传和 Pages 发布按 `AGENTS.md` 另行提交目标与文件清单确认。
