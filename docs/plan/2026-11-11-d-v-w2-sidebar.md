# D-V-Workspace W2：侧栏结构与视觉还原

2026-11-11，worktree `refactor/standalone-app`。旧版权威为 Git Tag 1.9.3，隔离服务 5513；新版为 Vite HMR 5511。Chromium 1280×900、DPR 1、独立浏览器上下文、合成数据（8 个自定义清单、1 个含子清单的清单夹、3 个标签，并临时显示“待定”预设）。未访问或操作 5500，未修改拖拽算法、统计计算与默认排序，未推送、合并或发布。

## 旧版源码与运行时依据

- 侧栏滚动：旧版结构为 `ProjectRegion-root > ScrollView-customContainer.ProjectRegion-projects > ScrollView-root > section.projects-date > ul`，搜索框 `SearchItem-root` 是 `ul` 的第一个 `li`，与清单行同处 `ScrollView-root` 滚动内容；`ProjectRegion-projects` 负责 `padding-top:12px`，`ScrollView-root` 为 `overflow-y:auto` 的实际滚动容器。实测旧版内容高 873、可视 796、滚动范围 77px；`scrollTop` 77 时搜索行 `y` 由 62 变为 -15。
- 行几何：`src/main.css:629-763`。`ProjectItem-content` 为 `flex:1`、高 36、1px 透明边框；`ProjectItem-icon` 为 `flex-basis:28px; padding-left:8px`（border-box，内容 24px 决定实际 32px，自定义清单 11px 色点 + 7px 外边距时为 33px）；`ProjectItem-color` 11×11、圆角 50%、`margin:12px 7px 11px 7px`；`ProjectItem-image` 24×24、`margin-top:5px`；`ProjectItem-name` `padding-left:8px; line-height:33px`；`ProjectItem-estimatedTime` `flex-basis:33px; padding:1px 14px 0 0; text-align:right; 12px/33px`；`ProjectItem-taskQuantity` `flex-basis:12px; padding:1px 10px 0 0`；`ProjectItem-child` 内容 `max-width:235px`；`ProjectRegion-separator` 为 `height:1px; margin:16px; border-bottom:1px solid var(--split)`（`--split` 亮色 `rgb(244,244,244)`、暗色 `rgba(255,255,255,.08)`）。
- 图标：文件夹与标签在旧版运行时为 `mask-image: url(img/folder.png)` / `url(img/tag.png)`、`mask-size:24px 24px`、`mask-position:0% 0%`、`repeat`，背景色取清单颜色；实测文件夹元素截图实心像素 216、标签元素截图与新版逐字节一致。
- 文案：旧版预设行 `id-deadline-someday` 显示 `待定`（英文 `Someday`），i18n 键 `prj_someday`；内部 ID 与业务字段不变。
- 页脚：`ProjectNewItem-root` 42px 高、`padding:8px 12px 10px`、`border-top:1px solid var(--split)`；标签、文件夹新增按钮为 24×24 图标（文件夹单元 36px 宽、图标右对齐）。

## 差异修复

1. 搜索框层级：新版原为 `nav > workspace-search` + `workspace-projects`（搜索固定在滚动区外）。将搜索区移入 `.workspace-projects` 滚动容器，`nav` 取消 `padding-top`、滚动容器补 `padding-top:12px` 以保持搜索行 `y=62`。新版滚动范围与旧版同为 77px，真实滚轮后 `scrollTop` 0→77、搜索行 `y` 62→-15，与旧版一致。
2. 自定义清单/清单夹/标签图标尺寸：图标槽由固定 `flex:0 0 33px` 改为内容自适应（预设 32px、自定义 33px）；自定义清单恢复 11×11 色点与 `margin:12px 7px 11px 7px`；文件夹按旧版 `mask: folder.png 0 0/24px 24px repeat` 修正（原为 `center/24px` 的 auto 高度，字形偏大）；标签在侧栏由 16px `tag-small` 改为 24px `tag.png`。元素级截图与旧版逐字节一致。
3. “某天”→“待定”：`standalone/shared/workspace.ts` 中文 `someday` 恢复为 `待定`；英文仍为 `Someday`；内部 ID `id-deadline-someday` 与预设类型 4003 未改，点击、选中与持久化沿用原逻辑。
4. 右侧时间文字：补回旧版 `padding:1px 14px 0 0`（预计时长）与 `padding:1px 10px 0 0`（任务数），并补 1px 透明右侧内缩复现旧版内容盒内宽；预计时长列 `x=221.34`（旧 221.33）、数量列 `x=254.34`（旧 254.33），右边界一致。
5. 字体与颜色：四组合（中/英 × 明/暗）实测 `font-size/line-height/font-weight/letter-spacing/color` 全部一致，中文亮色 `14px/33px 400 rgb(82,82,82)`、暗色 `rgb(232,232,235)`，次要信息 `rgb(174,174,174)`/`rgb(143,143,145)`。搜索框底色、圆角、尺寸一致，清除按钮同为 24×24 且位置一致。
6. 交互状态：悬停自定义清单时旧版显示 24×24 `project-hover-menu.png` 并隐藏统计，新版一致（修正了按钮内边距把图标压成 16×24 的问题）；选中行底色均 `rgb(245,245,245)`，并按旧版内容盒做了 1px 上下内缩；分隔线与页脚线恢复 `--split` 的明暗双值（#f4f4f4 / rgba(255,255,255,.08)）。

## 实测证据（Playwright MCP）

工具：`browser_navigate`、`browser_tabs`、`browser_resize`、`browser_evaluate`、`browser_run_code_unsafe`（真实 `page.mouse.move/wheel/down/up`、`locator.click/type`）、`browser_console_messages`、`browser_take_screenshot`（受 MCP 输出根限制，最终截图改由 run_code 写入项目内证据目录）。

- 新旧界面在同一合成数据下逐行比较：21 行 × 图标槽/名称/预计时长/数量/字体；非亚像素差异为 0。英文下名称文本数组与旧版逐项相同（含 `Someday`）。
- 真实滚轮：两版 `scrollTop` 0→77、搜索行 `y` 62→-15，滚动范围同为 77px。
- 元素级截图：自定义清单色点、文件夹、标签、预设“今天”、子清单色点在遮罩图片加载完成后与旧版逐字节相同（此前一度出现差异，实为 HMR 后遮罩图片未解码的瞬时状态，重载后消失）。
- 像素对照（整块侧栏，280×850）：中文亮/暗差异 0.653%/0.659%，英文约 1.5%；差异集中在顶部 4px 阴影裁剪、页脚新增按钮 2px 偏移、文本抗锯齿与 0.01～0.21px 列宽取整。
- 悬停、选中、搜索输入与清除均实际执行鼠标/键盘操作验证。
- 证据目录：`dist/acceptance/d-v-w2/`（新旧四组合截图、中间与最终差异热图、测量数据 `measurements.json`）。未纳入源码。

## 验证

- `npm run typecheck:standalone` 通过。
- `npm run build:standalone` 通过。
- `node --test tests/standalone/*.test.cjs`：59/59 通过。
- `FOCUS_STANDALONE_ENGINES=chromium FOCUS_RESTORE_SHARED=1 node tests/standalone/workspace-browser.cjs`：20/20 通过（本轮只跑 Chromium）。

## 剩余与边界

- 顶部 4px 阴影：旧版侧栏 `overflow:visible`，头部阴影落到侧栏顶部；新版 `overflow:hidden` 裁掉该 4px 渐变。属布局上下文差异，未在本轮改动。
- 页脚新增按钮：图标尺寸 24×24 一致，标签按钮图标较旧版左移 2px、文件夹按钮图标较旧版左移 2px（旧版为 24px/36px 表格单元与右对齐背景）。本阶段清单未包含页脚，未调整。
- 列宽亚像素：旧版数量列实测 16.67px（英文 16.88px），新版固定 16.66px，导致名称宽度整数位差 0.01～0.21px。
- 隐藏统计行（日程/已完成）旧版 DOM 保留 `0m`/`0` 文本但 `display:none`，新版不渲染；视觉一致，文本节点不同。
- 本轮只对照 Chromium、1280×900；窄屏、Firefox/WebKit 与其他侧栏状态（拖拽、右键菜单）不在 W2 范围。

本轮 WIP 提交只包含 W2 源码、`.gitignore` 与本记录；上一轮 window-scroll 文档/测试、`Projects.tsx` 与 `docs/BACKLOG.md` 仍未提交，留给其所属阶段处理。

## 临时目录

本阶段临时目录 `.agent-temp/d-v-workspace-w2/` 已清理，检查确认不存在。
