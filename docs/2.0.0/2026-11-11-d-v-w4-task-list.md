# D-V-Workspace W4：任务列表日期、时间格式与排序控件

2026-11-11，worktree `refactor/standalone-app`。旧版权威为 Git Tag 1.9.3（5513），新版 Vite HMR 5511。Chromium 1280×900、DPR 1、独立浏览器上下文、合成数据（今天/明天/昨天/跨年 2020/明年 2027/无日期/已完成/长短时长/不同优先级/部分完成）。未访问或操作 5500，未修改任务详情侧栏、拖拽算法与业务持久化，未推送、合并或发布。

## 旧版源码与运行时依据

- 日期文案：`src/js/main.js` 的 `moment.prototype.localDate()`——早于当年起点用 `date_ymd`（`YYYY年M月D日` / `D MMM YYYY`），早于今天用 `date_md`（`M月D日` / `D MMM`），今天/明天用 `cmm_today`/`cmm_tomorrow`，晚于年末同理 `date_ymd`。
- 任务行日期：`TaskItem.render` 中 `0===deadline` 时 `display:none`；否则 `o = moment(deadline).localDate()`，宽度取隐藏测量文本宽度 + 4px，`deadline < moment().startOf('day')` 时颜色 `FTColor.textOverdue`（`#dd4b39`，运行时 `rgb(221,75,57)`，与是否完成无关）。日期 `span.small-font` 实测 12px/15px、`vertical-align:middle`、右对齐。
- 分组标题：`TaskGroup.refreshTitle` 输出 `title + "  •  " + secondsToLocalHH_MM()`；`secondsToLocalHH_MM → minutesToLocalHH_MM` 使用 `cmm_local_h_m`/`cmm_local_hour`/`cmm_local_minute`（中文“2小时5分钟”，英文“2h 5m”）。按到期日分组标题为 `localDate + 周X`（中文“2020年3月5日 周四”“11月10日 周二”，英文“Thu, 5 Mar 2020”“Tue, 10 Nov”），今天/明天不带周几，零截止为“待定/Someday”。按清单为清单名；按优先级为“高/中/低/无优先级”（英文 High/Medium/Low/No Priority）。
- 排序菜单：`getContextMenus` 基础 `[project, deadline, priority]`；自定义清单/任务：去掉 project 并追加 customized；今天：`includesOverdueInToday` 为 false（逾期可见）时去掉 deadline；明天/待定：去掉 deadline；优先级视图：去掉 priority。菜单实测 190×88（3 项）/190×64（2 项），项高 24、`padding:0 40px 0 16px`、14px/24px，容器圆角 8、阴影 `rgba(197,197,197,.5) 0 0 20px 1px`（深色 `#0e0d12`、背景 `#2d2d37`），勾选图标 24×24 位于右侧 8px。
- 排序按钮：`TaskRegion-sortMenu` 40×40 单元格，背景 `tsk-sort.png` 尺寸 40×30 居中、`cursor:default`。
- 已完成区块：旧版仅今天/本周/全部/任务/清单/清单夹/标签/优先级等视图显示“显示/隐藏已完成任务”按钮与已完成列表；明天/已计划/待定/逾期/日程/已完成视图没有该区块；仅今天按 `ShowFinishedTasksInToday` 偏好默认展开，其他视图默认收起。

## 修复

1. **任务行日期内容/格式/颜色/字体/尺寸/位置**（`App.tsx`、`TaskGroups.ts`、`legacy-workspace.css`）：改用 `formatTaskDate()` 复现 `localDate`（今天/明天相对文案、当年月日、跨年年月日；英文 Today/Tomorrow、`10 Nov`、`5 Mar 2020`）；`deadline < 今天 0 点` 增加 `data-overdue` 红色 `#dd4b39`；日期字号 12px、行高 15px、右对齐，矩形与旧版逐项一致（今天 x1228 w24、11月10日 x1201.4 w50.6、2020年3月5日 x1176 w76，纵向 y 也一致）。
2. **“明天”相对日期**：`formatTaskDate` 的明天分支恢复，实测行内显示“明天/Tomorrow”而不是 ISO。
3. **逾期红色**：条件与旧版一致（截止日期早于今天起点），已完成任务同样为红色（旧版今天视图 U6 实测红）。
4. **预计时间格式**：分组标题时长由“纯分钟”改为旧版 `minutesToLocalHH_MM`（“25小时25分钟”“2小时30分钟”“50分钟”；英文“25h 25m”“2h 30m”“50m”）。
5. **排序按钮尺寸**：图标背景由 40×40 改为旧版 40×30 居中、容器 40×40、`cursor:default`。
6. **排序下拉菜单**：移除隐藏 `<select>`，改为旧版样式的触发按钮 + 菜单（宽 190、内边距 8px 0、项高 24、14/24、右侧 24×24 勾选图标、圆角 8、同款阴影与深色配色）；菜单项按视图类型组合（自定义清单/任务 3 项、今天按逾期可见性 2/3 项、明天/待定 2 项、优先级 2 项、全部 3 项），标签中英文与旧版一致；支持遮罩点击、Escape 关闭；点击后写入 `orderingRule` 并按旧版规则重排。
7. **已完成区块作用域**：仅在旧版存在的视图渲染“显示/隐藏已完成任务”，且仅今天按偏好默认展开、其他视图默认收起；任务行日期（含已完成）沿用同一规则。

## 实测证据（Playwright MCP）

工具：`browser_evaluate`、`browser_run_code_unsafe`（`locator.click`、真实页内点击、IndexedDB 读写、`page.screenshot`）。

- 日期行：中文/英文下 `今天/Today`、`明天/Tomorrow`、`11月10日/10 Nov`、`2020年3月5日/5 Mar 2020`、`2027年1月15日/15 Jan 2027`、无日期不渲染，文本与 y 坐标逐项一致；颜色亮色 `rgb(174,174,174)` / 逾期 `rgb(221,75,57)` / 暗色 `rgb(143,143,145)`。
- 分组标题（按到期日）：6 组文本与旧版完全相同（含周几与 h小时mm分钟/英文 h/m）；按清单、按优先级的标题与分组顺序一致；分组纵向坐标 304/407/564 与旧版相同。
- 排序菜单：自定义清单 3 项、今天 2 项、明天 2 项、高优先级 2 项、全部 3 项，中英文逐项一致；勾选态与当前 `orderingRule` 一致；菜单矩形、内边距、字号、圆角、阴影、深色配色与旧版相同。
- 实际点击切换排序：旧/新 `orderingRule` 均变为 1/2/3，未完成任务顺序逐项相同（到期日升序且无日期置后、优先级高→无、自定义按 order）。
- 任务列表像素对照（同视口 968×520）：差异 1281 px / 503360（0.25%），集中在文字抗锯齿与番茄图标边缘。

## 验证

- `npm run typecheck:standalone` 通过。
- `npm run build:standalone` 通过。
- `node --test tests/standalone/*.test.cjs`：59/59 通过。
- `FOCUS_STANDALONE_ENGINES=chromium FOCUS_RESTORE_SHARED=1 node tests/standalone/workspace-browser.cjs`：通过。
- `FOCUS_STANDALONE_ENGINES=chromium node tests/standalone/sidebar-interactions.cjs`：PASS。
- `FOCUS_STANDALONE_ENGINES=chromium node tests/standalone/task-interactions.cjs`：四组合 PASS，8 组截图对照。
- 测试断言更新：`workspace-browser.cjs` 中任务行日期期望由 ISO 改为旧版相对/月日文案（`Today`/`Tomorrow`/`7 Dec`），详情字段仍按 ISO 断言；属校准到旧版权威行为，未降低断言强度。

## 剩余与边界

- 已完成区块在旧版按完成日期分组（标题“今天/11月10日”等），新版为扁平列表；本轮未实现分组标题（不在日期/排序六项内）。
- 旧版 DOM 中存在任务行重复节点（拖拽预览用），新版单份；视觉无差异。
- 旧版按到期日排序在“今天/逾期”视图存在特殊顺序规则，本轮未触发对应用例；现有实现保留原特殊分支。
- 侧栏名称差异（过期/未来7天/全部）与摘要条目几何差异为 W2/W3 遗留，未在本轮处理。
- 本轮仅 Chromium 1280×900；窄屏与 Firefox/WebKit 未复跑。

本轮 WIP 提交只包含 W4 源码、测试断言校准与本记录；`docs/BACKLOG.md`、`Projects.tsx` 上一轮动画改动、window-scroll 文档/测试仍未提交，保持原状。

## 临时目录

本阶段临时目录 `.agent-temp/d-v-workspace-w4/` 已清理，检查确认不存在。
