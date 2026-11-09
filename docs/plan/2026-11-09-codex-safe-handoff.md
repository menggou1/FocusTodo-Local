# 2026-11-09 Codex 安全交接

用户已紧急中止开发。以下是冻结交接事实，**不表示 D-I 至 D-IV 完成或人工验收通过**。原 `CODEX-HANDOFF.md` 保留，未覆盖。续作须先得到用户恢复指令。

## 工作树与隔离

- 目录：`D:\document\projects\Focustodo-dev`；分支：`refactor/standalone-app`。
- 全部既有和本轮未提交工作保留；未 reset、clean、stash、checkout、暂存、提交或推送。
- 三个子智能体均回报已停止写入；未发现 Git 未合并文件或源码冲突标记。按文件归属检查，未发现 agent 覆盖 root 独占文件的证据；这不等于语义集成已经通过。
- root 本轮创建的旧版5513/构建5512共用服务器 PID18132，以及开发5511 Vite PID35656，已停止。最后进程检查没有运行中的 standalone 测试；未清理临时证据或源码。
- 5500 稳定版未访问、刷新、关闭或停止；未访问正式浏览器 Profile/数据，未修改 Windows 权限。
- 源码冻结哈希保存在 `dist/safe-handoff-source-hashes.json`；所有 `dist/` 证据均为本地忽略产物，不能假定另一机器已有。

## S3-02C1R 实际程度

DeepSeek 交接宣称已完成右键快捷日期的重复语义、最新快照及 expected 保护。Codex 接管基线 Chromium 工作区20/20通过，覆盖其重复日期、连续更改、并发字段及写入失败场景；接管时服务56/56、旧单测92通过/1既有跳过。未重做其声称的三引擎旧新对照，不能据此认定完整体验等价。

本轮继续提取旧 TaskItem586、TaskActions46、TaskManager23 等实际源码，确认原日期相同即 no-op；重复任务非零日期同步 rFirstDeadline，置零仅清 rCycle/rFirstDeadline/rUnit/rValue/rId，保留 rStartDate/rEndDate。规则已抽取到 `standalone/domain/task-edits.mjs` 并用于菜单/详情；详情同步和菜单后续扩展**尚未完成最终浏览器验证**。

## 三个子智能体交接

| 智能体 | 本轮修改/新增 | 已有结果与未完成 |
|---|---|---|
| settings_dialog_restore / D-II | 新增 `SidebarModel.mjs`、`SidebarModel.d.mts`、`tests/standalone/inspect-sidebar.cjs`；未改 App | 完成旧侧栏源码及菜单/搜索取证；尚未创建 Sidebar.tsx/CSS，未集成、编译或候选验收。文件夹整行应选中，右侧箭头才折叠；搜索300ms防抖、Escape恢复原视图；拖动预览与结束提交均待实施。证据 `dist/acceptance/sidebar-audit/`。 |
| timer_forest_restore / D-III | Timer.tsx、Forest.tsx、legacy-timer.css、legacy-forest.css；新增 inspect-timer-diii.cjs | 保存英文Flip基线、float定位/悬停、分钟规则/圆圈、600ms翻页及组件动画。最后英文亮色专项退出1：成就首行旧y295.890625/新300.5；之后行高修正未复验，正常动效时间轴及完整矩阵未完成。测试/浏览器已结束。 |
| calendar_reports_restore / D-IV | Calendar.tsx、Reports.tsx、RecordEditor.tsx、legacy-calendar-reports.css、domain-pages.cjs；新增 calendar-overlay-equivalence.cjs | 保存月事件空引用、quick外侧取消、manual250ms出入、嵌套确认Escape、报表菜单Escape、260×270目标滚轮。agent停止时只确认中文两组；root只读最终 `dist/acceptance/d-iv-calendar/results.json` 后核实4组 passed=true。此为专题结果，不代表全部页面验收。 |

三者均报告无未完成文件写入。root 已中断仍显示 running 的 calendar agent，其他两个已结束；未分派新任务。

## root 本轮保存的工作

- TaskContextMenu：新增自定义日历、移动清单、mouseleave提交标签、已完成菜单及删除入口；MenuSubmenu 使用 Portal 避免 transformed 父菜单导致定位超出视口。
- 新增 TaskDeleteDialog；`business.removeTask` 增补 `repeat:'current'`，共享原完成流程的后继生成，在同一事务创建后继/子任务及删除当前任务。默认删除语义保持；core.d.mts 同步。没有组件绕开服务写库。
- 新增真实旧 manager 差分与事务回滚测试 `task-interaction-services.test.cjs`；与 business-services 共12/12通过。该结果早于后续 UI 编辑。
- TaskDetails：日期重复字段规则、外部更新与未保存草稿的协调；Pickers：自定义日期无快捷栏/按钮时立即应用、日格 aria-label。仍需重点回归并发、取消、精确提醒、子任务及记录日期选择。
- `ui-restore-helpers.cjs` 增加 `FOCUS_RESTORE_SHARED=1` 复用旧5513/新5511，`FOCUS_RESTORE_NEW_PORT=5512` 指向构建；共享模式不拥有服务器生命周期。

## 已运行验证及限度

| 范围 | 真实结果/证据 |
|---|---|
| 接管基线 typecheck/build | 通过；`dist/takeover-typecheck.log`、`dist/takeover-build.log`。不是当前最终源码产物。 |
| 接管服务单测 | 56/56，`dist/takeover-unit.log`。 |
| 接管旧单测 | 92通过、1既有跳过，`dist/takeover-legacy-unit.log`。 |
| 接管 Chromium 工作区 | 20/20，`dist/acceptance/takeover-baseline/standalone-workspace-results.json`。 |
| 新增重复删除/日期服务 + 业务回归 | 12/12，`dist/d-i-service-after.log`。包含实际旧管理器差分、事务中止、重复删除拒绝。 |
| 新增 D-I 浏览器 | **4组全部失败，退出1**，`dist/d-i-browser-recheck.log`、`dist/acceptance/d-i/results.json`；最后失败均在自定义未来日期后找不到 D-I sample。应首先检查测试仍处 Today、任务因未来日期离开当前视图；这只是待核实推断，不得删断言或声称通过。初轮还抓到 submenu viewport 错误，已改 Portal，未完成全场验收。 |
| D-IV 弹层专项 | 4/4，`dist/acceptance/d-iv-calendar/results.json`。 |
| D-III 英文亮色专项 | 退出1，成就首行位置失败；后续行高修正及全矩阵未验证。 |

最后一次全量 typecheck 通过发生于后续 MenuSubmenu Portal 和若干 agent 收尾修改之前；停止要求后没有再次构建、typecheck、全量测试或浏览器验证。构建目录**落后于源码**。

## 恢复后的优先检查（当前不执行）

1. 确认本报告后无人写入，核对 Git 差异和哈希；不要清理/覆盖现有工作。先 typecheck，修复真实错误后统一构建。
2. 复核 C1R+详情日期、未保存草稿与并发 expected，以及 removeTask.repeat=current 的活动计时、事务失败、重入及旧子任务语义；UI删除及标签退出提交尚无完整验收。
3. 修复或明确 D-I 自动化的 Today 视图前提，再完成旧新实际交互对照；日格已增加 aria-label，其他旧测试按数字找日格可能需要**保持业务断言地**适配真实可见操作。
4. D-II 仅有模型和证据，Sidebar 还未实施或集成。App 仍有文件夹整行仅折叠等已知差异；不能将计划接口当作完成源码。
5. 核验 D-III 最新修正、完整中英亮暗/普通与 reduced motion；重跑 D-IV 与完整领域回归，检查新版 Popover CSS/Portal、日期与记录共用控件的交互影响。
6. 后续仅在授权下恢复 D-I 至 D-IV；不得进入 D-V/E/F，不提交、合并或发布。人工入口须等用户恢复后重启5511/5512；5500始终排除。

## 冻结 Git 状态

以下由停止写入后原样采集，包含接管前已有改动；不能按整文件视为本轮新增。

```text
 M docs/BACKLOG.md
 M docs/en/BACKLOG.md
 M docs/en/plan/2.0.0.md
 M docs/plan/2.0.0.md
 M standalone/features/App.tsx
 M standalone/features/workspace/Calendar.tsx
 M standalone/features/workspace/Dialog.tsx
 M standalone/features/workspace/Forest.tsx
 M standalone/features/workspace/ProjectIcon.tsx
 M standalone/features/workspace/Projects.tsx
 M standalone/features/workspace/RecordEditor.tsx
 M standalone/features/workspace/Reports.tsx
 M standalone/features/workspace/Settings.tsx
 M standalone/features/workspace/SoundSettings.tsx
 M standalone/features/workspace/TaskDetails.tsx
 M standalone/features/workspace/Timer.tsx
 M standalone/features/workspace/Updates.tsx
 M standalone/services/application.mjs
 M standalone/services/business.mjs
 M standalone/services/core.d.mts
 M standalone/services/preferences.mjs
 M standalone/shared/workspace.ts
 M standalone/styles/app.css
 M tests/standalone/browser-acceptance.cjs
 M tests/standalone/business-services.test.cjs
 M tests/standalone/domain-pages.cjs
 M tests/standalone/legacy-oracle.cjs
 M tests/standalone/workspace-browser.cjs
?? docs/plan/2.0.0-ui-calendar-reports-evidence.md
?? docs/plan/2.0.0-ui-review-checklist.md
?? docs/plan/2.0.0-ui-settings-evidence.md
?? docs/plan/2.0.0-ui-timer-forest-evidence.md
?? docs/plan/2026-11-09-codex-safe-handoff.md
?? docs/plan/CODEX-HANDOFF.md
?? standalone/domain/task-edits.d.mts
?? standalone/domain/task-edits.mjs
?? standalone/features/workspace/LegacyIcon.tsx
?? standalone/features/workspace/MenuSubmenu.tsx
?? standalone/features/workspace/Pickers.tsx
?? standalone/features/workspace/SidebarModel.d.mts
?? standalone/features/workspace/SidebarModel.mjs
?? standalone/features/workspace/TaskContextMenu.tsx
?? standalone/features/workspace/TaskDeleteDialog.tsx
?? standalone/features/workspace/TaskName.tsx
?? standalone/styles/legacy-calendar-reports.css
?? standalone/styles/legacy-context-menu.css
?? standalone/styles/legacy-details.css
?? standalone/styles/legacy-forest.css
?? standalone/styles/legacy-pickers.css
?? standalone/styles/legacy-settings.css
?? standalone/styles/legacy-timer.css
?? standalone/styles/legacy-workspace.css
?? tests/manual/
?? tests/standalone/backup-inspection-services.test.cjs
?? tests/standalone/calendar-overlay-equivalence.cjs
?? tests/standalone/inspect-record-popovers.cjs
?? tests/standalone/inspect-settings.cjs
?? tests/standalone/inspect-sidebar.cjs
?? tests/standalone/inspect-timer-diii.cjs
?? tests/standalone/inspect-workspace-popovers.cjs
?? tests/standalone/subtask-batch-services.test.cjs
?? tests/standalone/task-interaction-services.test.cjs
?? tests/standalone/task-interactions.cjs
?? tests/standalone/ui-restore-helpers.cjs
?? tests/standalone/visual-calendar-reports.cjs
?? tests/standalone/visual-diff.py
?? tests/standalone/visual-restore.cjs
?? tests/standalone/visual-settings.cjs
?? tests/standalone/visual-timer-forest.cjs
?? tests/standalone/widgets-services.test.cjs
```
