# Codex 交接：FocusTodo 重构 S3

交接时间：2026-11-09（Asia/Shanghai）  
交接状态：**S3-02C1R 已完成，等待上位机审核；不要自行进入 C2 或 D-V。**

## 1. 当前分支、阶段与工作区状态

- 分支：`refactor/standalone-app`
- HEAD：`171e83495a7fec3d4cc0f2a6f14600ee77884bab`（`feat(standalone): complete phase D functionality and hand off human review`）
- 远端跟踪：`Focustodo-local/refactor/standalone-app`，本地 ahead 5
- 当前阶段：S3 分批交互迁移，已完成至 **S3-02C1R**
- 工作区：**dirty，包含大量 S2 之前已存在的 D 轮未提交修改**。本次交接不清理、不暂存、不提交。
- 本轮结束时没有运行中的测试服务器；`5511`、`5513` 均为 FREE。
- `127.0.0.1:5500` 是稳定版，整轮开发中未访问、未刷新、未操作、未停止。

## 2. S3-01 至 S3-02C1R 完成情况

| 阶段 | 内容 | 状态 |
|---|---|---|
| S3-01 | W-01：任务行整行点击选中、名称/控件事件传播、打开详情 | 完成并通过审核 |
| S3-01R | 任务标签普通点击改为选中任务并打开详情；保留标签按钮/keyboard 可访问性；不再跳转标签视图 | 完成并通过审核 |
| S3-02A | 任务右键菜单入口、遮罩、定位/边界、250ms 入场与 120ms 实际退场、优先级分组、Escape/焦点恢复 | 完成并通过审核 |
| S3-02B | 预计番茄分组：旧版 130×34 选择器、加减/滚轮/数字输入、0–1000 边界、mouseleave/Enter/关闭保存 | 完成并通过审核 |
| S3-02C1 | 截止日快捷分组：Today/Tomorrow/Next week/Someday；旧版日终本地时间；行/详情同步；零日期行隐藏 | 普通任务通过；重复任务语义待修，故有 C1R |
| S3-02C1R | 重复任务日期语义：Today/Tomorrow/Next week 写 `rFirstDeadline`；Someday 清空重复字段；并发最新快照+expected；连续修改测试 | 完成，等待审核 |

C1/C1R 已确认的旧版日期规则：

- Today = 当天本地 `23:59:59.999`
- Tomorrow = 本地 +1 个日历日，日终
- Next week = 本地 +7 个日历日，日终；不是下一个 ISO 周
- Someday = `0`
- 重复任务非零日期：`deadline` 与 `rFirstDeadline` 同步，其他重复字段保持
- 重复任务 Someday：`deadline=0`、`rFirstDeadline=0`、`rCycle=0`、`rUnit=''`、`rValue=''`、`rId=''`；`rStartDate/rEndDate` 不变
- 旧版不因这些日期快捷操作增删任务、子任务或重复实例

## 3. 已修改与新增的关键文件

### 3.1 本次 S3 工作新增

- `standalone/features/workspace/TaskContextMenu.tsx`
  - 右键菜单 Portal/定位/遮罩/动画
  - 预计番茄、截止日快捷项、优先级
  - `updateTaskWith`：队列内读取最新快照并以完整当前记录作为 `expected`
  - 重复任务日期补丁、连续修改合并、失败交由 Workspace Context 报错
- `standalone/styles/legacy-context-menu.css`
  - 旧版菜单几何、z-index、250ms/120ms 动画、预计番茄与截止日行样式
- `docs/plan/CODEX-HANDOFF.md`（本文件）

### 3.2 本次 S3 工作修改（与既有 D 修改混合在同一文件）

- `standalone/features/App.tsx`
  - 任务行点击选中（W-01）、标签点击选中（S3-01R）
  - 右键/键盘打开菜单、菜单状态、关闭后焦点恢复、渲染 `TaskContextMenu`
  - `deadline=0` 时不渲染任务行日期
- `standalone/styles/app.css`
  - 仅新增 `@import './legacy-context-menu.css';`（位于文件末尾）
- `tests/standalone/workspace-browser.cjs`
  - W-01、标签、右键菜单、预计番茄、连续修改、截止日、重复任务、并发/失败处理回归场景

### 3.3 已存在但**不是**本次 S3 修改的内容

以下为 S2 之前 D 轮已存在的工作树改动，Codex 不得当成 S3 变更清理或覆盖：

- tracked modified（示例）：`docs/BACKLOG.md`、`docs/en/BACKLOG.md`、`docs/plan/2.0.0.md`、`docs/en/plan/2.0.0.md`、`standalone/features/workspace/{Calendar,Dialog,Forest,ProjectIcon,Projects,RecordEditor,Reports,Settings,SoundSettings,TaskDetails,Timer,Updates}.tsx`、`standalone/services/{application.mjs,business.mjs,core.d.mts,preferences.mjs}`、`standalone/shared/workspace.ts`、`tests/standalone/{browser-acceptance,business-services.test,domain-pages,legacy-oracle}.cjs`
- untracked（示例）：`standalone/features/workspace/{LegacyIcon,Pickers,TaskName}.tsx`、除 `legacy-context-menu.css` 外的 `standalone/styles/legacy-*.css`、`docs/plan/2.0.0-ui-*.md`、`tests/standalone/{ui-restore-helpers,visual-*,inspect-*,subtask-batch-services.test,backup-inspection-services.test}.cjs`、`tests/manual/` 等
- 精确清单以 `git status --short` 为准。**不要**执行 `git clean`、`git reset`、`git checkout`、`git stash`、`git add` 或 `git commit`。

## 4. 测试与结果

最后一次完整验证（代码未在交接文档生成后再修改）：

| 命令/范围 | 结果 |
|---|---|
| `npm run typecheck:standalone` | 通过 |
| `npm run build:standalone` | 通过 |
| W-01 + 全部右键菜单场景，Chromium/Firefox/WebKit | **21/21 通过**（7 场景 × 3 引擎） |
| 重复任务日期字段，三引擎 | **3/3 通过** |
| 并发字段保护 + 注入保存失败，三引擎 | **3/3 通过** |
| 工作区全量，Chromium | **20/20 通过** |
| `npm test` | **92 通过，0 失败，1 跳过**（Windows 上 POSIX wrapper 已知跳过） |

旧版 5513 × 新版 5511 对照（Chromium 151，独立 context，合成数据，固定 `2026-11-30 23:30 Asia/Shanghai`）：

- 非重复任务：Today/Tomorrow/Next week/Someday 的 deadline epoch 完全一致。
- 重复任务：
  - Tomorrow/Today/Next week：`deadline` 和 `rFirstDeadline` 一致；`rCycle=2`、`rUnit='days'`、`rValue='1,3'`、`rId='repeat-chain'` 均保留。
  - Someday：`deadline/rFirstDeadline/rCycle` 为 0，`rUnit/rValue/rId` 为空，旧新一致。
- 连续修改：预计番茄、优先级、截止日期连续提交后三者均保留。
- 并发：第二页修改任务名称后，第一页菜单改截止日，名称保留、deadline 更新、无错误提示。
- 失败：注入 IndexedDB `put` 失败后出现错误提示，deadline 保持原值，没有虚假成功。

旧版对照脚本为临时脚本，未放入仓库；持久回归入口是 `tests/standalone/workspace-browser.cjs`。

## 5. 尚未验证的内容

- 旧/新对照只在 Chromium 完成；新版规则已在 Firefox/WebKit 跑回归，但未做对应旧版浏览器对照。
- 任务行、详情、菜单的完整视觉/截图对照未重新做；本轮主要断言数据、DOM 状态、几何和交互。
- 活动计时中修改日期后，计时器选中任务/详情 display 的刷新未纳入断言。
- 任务详情日期选择器的重复字段同步**未修复**：C1R 只处理任务右键菜单快捷日期；详情 `DatePicker` 仍可能只写 `deadline`。
- 全量 `prefers-reduced-motion`、真实 Safari、真实用户 Profile、真实备份/数据未验证。
- 用户人工视觉审查（D-V）未开始，且本轮不得进入。

## 6. 遗留问题与风险

1. **W-02 仍未完成**：自定义日期（C2）、移动到项目、标签、删除、已完成任务菜单尚未迁移。
2. **重复任务日期语义只在右键快捷菜单等价**；任务详情日期入口仍是缺口，需另立任务或纳入后续修复。
3. 菜单目前只渲染已迁移分组；整体高度/分组数量仍小于旧版完整菜单，不能宣布 W-02 完成。
4. 旧版菜单无 Escape/焦点恢复；新版保留可访问性增强，不要求恢复旧缺陷。
5. `standalone/features/App.tsx`、`standalone/styles/app.css`、`tests/standalone/workspace-browser.cjs` 同时含有既有 D 修改和 S3 修改，评审时看具体区段，不要按“整文件属于 S3”处理。
6. `TaskContextMenu.tsx`/`legacy-context-menu.css` 是 untracked；交接时不要误删。
7. 旧版源码为压缩 bundle；引用时使用模块号/偏移，例如 TaskItem 模块 586、`updateDeadlineOfTask` 偏移约 272362。
8. 当前工作区未提交修改很多；任何 reset/checkout/clean 都可能破坏既有 D 工作。

## 7. 下一阶段 S3-02C2 的任务范围

**只做旧版自定义截止日子菜单，不要做其他 W-02 分组。**

旧版证据：TaskItem 菜单中 `tsk_deadline_custom` 为 `isParent:true`，`submenu` 使用 `DeadlineSelection`，并传 `valueChange=P.updateDeadline`、`deadline=task.deadline`、`shortcutHidden:true`、`actionsHidden:true`。

C2 范围：

- 在现有 `TaskContextMenu` 截止日分组中恢复 `Set due date` 父项/子菜单入口；不得创建假按钮。
- 复用旧版 `DeadlineSelection` 的日期/时间选择结构；先复核其实际 DOM、控件行为、Remove/OK、边界和关闭时机，禁止按常见日期选择器推测。
- 与现有 `updateTaskWith` 连接：自定义非零日期仍走重复任务 `rFirstDeadline` 同步；Remove/0 仍走完整重复字段清理；普通任务仅改 deadline。
- 保持菜单定位、hover、子菜单边界、动画、点击外部/Escape、焦点恢复；子菜单应使用旧版 ContextMenu/Submenu 几何与 250ms/实际退场参数。
- 不实现移动项目、标签、删除、已完成任务菜单；不修改计时事务、删除或重复规则的其他操作。
- 测试至少覆盖：旧/新 5513/5511 对照、已有截止日回显、Today 之后自定义日期、跨月/跨年、重复任务非零/移除、连续预计番茄/优先级/截止日修改、外部/ Escape/焦点、W-01 与菜单既有回归。
- 完成后停止等待审核，不进入其他 W-02 子任务或 D-V。

## 8. Codex 接管第一步建议

1. `git status --short`、`git diff`：先确认既有 dirty 工作区，不做清理。
2. 阅读本文件及 `docs/plan/2.0.0-ui-timer-forest-evidence.md`、`docs/plan/2.0.0-dr.md` 的相关历史证据，但不要用这些替代旧源码核对。
3. 仅在获得任务授权后启动隔离环境；先检查 5511/5513 是否占用，不得回退 5500。
4. 运行 `npm run typecheck:standalone`、`npm run build:standalone`、`node tests/standalone/workspace-browser.cjs`、`npm test` 建立本轮基线。
5. 完成 C2 或接到新指令后停止；不得自行进入 D-V 或其它阶段。
