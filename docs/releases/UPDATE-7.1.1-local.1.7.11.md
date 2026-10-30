# 7.1.1-local.1.7.11 — Windows 发布环境修复与维护规则

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [English](../en/releases/UPDATE-7.1.1-local.1.7.11.md)

日期：2026-10-30（Asia/Shanghai）。作者：Lexible。

## 本次内容

- 关于页提供中英文图文教程，便携包包含教程与隔离数据配图；内容承接已有候选版。
- 运行服务器和验收服务器使用 Node pipeline 发送文件，取消字体/图片下载时关闭源文件流。真实 HTTP 反例确认旧实现取消后文件流仍打开，修复后关闭，服务器继续响应。
- 浏览器验收等待实际启动完成，历史更新测试从发布配置选择条目，设置操作定位实际页头图标。日程失败的请求、页面错误、启动 DOM 和截图保存到上传目录。
- Windows CI 扩大临时 TCP 端口池并保存前后网络诊断，覆盖完整浏览器套件；不重试、不缩减平台或跳过断言。
- 新留档规则适用于整个 1.7 系列及未来版本；1.6 及以前按当时规则保留。通过 Git 恢复本次误删的全部历史报告、旧入口及原更新记录，不把它们改称不合规版本。新版本的文档链接直接指向 releases 目录。

## 本轮失败与迁移

1.7.7 本地验收暴露历史标题写死；1.7.8 暴露设置选择器不匹配实际 DOM；1.7.9 因已有截图文件占用失败，改用独立 FOCUS_ACCEPTANCE_DIR 完成全量截图和业务验收。这些本地候选没有 Tag 或 Release，不留独立报告。

[1.7.10 main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125344)六组测试与 [Pages](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125278)成功；[1.7.10 标签](https://github.com/menggou1/FocusTodo-Local/actions/runs/41048222252)在 Windows Node 24 维护并发第二场景导航出现 net::ERR_NO_BUFFER_SPACE，发布被阻止。1.7.10 标签保留，独立报告和更新项迁入本文，不创建或重跑旧版本 Release。文件流泄漏的修复不足以消除 Windows 套接字资源失败，不能把一次 main 通过当作完整发布成功。

[微软端口排障说明](https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/tcp-ip-port-exhaustion-troubleshooting)说明高频连接及 TIME_WAIT 可造成端口耗尽；本次对临时 CI runner 扩大可用动态 TCP 端口范围并记录占用，用户电脑配置不变。该环境调整与产品文件流修复分别验证，不将历史缺少现场的全部超时归为同一根因。

## 验证与发布

本地验证包括版本生成、Node 与语法、完整隔离浏览器、发布门禁、Pages 白名单、便携包及 ZIP/tar.gz 解压启动。正式留档仍须同一提交的 main 六组测试、Pages、标签六组测试及 Release 全部成功。公开结果见 [main 测试](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain)、[1.7.11 标签](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.11)和 [Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.11)。未完成验收仅在[统一待办](../BACKLOG.md)维护。

本次产品模块与通过全量本地验收的 1.7.10 相同；该次完整证据保留在 docs/acceptance/release-1.7.10。1.7.11 本地重新验证 Node（62 通过、1 项平台跳过）、语法、历史更新/通知/关于页、发布门禁和双格式便携包；新 Windows runner 配置由 main 和 Tag 的完整矩阵验证，不在日常电脑上执行。

## 失败的 1.7 候选归并

### 7.1.1-local.1.7.4 — 使用教程与文档整理

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [English](../en/releases/UPDATE-7.1.1-local.1.7.11.md)

日期：2026-10-30。作者：Lexible。

## 更新内容

- 关于页在仓库入口旁新增使用教程链接，根据界面语言打开中文或英文教程。
- 参考原版 Windows 功能介绍的章节顺序，介绍本地版任务、计时、报表、设置、日程、森林和备份；截图使用隔离测试数据。
- 整理中英文首页，移除散落的历史版本更新说明；历史报告归档到 `docs/releases/` 与 `docs/en/releases/`，原地址保留指向归档报告的链接。
- 同步元数据、生成器、打包清单及文档导航，便携包包含教程配图。

## 验收与发布

本地执行 `npm run build:release`、`npm test`、`npm run check`，Node 测试 60 项通过、1 项平台跳过；隔离浏览器筛选验收中英文关于页及教程跳转，均通过。检查 Markdown 相对文件和标题锚点；发布门禁测试 3 项通过。ZIP 与 tar.gz 在含空格和中文的临时目录解压，文档链接、启动与标签不匹配拒绝检查通过。跨平台全量测试、Pages 和发布由 GitHub Actions 执行，结果以工作流记录为准。历史报告保留各自当时的行为与证据，当前规范见维护指南。

1.7.4 的 [main 工作流](https://github.com/menggou1/FocusTodo-Local/actions/runs/41016504396)中，Windows Node 24 首屏用例等待启动状态可见超时；其余五组与 Pages 成功。没有该次失败的页面状态证据，原因未能确定；未创建 1.7.4 标签或 Release。后续使用 1.7.5 并补充诊断。

### 7.1.1-local.1.7.5 — 教程、文档整理与验收诊断

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [English](../en/releases/UPDATE-7.1.1-local.1.7.11.md)

日期：2026-10-30。作者：Lexible。

## 更新内容

- 延续 1.7.4 候选版本的中英文图文教程、关于页入口、README 清理及历史报告归档，旧报告地址保留链接。详情见 [1.7.4 候选报告](UPDATE-7.1.1-local.1.7.11.md)。
- 启动验收失败时保存页面状态、请求、失败请求、页面异常和截图；诊断有时间上限，不重试或延长原断言的等待时间。

## 验收与发布

1.7.4 main 的 Windows Node 24 首屏断言等待状态可见超时；其他五组和 Pages 成功。日志没有页面现场，不能确定根因，也未创建 1.7.4 标签。新增诊断用于下次故障取证；跨平台测试和发布结果以本版本 GitHub Actions 为准。

本地执行版本生成、语法检查和 Node 测试（60 项通过、1 项平台跳过）；17 项启动检查及中英文关于页筛选验收通过。受控注入一次失败，确认释放阻塞请求前保存页面状态、请求和截图。

[1.7.5 main 工作流](https://github.com/menggou1/FocusTodo-Local/actions/runs/41017501174)在 Windows 的另一项启动测试中未能挂载。采集到 `/js/local-app-ui.js` 请求 `net::ERR_NO_BUFFER_SPACE` 和后续模块缺失异常；其余五组及 Pages 成功。此证据不能确定 1.7.4 的根因。未创建 1.7.5 标签或 Release。

### 7.1.1-local.1.7.6 — 教程、文档与启动验收改进

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [English](../en/releases/UPDATE-7.1.1-local.1.7.11.md)

日期：2026-10-30。作者：Lexible。

## 更新内容

- 延续 [1.7.4 候选版](UPDATE-7.1.1-local.1.7.11.md)的中英文图文教程、关于页入口、README 清理及历史报告归档，保留旧地址链接。
- 启动验收仍使用真实同源服务器和外网阻断，仅拦截外部请求及需要故障注入的请求，避免为每个同源请求增加一次自动化协议转发；保持资源并行和原有断言。
- 新增 `local-app-ui.js` 加载失败后显示重试、重新加载成功且本地设置保留的受控检查。启动失败证据在释放受阻资源前保存。

## 背景与验证

[1.7.5 候选报告](UPDATE-7.1.1-local.1.7.11.md)记录 Windows 关键脚本 `net::ERR_NO_BUFFER_SPACE` 失败及未完成的发布。此结果不能推断 1.7.4 超时的根因；资源耗尽的具体来源尚待定位，追踪在[统一待办](../BACKLOG.md)。1.7.4 和 1.7.5 未创建标签或 Release。跨平台验证及发布结果以 GitHub Actions 为准。

本地执行版本生成、语法和发布元数据检查，以及隔离浏览器启动验收；18 项启动场景通过，包含模拟关键模块失败和用户重试。
