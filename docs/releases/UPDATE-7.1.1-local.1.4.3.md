# 7.1.1-local.1.4.3 — 语言字体、功能整合与发布验收修复

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [1.4.1 加载优化](UPDATE-7.1.1-local.1.7.10.md)

日期：2026-10-26（Asia/Shanghai）。作者：Lexible。官方基础版本 `7.1.1`，本地版本及注释 Tag 为 `1.4.3`，完整版本 `7.1.1-local.1.4.3`。

## 本版完成内容

- 中文界面使用附带 Noto Sans SC，加载前显示系统字体，字体就绪后自动应用；英文优先系统西文字体，不请求附带中文字体。普通界面与本地弹窗使用统一的语言字体变量，番茄钟字体声明保持归档官方版顺序。
- 按功能归并现有服务：身份与原生存储保护归入数据模块，备份界面归入备份模块，偏好兼容归入设置模块，主题界面归入主题存储/恢复模块。网络保留独立职责，入口按原顺序安装且可重复调用。
- 删除未接入实际模块的全局 jQuery 轮询、无人调用的用户名调试入口及用户名调试输出，保留实际资料修改、备份、主题和数据恢复行为。
- 修正跨标签验收的时间注入竞态：将生成的已过时间放入真实计时事务的归约边界，记录和游标一起提交；另一标签页的真实轮询继续运行，但不会先读到半完成的回拨状态。
- 同一辅助函数覆盖普通广播、初始化待完成时的广播和完成通知用例；仍验证真实事件、任务进度、记录 ID 与分块去重，不替代广播或伪造界面结果。生产的五分钟中断恢复规则没有改变。

既有渐进启动行为见 [1.4.1 记录](UPDATE-7.1.1-local.1.7.10.md)。数据库仍为 `PomodoroDB6` v3。

## 1.4.2 失败记录

`1.4.2` 为失败发行版本，内容和后续修复统一并入本版，不再单独维护 1.4.2 版本文档。保留原注释 Tag，指向 `464ed373d96408ccdbd9f7cac8ae76f45abbe571`，没有覆盖该 Tag。

[main 检查](https://github.com/menggou1/FocusTodo-Local/actions/runs/40317135653) 中 Windows / Node 24 的跨标签广播用例超时。诊断显示测试先单独回拨数据库时间，另一页正常轮询因此进入中断恢复，记录尚未由测试的特殊 tick 提交；这是验收时间注入的竞态。尚在运行的 [1.4.2 Tag 发布流程](https://github.com/menggou1/FocusTodo-Local/actions/runs/40317145757) 已取消，正式发行改用本版。

## 正式发行

[GitHub Release 1.4.3](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.4.3) 提供 `FocusTodo-1.4.3.zip`、`FocusTodo-1.4.3.tar.gz` 和 `SHA256SUMS.txt`。main、注释 Tag、发布附件中的版本字段与 [线上 Pages](https://menggou1.github.io/FocusTodo-Local/) 使用同一完整版本。

Pages 使用 main 的官方 Actions 白名单产物流程，线上 `deployment.json` 记录版本与来源提交。运行与升级沿用原启动器及浏览器存储地址规则，不需要 npm 运行依赖。

## 完成交付核验

发行源码与注释 Tag 指向 [16c6575](https://github.com/menggou1/FocusTodo-Local/commit/16c6575e45dca863f8114ed2f0a77df24bca0ab0)，已合入并推送 main。版本一致性、57 项单元检查和语法检查通过，单元用例在 Windows 跳过 1 项 POSIX 专项；便携包通过含空格/中文路径的解压启动与文档链接检查。

[main 六平台 CI](https://github.com/menggou1/FocusTodo-Local/actions/runs/40320120438) 全部通过。[Tag 六平台 CI 与 Release 发布](https://github.com/menggou1/FocusTodo-Local/actions/runs/40320138793) 全部通过；Ubuntu 首次安装任务受依赖镜像下载停滞影响，单独重跑后成功，已通过的其他任务结果保留。没有修改或覆盖 Tag。

[官方 Pages 部署](https://github.com/menggou1/FocusTodo-Local/actions/runs/40320120726) 成功，实际中英文页面均正常挂载，三个语言选项和按功能归并的服务入口正确，没有页面异常；英文未请求附带中文字体。首轮线上来源为上述发行源码，记录写入 `docs/acceptance/live-pages-1.4.3.json`；后续文档提交的当前来源由线上 `deployment.json` 标识。

GitHub Release 已作为最新正式版发布。三个附件均实际下载，ZIP/tar.gz 与公开 SHA256SUMS.txt 及 GitHub 附件摘要一致；两个压缩包内部版本、内联启动资产和版本文档归并结果均通过检查。完整证据在 `docs/acceptance/release-1.4.3.json`。

| 附件 | SHA256 |
|---|---|
| FocusTodo-1.4.3.zip | `3686a4dce6ba6ed9bcc6b9628dc6be0db9a78385d4905720d924d4b2d82a142f` |
| FocusTodo-1.4.3.tar.gz | `d39151c38de817555060c32bc27725147571dca14c37bff48072c441fcae07b3` |
