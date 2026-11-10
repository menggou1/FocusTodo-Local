# D-V Timer 收展、返回、任务卡片及统一选择机制

基于本地 WIP `8b4487d`。旧版为 Tag `1.9.3`，已核对当前 `src/`、`public/` 及旧服务器文件相对该 Tag 无差异；原审计引用 `f102da8` 的这些运行文件与 Tag 也相同。浏览器对照仅使用 5513 / 5511、独立上下文和合成数据，Chromium、1280×900、DPR 1、正常 motion。未访问 5500，未推送、合并或发布。

## 本轮结果

| 项目 | 修复前 | 本轮结果及依据 |
|---|---|---|
| 小组件收展 | 卡片保持原 x 坐标，收缩的滚动视口从左侧裁掉内容，形成擦除分界 | module 674/26、WidgetView/ScrollView 的真实布局表明，内容最小宽度为 330px。新版恢复该约束，宽度仍为 432↔26px、150ms linear；先消耗右对齐空白，随后卡片和按钮整体向右移。75ms 时旧新轨道 x=1051、width=229，内容保持 330px；没有延长动画或隐藏卡片。 |
| 内容恢复及快速反向操作 | 展开后 effect 再挂载内容，另有一轮呈现；保存期间直接丢弃点击 | 与旧版同一帧挂载，收起保留内容 150ms 后卸载；反向操作取消旧卸载定时器。使用最新意图和串行偏好写入，已到达按钮的操作即时生效，保存失败回滚。缓存不变卡片元素，移除仅为 aria-busy 引发的重复渲染；仅跳过计时隐藏轨道和纯轨道 DOM 变化引发的无关几何读取，不改变滚动条外观。 |
| 返回时背景遮挡 | 原生全屏 dialog 退出后，浮动容器 z-index=2，低于工作区顶部的 5；动画类也可能随一次重渲染消失 | 按 Timer-root 的 800 恢复层级，退出状态保持完整 250ms；保留 ease 的尺寸/位置过渡和 ease-in 的内容淡入，没有取消动画或延迟整页。0/50/125/200/249ms 检查背景和顶部命中，旧新均未被遮挡。 |
| 返回中控件与背景运动 | 新版控件垂直居中于正在收缩的背景，旧版固定在顶部 58px 表格内 | 只修正该计时返回路径及其浮动终点布局：时钟相对背景 y=9、按钮 y=16、任务文字的真实行框均与旧版匹配。恢复旧动作单元格溢出的 5px、暂停按钮 6px 间距及对应任务内容宽度。空闲、运行关联任务、暂停关联任务的五个中间进度逐项核对。 |
| 任务图标、数值组合 | flex gap 加混合文本空格，实际数、预估数和分隔符继承同一红色 | 恢复独立的图标、数值、分隔符节点。纯图标列表使用 img 包装和 2px 间隔，带数值图标使用背景资源、top margin 1px；数值 margin-left 1px，分隔符左右为 2px/1px。实测两种图标盒子都是 12×12，不凭视觉将其放大。`5.5 / 8` 组合宽 57.296875px；整数及已完成样本为 47.21875px，旧新相同。 |
| 字体、字形与状态色 | 数值组合行框与旧版不同；中央任务番茄区被强制设成 0 字号行框 | 普通任务标题 #fff，完成态 #aeaeae / 暗色 #8f8f91 并删除线；实际数 #fd5553、预估数 #ffd9d8、分隔符为主题辅助色。字体家族和字体资源原本一致，继续使用 Focus Noto Sans（同一 NotoSans-Variable.ttf），没有替换字体。标题 14px/20px、数值 12px；右侧数值行高 14px，中央为 12px。module 1049 实际生成的番茄父容器类名为空，中央区按真实运行时继承 14px/20px，未照着未生效的 CSS 类猜测。中英字符实际渲染字体另用 DevTools PlatformFonts 比较。 |
| 全应用误选与原生图片拖动 | 仅计时器设 user-select 和 WebKit 图片限制，其他页面和 Portal 不一致 | 撤销计时局部限制，建立集中 interactions.css 和 AppInteractions。仅对应用根及标记的 Portal 根设置默认不可选择，显式覆盖原生 dialog 的默认可选择规则；不设置 document/body 的 user-select。input、textarea、contenteditable（包括 plaintext-only）、data-selectable 保留选择。错误说明、备份错误、联系地址和版本等复制区域明确标记。 |
| 图片与合法拖拽 | 未标记的装饰图片在 Firefox 等可启动原生拖图 | 统一补充装饰图片 draggable=false，保留显式 draggable=true；配合 -webkit-user-drag。独立迷你窗口复用相同 CSS 和图片属性机制。没有注册拦截全部 selectstart/dragstart 的处理，未更改任务、清单、文件夹或小组件的排序服务。 |

旧版选择规则依据：`src/main.css` 的 html 默认 none 和可编辑例外、`src/local-controls.css` 的文字例外、main.js 的图片 draggable:false，以及 module 1005 仅连接到合法拖拽源的 selectstart/dragstart 处理。新版用集中 CSS 和属性恢复语义，没有复制旧拖拽库到独立架构。

## 性能实测与边界

同一浏览器、双方均运行、20 项相同任务（五种状态 + 15 项滚动负载）、每轮六次收展，交替测试顺序。三轮轻量采样没有录像、Trace 或 CPU Profiler；取消上一轮 RAF，避免连续测试重复采样。

| 轮次 | 旧版最大 / P95 帧间隔 | 新版最大 / P95 帧间隔 | 超过 34ms 的帧：旧 / 新 |
|---|---|---|---|
| 1 | 41 / 24ms | 70 / 57ms | 1 / 9 |
| 2 | 37 / 20ms | 66 / 45ms | 1 / 10 |
| 3 | 27 / 22ms | 77 / 42ms | 0 / 7 |

**收展运动方式已修正，流畅度仍未达到等价。** 前次 48ms / 24ms 与本轮的任务负载及采集方式不同，不将二者差值作为性能改善结论。

另取一轮完整 Trace（含 cc 合成事件）和 CPU 栈：旧/新 Layout 约 39.3/29.7ms，Paint 224.5/311.5ms，Script 108.5/566.6ms；合成线程 ScheduledActionDraw 88.1/74.6ms。React root commit 为 101/37，次数少并不代表开销小。CPU 主要热点为偏好保存触发的 App.taskRow / Workspace 重建，其次是计时模块和任务行 JSX。旧版使用生产包、新版按要求保留 Vite/React 开发预览；不能归咎于同一个浏览器，也没有为了性能改写主工作区或业务服务。Trace/Profiler 本身放大长帧，因此其最大帧间隔不作为体验指标。完整压缩 Trace 和原始数字保留在忽略目录；后续状态仅在 BACKLOG E09 维护。

## 验证

- 收展与卡片：中文/英文 × 明/暗四组，五种任务状态；真实指针操作，实际 RAF 中间几何、按钮随动、完整视口、滚轮滚动、点击启动；快速连续点击核对实际命中次数、内容挂卸和最终偏好。额外验证保存中的两次已送达操作及保存失败回滚。
- 返回：四组运行关联任务，以及空闲和暂停关联任务；五个进度检查整体和内部控件矩形、文字 Range 及背景命中。两段实际连续动画另行录制，不从静态起止图推断中间过程。
- 中央卡片：纯图标/带数值、明暗主题；字体、颜色、行框、图标及总宽逐元素比较；中英字符的实际 PlatformFonts 及字体加载状态一致。
- 统一交互：Chromium / Firefox / WebKit 均以实际鼠标验证工作区、侧栏、任务详情、弹窗、Portal、计时器非编辑区域不误选；原生键盘复制后粘贴验证 input、备注、弹窗输入框；contenteditable 可选，真实联系文字及嵌套复制区可选，装饰图片不发起拖图，原生任务拖拽保留。
- 既有回归：三引擎任务编辑/排序/跨清单拖动及计时/恢复/自动休息 15/15；服务与原子持久化/偏好/任务事务 20/20；小组件编辑、实际拖动/键盘排序、取消/保存/重载回归通过；上一轮标题、标记、小时分钟和记录块四组回归通过。
- 类型检查及 standalone 构建通过，保留已有的大 chunk 提示。系统级原生 PiP、全应用逐像素及全部尺寸验收不由这些局部结果推定通过。

## 文件和留档

计时源码：`Timer.tsx`、`TimerWidgets.tsx`、`LegacyScrollbars.tsx`、`legacy-timer.css`、`timer-widgets.css`。

统一机制：新增 `AppInteractions.tsx`、`interactions.css`，在 `App.tsx` / `app.css` 接入；`Sidebar.tsx`、`TaskContextMenu.tsx`、`MenuSubmenu.tsx`、`SoundSettings.tsx` 仅标记独立 Portal；`Context.tsx`、`Dialog.tsx`、`Settings.tsx`、`ErrorBoundary.tsx` 仅增加可复制区域标记。迷你 Portal 在 Timer 内复用同一机制。

专项测试：新增 `app-selection.cjs`、`timer-rail-cards.cjs`、`timer-selected-cards.cjs`、`timer-return-states.cjs`、`timer-rail-trace.cjs`、`timer-motion-evidence.cjs`；`workspace-browser.cjs` 增加固定 5511 复用入口，`timer-refinement.cjs` 增加证据目录和关闭非必要截图的选项，没有弱化断言。

留档在 `dist/acceptance/d-v-timer-rail-cards/index.html`：共六张完整视口图、两段 3 秒动画、DOM/样式/几何 JSON、性能统计及两份压缩 Trace。字体留档使用五种任务数据；滚动/性能用相同的 20 项数据。所有图像、视频、Trace、构建和缓存均不提交。

原有未提交 `Projects.tsx`、窗口专项文档/测试及其 BACKLOG 段落保持原样，不纳入本次 WIP。WIP 只保存进度；性能仍有差异，最终 UI 验收权保留给上位机和用户。
