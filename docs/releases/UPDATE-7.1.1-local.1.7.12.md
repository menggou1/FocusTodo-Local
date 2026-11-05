# 7.1.1-local.1.7.12 更新报告

[更新记录](../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [统一待办](../BACKLOG.md)

日期：2026-11-04（Asia/Shanghai）。作者：Lexible。

## 初始问题

- [Actions 41580421068](https://github.com/menggou1/FocusTodo-Local/actions/runs/41580421068) 的 Linux/macOS Node 24 日程用例点击“下个月 2 日”，却始终断言 `2026-11-02`，进入新月份后超时。
- 系统时间回退可能产生按发生顺序保存但墙上时间重叠的合法专注片段，或早于会话游标的导出日期；旧校验拒绝恢复这些备份。中断恢复选择不继续时，休息阶段仍会运行。
- Node 本地服务缺少 Host 与符号链接实际路径校验，壁纸 API 返回的直接图片地址缺少脚本级校验。
- 便携包遗漏 README 引用的设计纲领，docs 中的贡献文档也保留了根目录相对链接，导致解压文档检查失败。

## 最终行为

- 日程验收按浏览器当前年月计算目标日期，另覆盖跨年和闰年月份，保留原生日期选择、滚动、刷新和取消断言。
- 备份按实际发生顺序保留专注片段；回退后的快照进入待确认状态，负向区间不补记。拒绝继续休息会保存暂停阶段和已休息时长，重载、完整备份和跨标签恢复均延续剩余休息。
- Node 服务仅接受 loopback Host，并解析目标真实路径后拒绝目录外或受保护目录。Windows 回归使用目录联接验证相同边界。
- API 图片地址只接受 HTTPS 的精确 Bing 主机，无用户信息或非默认端口；无效响应尝试下一 API，验证发生在图片加载前。
- 便携包包含设计纲领；贡献文档同步时转换相对链接，解压后可浏览文档。

数据库仍为 `PomodoroDB6` v3。暂停的休息增加可选字段 `pausedFrom: 'rest'`；回退到 1.7.11 或更早版本前先结束该休息并备份。其余未完成工程与真实环境验收统一维护在 BACKLOG。

## 验证证据

- 原日期断言已在本机复现；当前日期、2026 年末和 2028 年 1 月末的三个原生日期选择用例通过。
- 隔离浏览器使用真实 IndexedDB 验证：时钟回退后的 120/150 秒完整备份恢复；休息暂停经重载、Gzip 备份替换及另一标签页恢复，已完成的专注记录不重复。
- 新增服务 Host、实际路径、壁纸 URL、会话校验与休息状态转换回归，保留原平台矩阵与全部业务断言。
- 本机 Windows / Node 24.16 / Edge 全量通过：72 项基础测试中 71 项通过、1 项 POSIX 专属跳过；18 项启动、64 项应用、26 项日程及并发维护、清单、音频、资料、森林、成就和提醒专项均通过。完整结果与合成数据截图保存在仓库验收目录：[应用结果](https://github.com/menggou1/FocusTodo-Local/blob/1.7.12/docs/acceptance/results.json)、[启动结果](https://github.com/menggou1/FocusTodo-Local/blob/1.7.12/docs/acceptance/startup-results.json)、[日程结果](https://github.com/menggou1/FocusTodo-Local/blob/1.7.12/docs/acceptance/calendar-results.json)。
- Python 3.12.14 的 3 项发布门禁测试通过，ZIP/tar.gz 均通过校验、含空格及中文路径解压、文档文件链接和无 npm/Git 依赖启动；不匹配版本 Tag 被拒绝。重复发布生成前后文件摘要一致，`git diff --check` 通过。

[版本标签](https://github.com/menggou1/FocusTodo-Local/tree/1.7.12) · [Release 与校验文件](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.12)。正式发布由同提交 main/Tag 六个平台组合及 Pages 门禁约束。

- 正式发布提交 `307415e3c73b8233d4b6072140c2b70ea699e8fe` 的 [main 六平台检查](https://github.com/menggou1/FocusTodo-Local/actions/runs/41809490597)、[Tag 六平台检查与发布](https://github.com/menggou1/FocusTodo-Local/actions/runs/41809550403)、[Pages 部署](https://github.com/menggou1/FocusTodo-Local/actions/runs/41809490603) 均成功。线上 `deployment.json` 与该提交一致，项目子路径下的隔离浏览器实际启动通过。
- 已重新下载实际 Release 的 ZIP、tar.gz 和 `SHA256SUMS.txt`，两份附件均通过摘要、文档链接、解压和无依赖启动检查。
