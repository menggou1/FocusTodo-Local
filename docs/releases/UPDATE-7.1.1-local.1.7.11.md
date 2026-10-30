# 7.1.1-local.1.7.11 — Windows 发布环境修复与维护规则

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [English](../en/releases/UPDATE-7.1.1-local.1.7.11.md)

日期：2026-10-30（Asia/Shanghai）。作者：Lexible。

## 本次内容

- 关于页提供中英文图文教程，便携包包含教程与隔离数据配图；内容承接已有候选版。
- 运行服务器和验收服务器使用 Node pipeline 发送文件，取消字体/图片下载时关闭源文件流。真实 HTTP 反例确认旧实现取消后文件流仍打开，修复后关闭，服务器继续响应。
- 浏览器验收等待实际启动完成，历史更新测试从发布配置选择条目，设置操作定位实际页头图标。日程失败的请求、页面错误、启动 DOM 和截图保存到上传目录。
- Windows CI 扩大临时 TCP 端口池并保存前后网络诊断，覆盖完整浏览器套件；不重试、不缩减平台或跳过断言。
- 新留档规则只约束后续版本，不追溯既有版本。通过 Git 恢复本次误删的全部历史报告、旧入口及原更新记录，不把它们改称不合规版本。新版本的文档链接直接指向 releases 目录。

## 本轮失败与迁移

1.7.7 本地验收暴露历史标题写死；1.7.8 暴露设置选择器不匹配实际 DOM；1.7.9 因已有截图文件占用失败，改用独立 FOCUS_ACCEPTANCE_DIR 完成全量截图和业务验收。这些本地候选没有 Tag 或 Release，不留独立报告。

[1.7.10 main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125344)六组测试与 [Pages](https://github.com/menggou1/FocusTodo-Local/actions/runs/41047125278)成功；[1.7.10 标签](https://github.com/menggou1/FocusTodo-Local/actions/runs/41048222252)在 Windows Node 24 维护并发第二场景导航出现 net::ERR_NO_BUFFER_SPACE，发布被阻止。1.7.10 标签保留，独立报告和更新项迁入本文，不创建或重跑旧版本 Release。文件流泄漏的修复不足以消除 Windows 套接字资源失败，不能把一次 main 通过当作完整发布成功。

[微软端口排障说明](https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/tcp-ip-port-exhaustion-troubleshooting)说明高频连接及 TIME_WAIT 可造成端口耗尽；本次对临时 CI runner 扩大可用动态 TCP 端口范围并记录占用，用户电脑配置不变。该环境调整与产品文件流修复分别验证，不将历史缺少现场的全部超时归为同一根因。

## 验证与发布

本地验证包括版本生成、Node 与语法、完整隔离浏览器、发布门禁、Pages 白名单、便携包及 ZIP/tar.gz 解压启动。正式留档仍须同一提交的 main 六组测试、Pages、标签六组测试及 Release 全部成功。公开结果见 [main 测试](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain)、[1.7.11 标签](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.11)和 [Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.11)。未完成验收仅在[统一待办](../BACKLOG.md)维护。

本次产品模块与通过全量本地验收的 1.7.10 相同；该次完整证据保留在 docs/acceptance/release-1.7.10。1.7.11 本地重新验证 Node（62 通过、1 项平台跳过）、语法、历史更新/通知/关于页、发布门禁和双格式便携包；新 Windows runner 配置由 main 和 Tag 的完整矩阵验证，不在日常电脑上执行。
