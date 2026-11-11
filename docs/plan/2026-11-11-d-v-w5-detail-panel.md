# D-V-Workspace W5：任务详情侧栏结构、滚动与交互

2026-11-11，worktree `refactor/standalone-app`。旧版权威为 Git Tag 1.9.3（5513），新版 Vite HMR 5511。Chromium 1280×900、DPR 1、独立浏览器上下文、合成数据（短任务、含 30 个子任务与长备注的任务、完成/未完成、跨年日期、不同优先级）。未访问或操作 5500，未修改字段/重复/子任务/备注编辑业务（留给 W6），未推送、合并或发布。

## 旧版源码与运行时依据

- 结构：`TaskDetailRegion-root` 为绝对定位覆盖层（`position:absolute; right:0; top:0; width:340px; height:100%; padding:16px 16px 16px 0; background:transparent`），实测 `[940,50,340,850]`。内部 `TaskDetailRegion-content` 为 flex column、`overflow:hidden`、圆角 10、背景 `--bg-main`，实测 `[940,66,324,818]`。
- 滚动：内容区 `TaskDetailRegion-taskInfo`（`ScrollView-customContainer`）实测 324×776，其内部 `ScrollView-root` 为 `overflow-y:auto` 的实际滚动容器（clientHeight 772、长内容 scrollHeight 2101）；底部 `BottomBar` 42px 作为 flex 尾项固定在内容底部 `y=842`，不随内容滚动。
- 布局独立：详情打开不改变左侧侧栏（`ProjectRegion`）滚动位置；任务列表滚动容器的 `margin-right` 由 0 → 340px 以 `margin-right .15s linear` 过渡（实测 50/100/150ms 中间帧宽度 912.8/799.5/686.4）。
- 空白关闭：`TaskRegion-root` 绑定 `onClick={uncheckObject}`（`CHECK_OBJECT` → `checkObject('')`）。点击任务行/添加框/排序按钮/详情内部各自阻止冒泡；点击摘要、列表空白等会关闭详情。
- 完成：任务勾选过渡 `background-image 250ms`；提交完成后详情随即关闭（50ms 内卸载，与列表让位动画同时发生）。
- 页头：`HomeHeader-root` 高 50、无下边框、`box-shadow: rgba(224,224,224,.5) 0 0 3px 1px`；头像 30×30 于 y=11.7，用户名文字 y=14 高 21，下拉箭头 14×14 于 y=20.2，导航按钮 24×24 于 y=13。

## 修复

1. **空白关闭**：`App.tsx` 主任务区 `onClick` 接入 `blankClick()`，规则与旧版等价：点击冒泡到任务区根且不在任务行、添加框、详情、排序、按钮/输入/select/textarea/a/label/summary/details 内时 `select('')`。实测：摘要关闭 ✓、列表空白关闭 ✓；任务行、添加框、详情内部不关闭 ✓。
2. **详情动画**：列表区 `margin-right` 0↔340 使用 `.15s linear` 过渡（实测 50/100/150ms 中间帧 88/239/340px）；勾选控件补 `background-image .25s` 过渡；完成后详情关闭（与旧版一致在提交后立即关闭）。
3. **左右独立布局**：详情从 flex 列改为 `main` 内绝对定位覆盖层（340px），移除 `has-details` 对侧栏/内容宽度的挤压；修复 `.workspace-layout.has-details .workspace-sidebar{padding-top:16px}` 导致侧栏下移的问题。实测打开详情前后 sidebar `scrollTop` 与首行 y 不变。
4. **详情滚动**：新增真实滚动容器 `.workspace-details-info`（`flex:1;min-height:0;overflow-y:auto`），内容与滚动条绑定到它；长内容滚轮实测 `scrollTop 300`（旧版同为 300），底部按钮保持 y=842 不随滚动移动。`LegacyScrollbars` 目标由根节点改为 `.workspace-details-info`。
5. **底部控件**：`legacy-detail-bottom` 作为 content flex 尾项固定 42px，含关闭、创建时间、手动补记、删除四个控件；实测位置与旧版 `BottomBar` 同为 `[940,842,324,42]`，长内容滚动时不变。
6. **页头几何**：按旧版计算样式对齐：头像 `margin-top:4.4px`（y 11.7）、用户名 `line-height:21px` 于 y14、箭头 `margin-top:5.4px`（y 20.2）、导航按钮 y13；页头去掉下边框并恢复旧版阴影。实测四项矩形与旧版完全一致。

## 实测证据（Playwright MCP）

工具：`browser_evaluate`、`browser_run_code_unsafe`（真实鼠标点击/滚轮、rAF 采样、截图）。

- 详情几何：新旧 root `[940,50,340,850]`、content `[940,66,324,818]`、bottom `[940,842,324,42]` 完全相同；长内容滚动 clientHeight 776 / 旧 772（见剩余）。
- 滚轮：新旧 `scrollTop` 均 0→300，底部 y 均保持 842；左侧 sidebar `scrollTop` 均保持 0。
- 空白点击：新版权限表与旧版一致（摘要/空白关闭；行/添加框/详情内不关闭）。
- 动画中间帧：打开 0→88→239→340px（50/100/150ms），关闭 340→246→132→19→0px。
- 页头：头像 `[16,11.7,30,30]`、用户名 `[54,14,56,21]`、箭头 `[112,20.2,14,14]`、导航 `[1123,13,24,24]`，与旧版逐项相同。
- 深色：详情内容背景 `rgb(26,26,32)`、圆角 10、`overflow:hidden` 与旧版一致。

## 验证

- `npm run typecheck:standalone` 通过。
- `npm run build:standalone` 通过。
- `node --test tests/standalone/*.test.cjs`：59/59 通过。
- `FOCUS_STANDALONE_ENGINES=chromium FOCUS_RESTORE_SHARED=1 node tests/standalone/workspace-browser.cjs`：通过。
- `FOCUS_STANDALONE_ENGINES=chromium node tests/standalone/task-interactions.cjs`：四组合 PASS，8 组截图对照。

## 剩余与边界

- 详情滚动容器 clientHeight 776（旧 772）：旧版外层留 4px 且内层不随内容滚动；新版 4px 作为滚动内容内边距，视觉一致，未再拆双层。
- 详情内部字段/分组内容、重复/子任务/备注编辑器仍为旧版差异范围，W6 处理；长内容总高因此不同（旧 2101 / 新 1640）。
- 旧版按完成日期分组的“已完成”列表标题尚未实现（W4 遗留）。
- 本轮仅 Chromium 1280×900；窄屏与 Firefox/WebKit 未复跑。

本轮 WIP 提交只包含 W5 源码与本记录；`docs/BACKLOG.md`、`Projects.tsx` 上一轮动画改动、window-scroll 文档/测试仍未提交，保持原状。

## 临时目录

本阶段临时目录 `.agent-temp/d-v-workspace-w5/` 已清理，检查确认不存在。
