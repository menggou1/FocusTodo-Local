# D-V-Workspace W1：添加任务输入区

2026-11-11，worktree `refactor/standalone-app`。旧版权威为 Git Tag 1.9.3，隔离服务 5513；新版为 Vite HMR 5511。Chromium 1280×900、DPR 1、zh-CN light、正常 motion、独立浏览器上下文、空合成数据。未访问或操作 5500，未推送、合并或发布，未进入 W2。

## 旧版源码与运行时依据

- 旧版 CSS：`src/main.css` 9527–9696（`TaskNewItem-*`）。输入行是 `table-layout: fixed` 的表格：`padding: 0 8px`，列宽 32 / 剩余 / 120 / 8 / 32；加号为 `img/tsk-new.png` 25×24 背景图；番茄图标 20×20、`background-size: 20px 20px`，选中态改用 `img/detail-pomo-estimation.png`；触发箭头是 14×20 的 `img/tsk-pomo-selection-trigger.png`；分隔线为 8px 列内 1×16、左移 2px、颜色 `var(--border-input)`（实测 `rgb(229,229,229)`）；清单图标 24×24，居中于 32px 列。
- 旧版逻辑：`src/js/main.js` 的 `TaskNewItem` 渲染函数。`estimatePomoNum <= 5` 时渲染 5 个可点击 span（`n < estimate` 时 inline `background-image: detail-pomo-estimation.png`），点击第 n 格设为 n+1、再点同格退回 n；`> 5` 时改为单枚估计图标 + 数字。触发箭头打开 `PomodoroSelection`（130×34、圆角 8、`0 0 20px 1px rgba(197,197,197,.5)`、Helvetica 14/20、数字输入宽 9 起按内容测量）；±1、输入量 0–1000、滚轮 `ceil(deltaY/5)` 限 ±5、Enter 关闭并把焦点还给任务输入框。
- 旧版运行时实测（Playwright MCP）：行根 296/232、717.6×48；各列 32/508/120/8/32；番茄图标 x=844.8/864.8/884.8/904.8/924.8、y=246、20×20；箭头 944.8/14×20；分隔线 x=966.8、1×16；清单图标 976.8、24×24。

## 差异修复

1. 番茄图标尺寸、颜色、字体：新版原为 16×16 `<img>`，选中态用 `filter: sepia(1) saturate(5) hue-rotate(305deg)` 伪造粉色，实际渲染为橙色。改为 20×20 CSS 背景图，选中直接使用旧版 `detail-pomo-estimation.png`，移除 filter；深色空心图沿用 `detail-pomo-blank-dark.png`。触发箭头由文本 `›`（14px、带 7px 内边距）改为旧版 14×20 图片。
2. 选择任务清单按钮偏右：原 `details` 与 `summary` 同时带 `padding-left: 10px` 和 `border-left`，把 24×24 图标推到 x=987.6（旧版 976.8）。移除双重内边距/边框，改 32px 列居中，图标回到 976.8。
3. 更多菜单：确认新版点击 `›` 无任何响应（无弹层、无 aria-expanded）。按旧版恢复：14×20 触发图 → 130×34 番茄数选择器（−、16px 估计图标、可编辑数字、+）；支持 0–1000 限值、滚轮 ±5、Enter/外部点击/Escape 关闭、关闭后焦点回到任务输入框；数量 >5 时切换为单图标+数字。
4. 间距与额外元素：原触发图到清单图标 29.6px（旧版 18px），并存在 `details`、`summary` 两条重叠竖线与两层 10px 内边距。现为 8px 分隔列（1×16 单线，x=966.8）+ 10px 间距，右侧簇与表格几何逐项对齐；整行内边距由 12px 改为旧版 8px，`gap: 8px` 改为 0，加号改回 25×24 背景图。

## 实测证据（Playwright MCP）

工具：`browser_navigate`、`browser_tabs`、`browser_evaluate`、`browser_click`、`browser_type`、`browser_press_key`、`browser_take_screenshot`、`browser_run_code_unsafe`（真实 `page.mouse.wheel`）。

- 旧版 5513：读取 `TaskNewItem` 整行 DOM/计算样式/几何；真实点击触发图、输入 7、Enter、点顶部空白；采样 0/2/7 三态与弹层位置。
- 新版 5511：同一状态测量。修复后行内几何与旧版一致：加号 304.8、输入框 336.8/508、番茄区 844.8/120、分隔 964.8/8、清单列 972.8/32、图标 976.8/24；图标 20×20、触发图 14×20 均与旧版同坐标。
- 弹层实测：rect 886.8/276、130×34，圆角 8、阴影 `rgba(197,197,197,.5) 0 0 20px 1px`、Helvetica 14/20；−/图标/输入/加号 x=892.6/937.8/956.8/987，与旧版相同；打开时输入框获得焦点。
- 交互：真实点击 `+`×2 → 2；点击图标 2 → 前两格为估计图；输入 7 → 单图标+数字；滚轮 −100/+30 → 0→5→0，内容区 scrollTop 保持 0；Enter 关闭且焦点回到任务输入框；点击顶部空白同样关闭并回焦；再次点击触发图可关闭。
- 像素对照（旧/新元素截图，右侧 260px）：0 态 204/12480 差异像素、2 态 204/12480、7 态 233/12480；差异集中在旧版清单图标 0.5px 基线边缘、行圆角边缘及数字抗锯齿，图标、箭头、分隔线与清单图标位置本身逐像素一致。弹层截图差异 222/4454，4× 放大后视觉一致，其余为亚像素抗锯齿。
- 证据目录：`dist/acceptance/d-v-w1/`（测量数据 `measurements.json`、新旧截图、放大图与差异热图）。未纳入源码。

## 验证

- `npm run typecheck:standalone` 通过。
- `npm run build:standalone` 通过（`dist/standalone/site`，2.00s）。
- `node --test tests/standalone/*.test.cjs`：59/59 通过。
- `FOCUS_STANDALONE_ENGINES=chromium FOCUS_RESTORE_SHARED=1 node tests/standalone/workspace-browser.cjs`：20/20 通过。本轮回归只跑 Chromium；Firefox/WebKit 未在 W1 重跑。
- 修复过程中发现触发按钮的 `aria-label` 与详情面板 `Estimated pomodoros` 同名会导致既有测试 strict 模式冲突，已改为 `预计番茄数…` / `Estimated pomodoros…`，回归恢复通过。

## 剩余与边界

- 新版清单图标相对旧版有 0.5px 基线垂直偏移（旧版 inline-block 基线所致），仅影响抗锯齿，不改变可见位置；未为此叠加 transform 补丁。
- 深色模式仅按旧版资产做了 CSS 映射，本轮未在深色状态做运行时对照。
- 本轮只改快速添加输入行；任务行、计时器、森林、详情与右键菜单未改动。
- 番茄数 >5 时不显示 1–5 直接点击格（与旧版一致），需通过选择器调整。

本轮 WIP 提交只包含 W1 源码与本记录；`docs/BACKLOG.md`、`Projects.tsx` 与上一轮 window-scroll 文档/测试仍未提交，留给其所属阶段处理。
