# D-R3 验证报告：计时器、森林与动态交互

日期：2026-11-09（Asia/Shanghai）  
基准：`refactor/standalone-app` / `ca3154166fc0` 上的当前未提交工作树  
统一逐项状态与 S1/S2 历史差异见 [交互等价追踪清单](2.0.0-interaction-equivalence.md)；源码审计事实见 [S1/S2 审计归档](2026-11-09-s1-s2-audit.md)。  
状态：D-R3 的视觉/动画/森林自动化门禁通过；计时 compact 停止确认与 1 秒持久化等 S2 遗留仍未修复，因此这不是“计时器完整交互等价”结论。等待 GPT-6 上位机审核；未进入 D-R4、D-V、E、F。

## 1. 旧版源码依据与映射

| 旧版行为 | 依据 | 新版实现 |
|---|---|---|
| 浮动计时 147/232×58，底部居中；root 250ms ease-in | [`src/main.css:2483`](../../src/main.css#L2483)、[`src/main.css:2768`](../../src/main.css#L2768) | `.workspace-floating-timer`，D-III 几何 |
| 浮动 zoom-up 悬停显示；圆环 40×40 | [`src/main.css:2501`](../../src/main.css#L2501)、[`src/main.css:2535`](../../src/main.css#L2535) | `.legacy-timer-float-expand`、`legacy-floating-progress` |
| Timer root `.25s all`；浮→全屏过渡 | [`src/main.css:2751`](../../src/main.css#L2751) | `legacy-timer-expand` 关键帧 |
| Fullscreen root 250ms ease-in；内容 margin 150ms | [`src/main.css:9696`](../../src/main.css#L9696)、[`src/main.css:9727`](../../src/main.css#L9727) | `legacy-timer-surface-in`、`legacy-timer-main` |
| 关闭全屏恢复浮条，浮条 250ms 淡入 | FloatTimer root animation | 本轮补齐关闭态透明度 |
| Widget 432/26px，150ms linear，内容延迟卸载 | [`src/main.css:11562`](../../src/main.css#L11562) | `.legacy-timer-widgets` 150ms + 150ms 卸载 |
| FlipDigit 600ms linear，front 0→-180°，back 180→0° | [`src/main.css:10457`](../../src/main.css#L10457) | 现有 `.legacy-flip-*` 关键帧 |
| 森林 380×447、树/成就/攻略 | [`src/main.css:4078`](../../src/main.css#L4078) | `Forest.tsx` / `.legacy-forest*` |

## 2. 本轮实际修复

产品源码仅改 [`standalone/styles/legacy-timer.css`](../../standalone/styles/legacy-timer.css)：

- 浮动计时 root 增加旧版 250ms ease-in 淡入。
- 全屏关闭增加独立 250ms ease-in 透明度动画，与几何收起同时进行。
- 收起时禁止子元素重复淡入，避免双重透明度。
- reduced-motion 同时禁用新增的浮动 root 动画。

`Timer.tsx`、`Forest.tsx`、计时事务、计时记录和森林业务逻辑未修改。

测试侧同时修正/新增：

- [`tests/standalone/ui-restore-helpers.cjs`](../../tests/standalone/ui-restore-helpers.cjs)：`paired()` 支持 `reducedMotion`。
- [`tests/standalone/visual-timer-forest.cjs`](../../tests/standalone/visual-timer-forest.cjs)：攻略抽屉关闭等待、森林随机光球像素门禁隔离、reduced-motion 断言。
- 新增 [`tests/standalone/timer-forest-motion.cjs`](../../tests/standalone/timer-forest-motion.cjs)：正常动画时间轴。

## 3. 动画与交互证据

D-R3 motion 测试使用旧 5513 / 新 5511、独立 context、合成数据、`reducedMotion: no-preference`。

### 3.1 全屏打开/关闭

冻结 CSS 动画后，旧/新采样一致：

| 时间 | 打开 | 关闭 |
|---|---|---|
| 0ms | 147×58 @ (580,826)，opacity 0 | 1280×900，opacity 0 |
| 125ms | 1056.11×733.61 @ (114.61,163.23)，opacity 0.315357 | 370.875×224.375 @ (465.39,662.80)，opacity 0.315357 |
| 250ms | 1280×900，opacity 1 | 147×58 @ (580,826)，opacity 1 |

原关闭路径缺少整体淡出；本轮已补齐。

### 3.2 FlipClock

- 600ms、linear。
- front：identity → rotateX(-90°) → rotateX(-180°)。
- back：rotateX(180°) → rotateX(90°) → identity。
- 旧/新四个关键帧 transform 完全一致。
- 旧/新数字区均为 `900×426`，此前 427/426 高度差已复验通过。

### 3.3 小组件

- 旧/新 `transition-duration = 0.15s`。
- 新版 330px 面板在 75ms 中为 `238.281px`，随后归零；150ms 后内容卸载，重新展开后重挂。
- 旧版 root 432px 包含 26px 开关轨道；新版拆成面板 + 外置开关，静态内容几何门禁通过。

### 3.4 森林/成就

- 光球飞行 1000ms，500ms 中间帧 transform 已变化。
- 树脉冲 800ms ease-in-out。
- 英文亮色成就首行旧/新均为 `y=295.890625`、高 52px，trophy 均为 x=711/y=311.890625。
- 中英明暗四组森林场景、成就抽屉、攻略内容均通过静态/几何门禁。
- 随机光球坐标不纳入像素门禁；门禁单独验证数量、边界、收集/成长动画。

## 4. 测试结果

| 范围 | 结果 |
|---|---|
| `npm run typecheck:standalone` | 通过 |
| `npm run build:standalone` | 通过 |
| D-III 全矩阵 | **8/8 通过**（4 视觉组 + 4 功能组） |
| D-R3 motion | **1/1 通过** |
| D-R1/D-R2 工作区 Chromium | **20/20 通过** |
| D-I 浏览器回归 | **4/4 通过**，8 对截图 |
| D-R2 侧栏 smoke | 通过 |
| 服务单测 | **50/50 通过** |
| 旧版单元测试 | **92 通过、0 失败、1 跳过** |

证据：

- [`ui-restore-timer-forest/results.json`](../../dist/acceptance/ui-restore-timer-forest/results.json)
- [`d-r3/motion-results.json`](../../dist/acceptance/d-r3/motion-results.json)

## 5. 未解决与验证边界

- 动画只在 Chromium 验证；Firefox/WebKit 未做逐帧对照。
- 森林随机光球位置由随机避碰生成；像素门禁用同数据但不比较逐颗坐标，单独验证数量/边界/动画。
- 旧/新小组件绝对 rail 宽度不同（旧 432 含 26px 开关，新 330 + 外置开关）；动画时长和内容生命周期一致，静态内容几何通过。
- 真实白噪音系统播放、真实 Document PiP 窗口管理没有人工听感/系统验证；自动化只验证媒体参数、请求尺寸和单会话。
- 焦点/键盘可访问性保留，但未逐状态做截图门禁。
- **计时 compact 停止确认仍未修复**：浮动/迷你路径当前直接 `stop`，仅展开态确认；旧版三路径都先确认。D-R3 的视觉/数据功能测试不覆盖这条确认语义。
- **1 秒持久化节奏仍未修复**：当前治理为每秒 tick 事务，旧本地适配层为每秒渲染、30 秒/边界持久化；属于数据/性能差异，见追踪清单 T-01。
- 迷你窗口内的停止确认/弹窗归属未验证；现有自动化只验证单一会话写入和尺寸。
- 以上属于 D-R3 任务范围内的遗留语义，不应被“动画门禁通过”掩盖；在进入 D-R4 前需由上位机决定修复批次。

## 6. 安全状态

- 5500 稳定版未访问、未刷新、未操作、未停止。
- 5511/5512/5513 最终均为 FREE；未修改 Windows 权限。
- 未提交、合并、推送或发布；D-R1/D-R2 未提交修改全部保留。
- D-R3 验证工作结束，停止等待审核；未进入 D-R4、D-V、E、F。
