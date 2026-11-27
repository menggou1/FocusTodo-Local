# 日程专项第三轮验收

2026-11-27（Asia/Shanghai）。基准为远端 dev `e87c02b23d807951500db92df49f7f0c22f5486e`。在当前隔离构建上使用随机回环端口、临时浏览器配置和合成数据。

修改产品源码前，从日程起始页操作复现两处失败。展开任务侧栏并点击顶栏正中空白，侧栏保持展开。在日视图从 14:20 拖至 15:20，输入故障截图里的 `jyfpqglk`，点击确认。已保存卡片显示时段、运行按钮和经过卡片的红色现在时刻线，与故障截图路径对应。Chromium 实际截图与同一张卡片仅解除标题裁切后的图对比，四组语言和主题分别检出 5、26、25、16 个差异像素。差异集中在下伸部。仅拓宽上下裁切边界的中间构建仍复现 `j` 的左钩裁切，因此最终同时处理左边缘。

以下截图路径相对验收 ZIP。第 1、2、5、6、7 项沿用已有、已审阅的基线截图；第 3、4 项使用本轮修改前的复现图。

## 1. 加号与任务文字

在日视图点击加号，在 1280px 及紧凑窗口观察两类时间轴卡片、侧栏任务文字以及开关的位置，另外打开详情核对关联任务文字。关注按钮不压住这些文字以及 375px 的时间槽仍能接收拖入。对应 [日程布局及标题样式](../../standalone/styles/legacy-calendar-reports.css)。

通过。审阅 375px 截图时计划和专注卡片标题换行，开关与时间轴、侧栏文字分开。桌面详情的关联任务名在开关下方。原拖入用例的真实写入仍通过。

- 基线 `before/existing/rework-chromium-zh-CN-light-01-toggle-375.png`
- 本轮 `after/rework-chromium-zh-CN-light-01-toggle-375.png`、`after/rework-chromium-zh-CN-dark-01-toggle-with-details.png`

## 2. 两类记录的删除确认

分别点击日程卡片和专注记录卡片，从详情底部点删除。观察两种确认文案，再分别取消和确认。检查对话框出现之前和取消后目标记录保持原值，确认后只有目标记录删除，其他记录与任务仍保留。对应 [Calendar](../../standalone/features/workspace/Calendar.tsx) 的 `removeCalendarRow` 与 [RecordEditor](../../standalone/features/workspace/RecordEditor.tsx) 的详情删除入口。

通过。截图显示「删除此日程？」和「删除此专注记录？」各自的确认窗口。每条记录确认前后及取消后的状态均经 IndexedDB 核对。

- 基线 `before/existing/rework-chromium-zh-CN-dark-02-confirm-Schedule.png` 和同前缀的 `02-confirm-Pomodoro.png`
- 本轮 `after/rework-chromium-zh-CN-dark-02-confirm-Schedule.png` 和同前缀的 `02-confirm-Pomodoro.png`

## 3. 两个侧栏的内外空白和退场

分别打开任务侧栏或日程详情，点击 08:30 空槽排除卡片和其他控件，再各自打开并点击顶栏正中非交互空白。基线的任务侧栏只在点空槽后关闭，详情两处均可关闭。对应 [Calendar](../../standalone/features/workspace/Calendar.tsx) 的 `dismissOnBlank` 和 `blank`。新增外围入口调用原有的 `setPane(false)`，侧栏宽度、按钮和图标的过渡由原 [CSS](../../standalone/styles/legacy-calendar-reports.css) 执行。

通过。两种侧栏在表格内外四个操作中均实际关闭。任务侧栏在中间帧继续可见，宽度从 420px 连续收至 0，CSS 宽度过渡为 220ms、ease-in-out。详情关闭后，桌面时间轴由 340px 右侧留白逐步回到 0。保留选择器操作期间的详情面板和原反向过渡。

- 基线 `before/reproduction/chromium-03-task-outside-open.png`、`chromium-03-task-outside-result.png` 与同目录的详情和表内图。
- 本轮 `after/chromium-03-task-outside-open.png`、`chromium-03-task-outside-result.png` 与同目录另外三组开、关截图。逐帧数据为 `after/<引擎>-03-exit-traces.json`。

## 4. 实际字形裁切

从截图里的日程时段操作，在时间格拖出 14:20–15:20 后逐键输入 `jyfpqglk`，观察原输入和草稿，点确认后检查带播放按钮的已保存卡片。保存前日程表无记录，保存后核对名称、起止和 3600 秒时长。工作区选择「待定」后键入 `jgy pq` 的独立操作也保留验证。对应 [日程标题样式](../../standalone/styles/legacy-calendar-reports.css) 的裁切盒与 [RecordEditor](../../standalone/features/workspace/RecordEditor.tsx) 的快建入口。

截图对照保持同一引擎、卡片位置、字形、字号及时间行，只为对照图解除标题元素的 `overflow`。比较实际 RGB 像素，检查下伸部及 `j` 左钩。透明或模糊的裁切边缘不会被文字是否存在的断言替代。

通过。已审阅输入、草稿和带时段及播放按钮的保存后截图。三引擎各四组语言主题，草稿与保存卡片的两组裁切对照均为 0 差异像素，共 24 对，保存的字串和 14:20–15:20 时间完整。工作区待定任务提交后截止值为 0。

- 用户截图 `before/user-report.png`。本机复现 `before/reproduction/chromium-04-zh-CN-light-saved-card.png`。
- 本轮 `after/chromium-04-zh-CN-light-while-typing.png`、`chromium-04-zh-CN-light-draft-pixels.png`、`chromium-04-zh-CN-light-saved-card.png`。同目录包含四组语言主题的像素对照图和测量 JSON。

## 5. 任务列表与统一滚动条

从加号展开实际任务列表，先观察 3 条任务和底部留白，再加载 27 条任务并滚轮滚动，通过共享滚动条拖至第 27 条。对照 [Calendar](../../standalone/features/workspace/Calendar.tsx) 的 `data-local-scroll`、[LegacyScrollbars](../../standalone/features/workspace/LegacyScrollbars.tsx) 和 [任务列表样式](../../standalone/styles/legacy-calendar-reports.css)。

通过。短列表三行贴顶部排列，间距 12px，底部留空且无滚动条。长列表出现项目统一滑块，停在底部时最后一项可见。

- 基线 `before/existing/rework-chromium-zh-CN-light-05-short-list.png` 与同前缀的 `05-overflow-thumb.png`
- 本轮 `after/rework-chromium-zh-CN-light-05-short-list.png` 与同前缀的 `05-overflow-thumb.png`

## 6. 统一视图下拉

打开「日」下拉，观察项目统一选中标记和排列，鼠标选周、键盘选月、再切回日，检查网格随实际选择变化。对应 [Calendar](../../standalone/features/workspace/Calendar.tsx) 的 [SettingsSelect](../../standalone/features/workspace/SoundSettings.tsx)。

通过。菜单显示统一的选中标记，实际切换分别显示周的 7 列、月的 42 个日期单元，再回到日视图。

- 基线 `before/existing/rework-firefox-en-dark-06-shared-view-menu.png`
- 本轮 `after/rework-firefox-en-dark-06-shared-view-menu.png`

## 7. 返回当天

用上一期离开当前日期，再点击「回到今天」或 “Back to Today”。检查日期回到 11 月 12 日，日程标题及侧栏继续使用原义的「今天」或 “Today”。对应 [Calendar](../../standalone/features/workspace/Calendar.tsx) 顶部按钮及 [翻译源](../../public/i18n/local-en.json)。

通过。中英文均从模拟的 11 月 11 日返回 11 月 12 日。截图中顶部返回按钮和日程标题分别保留各自的文案。

- 基线 `before/existing/rework-webkit-en-dark-07-back-to-today.png`
- 本轮 `after/rework-webkit-en-dark-07-back-to-today.png`、`after/rework-chromium-zh-CN-light-07-back-to-today.png`

实际操作使用 Windows 的 Chromium、Firefox 和 WebKit。最终定向套件每引擎 21 项通过。已审阅各项对应截图，复核三引擎的字形裁切对照和两类侧栏退场。真实 Safari 和用户实机复核保留在 BACKLOG E26。
