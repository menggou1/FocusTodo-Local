# 7.1.1-local.1.4.2 — 启动、字体与功能整合正式发布

[更新记录](../CHANGELOG.md) · [维护指南](MAINTENANCE.md) · [1.4.1 实现记录](UPDATE-7.1.1-local.1.4.1.md)

日期：2026-10-26（Asia/Shanghai）。作者：Lexible。官方基础版本 `7.1.1`，本地版本及注释 Tag 为 `1.4.2`，应用显示版本为 `7.1.1-local.1.4.2`。

## 交付内容

本版将 1.4.1 已实现并通过完整 CI、线上验证的本轮改进正式封装发行：

- 内联骨架与真实步骤进度先显示，必要资源与数据恢复就绪后进入应用，图片和字体继续加载；慢加载和失败时提供说明与重试。
- 中文使用附带 Noto Sans SC 并在加载后自动应用；英文优先系统西文字体，番茄钟字体与归档官方版一致。
- 身份/存储、备份界面、设置兼容和主题界面按功能归入现有服务，网络保留独立职责，入口按原顺序安装且可重复调用。
- 版本元信息、HTML 缓存参数、更新条目、main、注释 Tag、正式 Release 和 Pages 使用一致的 `1.4.2` 发布版本。

数据库保持 `PomodoroDB6` v3。便携运行不需要 npm 依赖；启动方式与浏览器存储地址保持原规则。

## 发布产物

[GitHub Release 1.4.2](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.4.2) 提供 `FocusTodo-1.4.2.zip`、`FocusTodo-1.4.2.tar.gz` 和 `SHA256SUMS.txt`。Windows、macOS 和 Linux 均使用同一套静态应用；解压后使用原启动器。

正式 Tag 工作流要求提交属于 main、Tag 与 `release.json.localVersion` 一致，并经过三系统 Node.js 22/24 的检查。Pages 通过 main 的官方 Actions 白名单产物工作流发布，版本与来源提交写入线上 `deployment.json`。

## 验证依据

实现及本地隔离回归记录见 [1.4.1 报告](UPDATE-7.1.1-local.1.4.1.md)。1.4.2 的发布验证覆盖版本一致性、便携包解压启动与文档链接、完整 CI、已发布附件的 SHA256，以及 [线上 Pages](https://menggou1.github.io/FocusTodo-Local/) 的版本、来源提交和中英文实际启动。
