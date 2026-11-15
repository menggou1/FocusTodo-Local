# D-V-Workspace W3：侧栏统计规则与清单默认顺序

2026-11-11，worktree `refactor/standalone-app`。旧版权威为 Git Tag 1.9.3，隔离服务 5513；新版为 Vite HMR 5511。Chromium 1280×900、DPR 1、独立浏览器上下文、合成数据。未访问或操作 5500，未修改拖拽算法、手动排序或动画，未推送、合并或发布。

## 旧版源码与运行时依据

- 默认顺序：`src/js/local-data.js` 的 `defaultProjects()` 与新版 `standalone/services/data.mjs` 完全同值（同一组 id/type/order/state）。旧版“恢复默认排序”调用 `src/js/local-settings-ui.js` 的 `restoreSystemProjectOrder(db)`：仅按 id 命中默认清单并写回 `order`，自定义清单不受影响。
- 清单管理顺序：旧版 `main.js` ProjectManagement 把清单分成 `presetProjects`（明天/已计划/待定/本周/逾期/未来7天/优先级/全部/日程/已完成）与 `customProjects`（type 1000），分别按 `order` 排序后先预设后自定义渲染；今日、任务、搜索以及文件夹、标签不进入该列表。
- “今天”范围：旧版 `fetchTasksOfDeadlineProjectType` 对 today 使用 `IDBKeyRange.bound(includesOverdueInToday ? 1 : startOfDay, nextDayStart)`；`includesOverdueInToday` 在隐藏逾期清单时为 true、显示逾期清单时为 false（`main.js` 中隐藏/显示 `overdue` 事件分别设 false/true，TaskStorage 默认 true）。
- 任务统计：`fetchTasksOfProject` 只取未完成任务；预计时间 `estimatedMinutesOfTasks` 对每个任务执行 `max(estimatePomoNum - Σ min(record.interval / record.pomodoroInterval, 1), 0) × (task.pomodoroInterval || workInterval)`，四舍五入到分钟；数量为任务条数。
- 清单夹统计：父清单夹把直接子清单的 `unfinishedTasksNum`/`estimatedTime` 相加；嵌套清单夹中的任务不计入祖父夹（运行时验证父夹 0m/0、嵌套夹 50m/1）。
- 标签统计：按任务 `tags` 包含标签 id 的未完成任务统计。
- 摘要项：旧版 only 在“今天/本周/全部/任务/清单/清单夹/标签”显示 4 项（预计时间、待完成任务、已专注时间、已完成任务）；明天/逾期/已计划/待定/未来7天只显示前两项。
- 已完成任务：今天与本周按 `finishedDate` 落在对应区间统计（运行时：今天已完成 3 = 完成于今天的 d2/d4/d5，而非截止今天的 2 条）；全部与自定义清单按清单内 `isFinished` 统计。
- 时间格式：摘要使用 `minutesToLocalHH_MM`——时>0 且分>0 为 `cmm_local_h_m`（中文“2小时5分钟”、英文“2h5m”），整点仅小时（“2小时”/“2h”），不足 1 小时仅分钟（“40分钟”/“40m”）；侧栏仍为紧凑 `1h 40m`。

## 修复

1. **“今天”范围**（`standalone/services/business.mjs`）：改为按逾期清单可见性取 `start` 或 `1`，与旧版一致。逾期清单默认隐藏时今天包含逾期任务；在清单管理中显示逾期后，今天不再包含逾期任务。
2. **摘要统计项集合**（`standalone/features/App.tsx`）：逾期/明天/已计划/待定/未来7天只渲染“预计时间、待完成任务”；其余视图保留四项。
3. **已完成统计**（`App.tsx`）：今天=完成时间在今天的任务；本周=完成时间在本周（周一起）的任务；替换原先按截止日统计。列表内“显示已完成”同样使用该集合。
4. **摘要时间格式**（`App.tsx`）：新增 `duration()`，按旧版 `minutesToLocalHH_MM` 输出“小时+分钟”“仅小时”“仅分钟”，中英文分别使用 小时/分钟 与 h/m（英文无空格）。
5. **清单管理顺序与恢复默认**（`standalone/features/workspace/Projects.tsx`）：管理列表改为“预设组（type≥4000，排除今日/任务/搜索）+ 自定义清单组（type 1000）”，各自按 order 排序；文件夹、标签不再混入。恢复默认仍按默认 `order` 回写，结果与旧版一致。
6. 未改动：拖拽算法、手动排序、动画、默认清单数据值、备份/持久化结构。

## 实测证据（Playwright MCP）

工具：`browser_evaluate`、`browser_run_code_unsafe`（Playwright `locator.click`、真实页内点击、IndexedDB 读写、截屏）。合成数据：7 条任务覆盖今天未完成/今天完成于今天/今天完成于昨天/明天完成于今天/无截止完成于今天/逾期未完成/今天部分完成；另加 10 条任务、嵌套清单夹、子清单、标签任务与 60/61/120 分钟样例。

### 统计规则对照表（修复后实测，新旧一致）

| 视图 | 任务范围（仅未完成） | 数量 | 预计时间 | 已完成（摘要） | 摘要项 |
|---|---|---|---|---|---|
| 今天 | 截止于今天；逾期清单可见时不含逾期，隐藏时含逾期 | 2 / 3（两种可见性） | 1h40 / 2h5 | 计时区间=完成于今天：3 | 4 |
| 明天 | 截止于明天 | 0（样例均已完成） | 0m | 不显示 | 2 |
| 逾期 | 截止 < 今天起点 | 1 | 25m | 不显示 | 2 |
| 本周 | 截止于本周（周一起） | 3 | 2h5 | 完成时间在本周：4 | 4 |
| 未来7天 | 截止于 [今天起点, +7 天) | 2 | 1h40 | 不显示 | 2 |
| 已计划 | 截止 > 0 | 3 | 2h5 | 不显示 | 2 |
| 待定 | 截止 = 0 | 2 | 1h15 | 不显示 | 2 |
| 全部 | 所有未完成 | 5 | 3h20 | 全部已完成：4 | 4 |
| 任务(7005) | projectId=id-task-tasks | 0 | 0m | 0 | 4 |
| 清单 A | projectId=清单A | 4 | 2h30 | 清单内已完成：4 | 4 |
| 清单夹 F | 直接子清单中的任务 | 0 | 0m | 0 | 4 |
| 嵌套夹 F2 | 直接子清单 D 中的任务 | 1 | 50m | 0 | 4 |
| 标签 T | tags 含标签 id | 1 | 25m | 0 | 4 |
| 日程/已完成 | 侧栏不显示统计 | — | — | — | 无 |

- 数字与文本逐视图比对：除旧版把“小时/分钟”拆成两个数字节点外，文本内容、条件、格式全部一致（今日 1小时40分钟、本周 2小时5分钟、英文 1h40m）。
- 部分完成任务：`estimate=3, actualPomoNum=1` 但无专注记录时，两版都按 3×25=75 分钟计（旧版按专注记录扣减，不读取 `actualPomoNum`），确认时间来源为专注记录。
- 逾期显隐：隐藏逾期时今天 2h5/3、显示逾期时 1h40/2，新旧逐值一致。

### 默认顺序与恢复默认

- 打乱顺序（逾期 99999、明天 -30000、本周 50000、全部 -25000，自定义 A/B/child order=5/6/7）后重启：新旧清单管理显示顺序完全相同。
- 点击“恢复默认排序/恢复默认顺序”后：新旧显示顺序完全相同（逾期、明天、本周、未来7天、高/中/低优先级、已计划、全部、待定、日程、已完成、清单A、清单B、子清单C）；IndexedDB 中 20 条项目的 `order` 逐项相等，自定义清单 order 保持用户值。
- 清单管理默认初始顺序与旧版一致：预设组在前、自定义清单按 order 在后；文件夹、标签、今日/任务/搜索不在列表内。

## 验证

- `npm run typecheck:standalone` 通过。
- `npm run build:standalone` 通过。
- `node --test tests/standalone/*.test.cjs`：59/59 通过（含 `business-services` 的 tasksInView 与旧版 oracle 逐类型比对）。
- `FOCUS_STANDALONE_ENGINES=chromium FOCUS_RESTORE_SHARED=1 node tests/standalone/workspace-browser.cjs`：20/20 通过。
- `FOCUS_STANDALONE_ENGINES=chromium node tests/standalone/sidebar-interactions.cjs`：PASS（zh-CN）。

## 剩余与边界

- 系统清单名称仍有差异（不在本轮统计范围）：旧版“过期/未来7天/全部”，新版“已过期/未来七天/所有任务”。
- 摘要区几何仍有既有差异：旧版条目 241×65、新版 237×58（左侧 298 vs 300），非本轮统计内容，未调整。
- “已完成/日程”侧栏：旧版 DOM 保留隐藏的 `0m/0` 文本，新版不渲染；视觉一致。
- 本轮仅 Chromium 1280×900；窄屏、Firefox/WebKit、拖拽与手动排序未回归（按约束不优化）。
- 历史/日程属于独立页面，摘要结构未纳入本轮对照。

本轮 WIP 提交只包含 W3 源码与本记录；`docs/BACKLOG.md`、`standalone/features/workspace/Projects.tsx` 中上一轮动画改动、window-scroll 文档/测试仍未提交，保持原状（Projects.tsx 仅暂存本轮 3 行改动）。

## 临时目录

本阶段临时目录 `.agent-temp/d-v-workspace-w3/` 已清理，检查确认不存在。
