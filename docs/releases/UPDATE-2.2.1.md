# FocusTodo 2.2.1

[更新记录](../CHANGELOG.md) · [English](../en/releases/UPDATE-2.2.1.md)

发布日期 2026-11-28（Asia/Shanghai），作者 Lexible。本版仅冻结日程专项修复，继承已发布 2.2.0 的功能。

## 七项原始需求

1. 加号不遮挡日程卡片、任务侧栏及详情关联任务文字；375px 窄窗保留卡片换行及拖入目标。
2. 日程安排与专注记录从详情删除均弹出对应确认。确认前及取消后记录保持原值，确认后只删除目标记录。
3. 时间表内外非交互空白均可关闭任务侧栏或详情栏，保留原有 220ms 侧栏收展和详情退场。
4. 待定任务输入框保留字形下伸空间；日程快建草稿和保存卡片同时保留字形左伸、下伸，字号、字距与时间行位置不变。
5. 任务列表从顶端以 12px 间距排列；短列表留出底部空白，长列表复用统一滚动条且最后一项可达。
6. 日、周、月使用统一下拉，鼠标和键盘选择更新实际网格。
7. 返回当天按钮使用「回到今天」或 “Back to Today”，标题与侧栏保留「今天」或 “Today”。

## 最终实际验收

冻结基线为远端 dev `c96aebee718adce1cdec5b4ff564cd99086fee86`。[第三轮验收报告](https://github.com/menggou1/FocusTodo-Local/blob/c96aebee718adce1cdec5b4ff564cd99086fee86/docs/acceptance/calendar-third-round-2026-11-27.md) 记录修改前复现、实际操作、截图与逐帧/像素证据；其中 `e87c02b` 为修复前基线。第二轮未完整覆盖的任务侧栏外围关闭和已保存卡片字形裁切，以第三轮结果为准。

Windows Chromium、Firefox、WebKit 最终定向套件每引擎 21 项通过。日程草稿和保存卡片的中英明暗字形对照共 24 对，裁切差异均为 0；两类删除确认经 IndexedDB 核对，两个侧栏表内外四条关闭路径均通过，窄窗拖入实际写入通过。[dev CI #204](https://github.com/menggou1/FocusTodo-Local/actions/runs/45958591094) 在该冻结 SHA 实际完成 Windows/macOS/Linux × Node 22/24 六项矩阵、三平台 Node 24 附件与 Chromium、Linux Firefox/WebKit，以及独立 Verify CI evidence。

2.2.1 的版本元数据、词库索引及文档另形成发布提交。正式 Tag 必须指向完整 CI 和独立门禁已通过的远端 `release/2.2.1` HEAD；Tag、main 和发布后 dev 的复用须核验同 SHA 的原始六项矩阵和附件摘要，不能把 #204 当作不同 SHA 的发布证据。首次发布来源、原始运行及附件 ID/SHA-256 保存在 Actions 摘要与日志。

[正式 Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/2.2.1) · [发布分支 CI](https://github.com/menggou1/FocusTodo-Local/actions?query=branch%3Arelease%2F2.2.1) · [Tag CI](https://github.com/menggou1/FocusTodo-Local/actions?query=branch%3A2.2.1)

真实 Safari、用户实机及其他持续验证边界只维护在 [BACKLOG](../BACKLOG.md)。自动化结果不代替这些人工证据。
