# D-V-Workspace W6：任务详情字段、输入控件及编辑体验

2026-11-11，worktree `refactor/standalone-app`。旧版权威 Tag 1.9.3（5513），新版 Vite HMR 5511。Chromium 1280×900、DPR 1、独立浏览器上下文、合成数据（重复任务、过去/未来提醒、30 个子任务、长备注、不同优先级）。未访问或操作 5500，未改动 W5 侧栏整体布局，未改变数据事务与计时记录逻辑，未推送/合并/发布。

## 旧版依据

- 重复：`TaskItem/TitleItem` 完成图标按 `rCycle>0` 使用 `task_repeat_{优先级}.png`；重复行 `RepetitionItem` 高 44、图标 24 `detail-repetition.png`，值区两行：`tsk_every_day`/`tsk_every+n+tsk_days`/星期文案，第二行 `下个任务: <localWeekDate>`；`getNextRepetitionDate` 以 1=周一…7=周日（0 视为 7）计算。
- 重复选择器：`RepetitionInput` 240×100 + padding16；每日=“每[cycle][天]”；选周显示 7 个 26×26 圆标签（1px 边框、圆角 50%，选中 `#fd5553`，未选 `#aeaeae`，文字 small-font，首个无边距、其余 margin-left 4）；单位 天/周/月/年；移除/确定 100×30 圆角 6。
- 番茄：行 44，图标 24；值区右侧两行：实际数 12px `#fd5553`、估计数 12px `#ffd9d8`、分隔 `/` 12px `#aeaeae`、第二行 `= 25分钟` 12px 灰；番茄图标 12×12。
- 优先级：标题行 td 宽 24、padding 13/1/3，图标盒 22×22 但背景 20×20。
- 清单下拉：`ProjectSelection` 200 宽、选项 34 高、`padding:0 16px`，图标 24（任务图标 / 清单 11×11 色点），名称 padding-left 12，选中行背景 `#f5f5f5`，右侧 24×24 `new-task-project-selected.png` 勾选。
- 提醒：`localTime()` = `date_ymdt`（中文 `YYYY年M月D日 ah:mm`，英文 `D MMM YYYY h:mm a`）；`reminderDate < now` 时颜色 `--text-overdue #dd4b39`。
- 子任务：行 min-height 44、padding 0 14；完成/开始图标 20×20；名称 padding 8/0/8/12、14px；删除图标 10×10 仅 hover 显示；添加输入 44 高、`spellcheck=false`、`tabindex=-10`。
- 备注：展示区 `min-height 165`；聚焦后 textarea 高度设为内容高度（实测长备注 394px），自身 `overflow:hidden`，由外层详情滚动容器承载；聚焦无描边（outline none）。

## 修复

1. **重复图标**：`TaskDetails` 标题完成控件按 `rCycle/优先级` 输出 `task_repeat_{优先级}.png`（非重复已完成用 `task_done_no_priority.png`，未完成用 `task_no_priority.png`）。实测 R1 与旧版同资源、同尺寸位置。
2. **番茄数量控件**：值区数字拆分为 `.legacy-pomo-actual`（12px `#fd5553`）与 `.legacy-pomo-estimated`（12px `#ffd9d8`），分隔 `/` 12px 灰，图标 12×12，第二行 `= N分钟` 12px 灰；实测颜色/字号/间距与旧版一致。
3. **重复状态**：星期编号由 0–6 改为旧版 1–7（周一=1），修正已有 `rValue` 语义；选周显示 26×26 圆标签、选中粉色/未选灰色；重复行恢复“每天/每 N 天/每周 周X…”文案与“下个任务: …”第二行（按旧版 `getNextRepetitionDate` 规则计算下次日期）。`RepeatPicker` 与保存校验同步改为 1–7。
4. **优先级图标**：选择器容器 26×28、图标 20×20 居中（原 28 容器/24 图标），实测字形位置与旧版一致。
5. **清单下拉**：保持“任务 + 自定义清单”内容与顺序，选项 200/34、内边距 16、图标间距 12，清单色点 11×11，选中背景 `#f5f5f5`，右侧 24×24 勾选图标（`new-task-project-selected.png`）。
6. **提醒**：按 `date_ymdt` 输出中英文完整格式（`2026年11月11日 下午6:39` / `11 Nov 2026 6:39 pm`）；提醒时间早于当前时间时红色 `#dd4b39` 并带 `data-overdue`。
7. **子任务**：行高 44、20×20 完成/开始图标、名称 14/20 左内边距 12、已完成灰色+删除线、删除图标 10×10 hover 显示；添加行 44 高。
8. **添加子任务输入**：增加 `autoComplete="off"`、`spellCheck={false}`、`tabIndex={-10}`、唯一 `name`，关闭浏览器历史/自动完成建议。
9. **备注聚焦边框**：覆盖通用 `:focus-visible` 规则，备注 textarea 聚焦 `outline:0`、无边框/无阴影。
10. **备注自动增高**：textarea 改为 `height:auto;min-height:165px;overflow:hidden`，输入/聚焦时按 `scrollHeight` 设置高度；长备注实测高度 394px 与旧版一致，滚动由详情容器承担。
11. 附带：详情“到期日”值由 ISO 改为旧版相对/月日文案（与 W4 列表规则一致）。

## 实测证据（Playwright MCP）

工具：`browser_evaluate`、`browser_run_code_unsafe`（真实点击、焦点、输入、弹层操作、截图）。

- 重复：R1 旧/新图标均为 `task_repeat_no_priority.png`；重复值文本同为“每天 下个任务: 11月13日 周五”。
- 番茄：实际 `0` `rgb(253,85,83)` 12px、估计 `2` `rgb(255,217,216)` 12px、分隔 `/` `rgb(174,174,174)`，新旧一致。
- 星期：切换“周”后标签 7×26×26、圆角 50%、1px 边框，选中 `#fd5553`，未选 `#aeaeae`。
- 提醒：中文 `2026年11月11日 下午6:39`、英文 `11 Nov 2026 6:39 pm`，均为 `rgb(221,75,57)` 且 `data-overdue=true`。
- 清单下拉：任务、清单A（选中 #f5f5f5）、清单B、子清单C，200×34 选项，色点 11px，勾选图标 24。
- 子任务：行 `[940,y,324,44]`，完成图标 `task_done_no_priority.png`，已完成名称 `rgb(174,174,174)` + line-through；添加输入 `autocomplete=off`、`spellcheck=false`、`tabindex=-10`。
- 备注：聚焦 `outline none`，长备注高度 394（旧版同为 394），内部无滚动条，详情容器滚动。
- 深色/英文：R1、U3 详情截图与提醒格式对照（`dist/acceptance/d-v-w6/`）。

## 验证

- `npm run typecheck:standalone` 通过。
- `npm run build:standalone` 通过。
- `node --test tests/standalone/*.test.cjs`：59/59。
- `FOCUS_STANDALONE_ENGINES=chromium FOCUS_RESTORE_SHARED=1 node tests/standalone/workspace-browser.cjs`：通过（详情到期日断言随旧版文案校准）。
- `FOCUS_STANDALONE_ENGINES=chromium node tests/standalone/task-interactions.cjs`：四组合 PASS，8 组截图对照。

## 剩余与边界

- 重复选择器中单位下拉、cycle 输入、移除/确定按钮的像素级细节沿用既有实现，未逐项像素对照；重复任务规则与星期映射已按源码校正。
- 番茄选择器弹层（滚轮、数字输入）为既有实现，本轮仅校准行内数量控件；未重做弹层内部布局。
- 清单下拉旧版弹层未能在本轮稳定打开截图（旧版点击时序），其内容/尺寸依据源码 CSS 与旧版早期 DOM 记录；新版结构与样式已对齐。
- 标签选择器、日期/提醒弹层内部不是本轮 10 项范围，未逐像素对照。
- 本轮仅 Chromium 1280×900；窄屏与 Firefox/WebKit 未复跑。

本轮 WIP 提交只包含 W6 源码、测试断言校准与本记录；`docs/BACKLOG.md`、`Projects.tsx` 上一轮动画改动、window-scroll 文档/测试仍未提交，保持原状。

## 临时目录

本阶段临时目录 `.agent-temp/d-v-workspace-w6/` 已清理，检查确认不存在。
