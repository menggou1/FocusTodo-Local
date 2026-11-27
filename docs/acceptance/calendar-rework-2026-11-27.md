# 日程专项返工验收

第三轮复现更正：本报告第 3 项仅核对详情栏关闭，任务侧栏在表格外点空白仍保持展开。第 4 项核对的是工作区输入，保存后的 `14:20–15:20` 卡片标题仍会裁切字形。这两项的实际验收以[第三轮报告](calendar-third-round-2026-11-27.md)为准。

2026-11-27（Asia/Shanghai）。基准为远端 dev `445cbb900587e6f8d29ddcc7f3e89517c2268f48`。浏览器运行当前隔离构建，使用随机回环端口、临时上下文与合成数据。

下表逐项关联原始要求、此前遗漏、实际改动及 [calendar-rework.cjs](../../tests/standalone/calendar-rework.cjs) 的浏览器断言。已有 [calendar-fixes.cjs](../../tests/standalone/calendar-fixes.cjs) 和 [calendar-motion.cjs](../../tests/standalone/calendar-motion.cjs) 继续运行。

| 项 | 原始要求与此前遗漏 | 实际组件和源码 | 浏览器操作与断言 | 截图后缀 |
| --- | --- | --- | --- | --- |
| 1 | 展开任务栏后，加号不能压在日程任务名上。此前核对的是加号自身能否点击，以及清单标题是否留出控件空间。 | [日程布局和卡片样式](../../standalone/styles/legacy-calendar-reports.css) 让紧凑画布与任务侧栏并列，窄卡片在原字号下换行。截图另复现了加号遮挡详情关联任务名，详情内容移到按钮下方。 | 真实点击加号，比较两类日程卡片、侧栏任务名及详情关联任务名与按钮的矩形。检查画布与面板边界、字形范围、字号和实际命中，同时保留 375px 拖入及真实写入断言。 | `01-toggle-1280`、`01-toggle-375` / `600` / `820`、`01-toggle-with-details` |
| 2 | 右侧详情删除日程和专注记录都要确认。此前专注记录分支直接写入。 | [Calendar](../../standalone/features/workspace/Calendar.tsx) 与 [RecordEditor](../../standalone/features/workspace/RecordEditor.tsx) 共用确认和提交入口，按记录类型带原值执行删除。 | 分别点击日程和专注记录详情底部的删除按钮。确认前及取消后 IndexedDB 与原值完全一致，取消恢复焦点。确认后仅目标记录变为删除状态，另一类记录和任务保持原值。 | `02-confirm-Schedule`、`02-confirm-Pomodoro` |
| 3 | 表格内外的非交互空白均可关闭详情，控件及弹层可继续使用。 | 复验 [Calendar](../../standalone/features/workspace/Calendar.tsx) 的文档点击监听、空槽入口和交互例外。 | 打开详情，再实际打开并点击视图菜单当前选项，详情保持打开。点击经过命中核对的顶栏空白，详情关闭。既有用例还检查左栏空白、工具栏空白、时间空槽、内外日期及任务选择器。 | `03-before-blank`、`03-after-blank` |
| 4 | 创建待定任务时显示完整下伸字形。此前测的是日程快建弹窗及日程草稿。 | [工作区任务创建样式](../../standalone/styles/legacy-workspace.css) 为主输入框指定 22px 行高及上下留白，保留 14px 字号。 | 实际从日期选择器选「待定」，逐键输入 `jgy pq`，在提交前截图。检查输入内容区、字体实际下伸和行高。提交后检查完整名称、`deadline=0`，且无日程写入。 | `04-someday-selected`、`04-someday-typing` |
| 5 | 加号展开后的实际任务列表紧凑排列，短列表无滚动条，长列表使用共享滚动条。此前测的是顶部清单选择下拉。 | [Calendar](../../standalone/features/workspace/Calendar.tsx) 的任务列表使用现有 `data-local-scroll`，在[日程样式](../../standalone/styles/legacy-calendar-reports.css) 中固定到顶部并保留统一 12px 行距。 | 比较 3 条与 27 条任务。检查首行距顶部、相邻间距和底部空白。短列表无溢出且隐藏轨道，长列表滚轮可滚，通过拖动共享滑块到达末行。 | `05-short-list`、`05-overflow-thumb` |
| 6 | 日程视图使用统一下拉组件和选中反馈。此前实现沿用。 | [Calendar](../../standalone/features/workspace/Calendar.tsx) 继续复用 [SettingsSelect](../../standalone/features/workspace/SoundSettings.tsx)。 | 检查共享弹层、当前选中、鼠标切周、键盘切月、再切回日，核对实际 7 列和 42 个日期单元。既有用例检查选中标记的样式。 | `06-shared-view-menu` |
| 7 | 顶部只将返回当天的按钮改为「回到今天」和 “Back to Today”。此前实现沿用。 | 复验 [Calendar](../../standalone/features/workspace/Calendar.tsx) 与[翻译](../../public/i18n/local-en.json)。 | 先退到前一天，再点文字完全匹配的按钮，检查日历实际日期恢复，日期标题仍用「今天」或 “Today”。 | `07-back-to-today` |

截图和运行 JSON 由测试输出至本地验收目录。截图文件以 `rework-<引擎>-<语言>-<主题>-` 开头，后接上表文件名后缀。宽度单位为 CSS 像素。

## 实测结果

Windows 上用锁定的 Playwright 启动 Chromium 158.0.8127.18、Firefox 159.0、WebKit 27.2。最终构建中，三个引擎的七项需求在简中浅色、简中深色、英文浅色和英文深色共 12 组组合全部通过。每个引擎还通过原有的侧栏反向过渡、窄窗拖入、详情外围交互、拖动缩放与失败回滚用例。桌面和紧凑布局截图覆盖 375、600、820 和 1280px，另有既有回归覆盖 1000px。

详情顶部留白调整前，三引擎领域全量各 32 项通过。调整后，最终产物三引擎定向复验各 8 项通过。交付包包含最终构建的 156 张专项截图、最终复验 JSON 及前一构建的领域全量 JSON。真实 Safari 与用户实机复核见 BACKLOG E26。

单元测试 91 通过、1 项按既有条件跳过，服务合同 88 通过，CI 证据门禁 17 通过，发布门禁 10 通过。正式和隔离构建、两类 ZIP/tar.gz 解压启动、正式 Python 备用启动通过。Chromium 的中英文及明暗主题工作区创建回归共 4 项通过。
