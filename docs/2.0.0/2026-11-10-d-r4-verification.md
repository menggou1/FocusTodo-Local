# D-R4 验证报告：日历、报表与跨模块集成

日期：2026-11-10（Asia/Shanghai）  
基线：`refactor/standalone-app`；WIP 检查点 `ca3154166fc0` 上的当前未提交工作树  
旧版权威：1.9.3 / A 阶段 `f102da8`  
状态：D-R4 自动化门禁通过；D-V 未开始，等待 GPT-6 审核 D-R4 后再进入逐组件视觉还原。

## 1. 范围与结论边界

D-R4 只处理：

- 日历、报表已有功能与跨模块集成回归；
- 运行错误、数据不一致、严重交互问题；
- 必要的局部视觉修复；
- 保存 D-V 所需剩余差异清单。

本轮没有推倒已有 React 主体，没有进行旧组件 AST 移植，没有进入 D-V、E、F。

## 2. 实际修复

### 2.1 暗色快速安排弹窗

视觉矩阵发现中英暗色 `quick-task` 唯一差异：

- 旧版快速安排弹窗背景：`rgb(45,45,55)`
- 新版：`rgb(26,26,32)`

已在 [`legacy-calendar-reports.css`](../../standalone/styles/legacy-calendar-reports.css) 对 `.workspace-dialog.legacy-record-quick` 增加暗色局部背景：

```css
:root[data-theme=dark] .workspace-dialog.legacy-record-quick{background:#2d2d37}
```

修复后暗色 quick 场景为 0 差异。该修复仅影响日历快速安排弹窗，不改全局主题。

### 2.2 测试前提修正（不改变业务断言）

[`domain-pages.cjs`](../../tests/standalone/domain-pages.cjs) 中发现并修正了与实际 UI 语义不一致的测试前提：

1. 手动记录日期格现在使用完整 `aria-label`（如 `2026-11-07`），旧测试仍按数字 `7` 查找。
2. 手动记录/报表场景未固定时钟，却硬编码 `2026-11-08`；现在固定 `2026-11-08 12:00 Asia/Shanghai`。
3. 顶部资料按钮打开的是 profile 菜单，不是设置页；测试改为点击菜单中的 Account。
4. Import demo 会恢复备份中的语言设置，报表周期按钮可能变成中文；测试改为中英兼容的 `Report period|报表周期` 选择。

这些修正保留原有业务断言：手动记录 30 分钟、跨午夜报表 20/30、目标持久化、记录编辑/删除等。

### 2.3 新增跨模块回归

新增场景：**日历安排启动计时 → 返回日历 → 写入记录 → 报表出现记录**。

覆盖：

- 从日历 schedule 的启动按钮进入计时器；
- 60 秒后暂停、停止、确认；
- 关闭计时器返回原日历视图；
- `Pomodoro` 记录写入；
- 报表所选日期总时长 >0。

## 3. 验证结果

| 范围 | 结果 |
|---|---|
| TypeScript | 通过 |
| Build | 通过 |
| 日历/报表视觉矩阵 | **44 个截图对，0 几何/样式差异** |
| D-IV overlay | **4/4 通过** |
| Domain pages（Chromium/Firefox/WebKit） | **33/33 通过**（11 场景 × 3 引擎） |
| 跨模块日历→计时→记录→报表 | 三引擎通过 |
| Workspace Chromium | **20/20 通过** |
| 服务单测 | **50/50 通过** |
| 旧版单元测试 | **92 通过、0 失败、1 跳过** |

证据：

- [`calendar-reports-restore/metrics.json`](../../dist/acceptance/calendar-reports-restore/metrics.json)
- [`d-iv-calendar/results.json`](../../dist/acceptance/d-iv-calendar/results.json)
- [`standalone-domain-results.json`](../../dist/acceptance/standalone-domain-results.json)
- [`standalone-workspace-results.json`](../../dist/acceptance/standalone-workspace-results.json)

## 4. 剩余差异（D-V 入口）

D-R4 日历/报表现有场景均已通过；D-V 仍需要逐组件核验的剩余项主要来自统一追踪清单：

- 任务完成动画/防重入
- 完成任务切换按钮条件显示
- 任务拖动 ghost/目标高亮
- 新建任务截止日/>5 番茄入口
- 详情空白关闭、字段顺序、子任务内联编辑
- 通知打开自动已读
- 计时 compact 停止确认、1 秒持久化节奏
- 通用 Dialog/profile/notification 动画
- 白噪音音量保存时机
- 清单管理 ghost/插入线/FLIP
- 预设清单拖拽
- 全局 hover 背景、任务行提醒/逾期/分数番茄
- 统一固定端口/origin guard wrapper

日历/报表明细：

- 视觉矩阵只使用 Chromium；Domain 功能三引擎通过。
- 报表目标日历继续保留正确日期，不复刻旧版 2026-11 首行错误；这是已确认差异。
- Import demo 恢复语言属于备份语义；不是语言切换缺陷。
- DST、真实长期库、真实系统声音/通知/PiP 未验证，仍归 V03/V04/V07。
- D-IV overlay 和 visual 矩阵的证据来自当前构建的隔离旧/新 context；像素/几何通过不等于用户视觉认可。

完整状态见 [交互等价追踪清单](2.0.0-interaction-equivalence.md)。

## 5. D-V 准备与阶段边界

已核对 [2.0.0 计划](../plan/2.0.0.md#L114-L118)：

- D-V 是经授权的集中视觉还原；前置为 GPT-6 对 D-R4 的审核。
- 旧版 1.9.3 是视觉与操作权威；保留 D 的独立架构、数据兼容和业务服务。
- 逐页执行真实功能、计算样式、几何/像素断言，注入尺寸/颜色偏差必须使检查失败。
- 不自行宣布用户认可；D-V 后仍等待最终人工审核。

拟采用方法（尚未开始执行）：

1. 用 Playwright/DevTools 提取旧版目标组件 DOM、计算样式、伪元素、动画和关键交互状态；
2. 与当前组件做局部差异定位，记录旧/新证据；
3. 只修改相关组件/局部 CSS 和事件，不进行全局视觉重构；
4. 用旧 5513/新 5511 独立 context + 合成数据验证，同时保留业务断言；
5. 拖拽/弹窗/复杂交互结合旧源码和真实鼠标操作复核；
6. 用户逐步指出差异，AI 负责源码定位、修复和回归；
7. 已一致组件不重复修改；不以局部测试通过宣称全界面 100% 一致。

D-V 实际修改尚未开始；等待 GPT-6 审核本报告及 D-R4 结果。

## 6. 安全状态

- 5500 稳定版未访问、未刷新、未操作、未停止。
- 5511/5512/5513 当前均 FREE；测试使用隔离端口、独立浏览器上下文和合成数据。
- 未修改 Windows 权限。
- 未提交、合并、推送或发布。
- 当前 D-R1/D-R2/D-R3 未提交成果全部保留。
- 未进入 D-V、E、F。
