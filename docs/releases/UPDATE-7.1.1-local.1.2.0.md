# 1.2.0 交付与验收报告

[更新记录](../../CHANGELOG.md) · [开发维护指南](../MAINTENANCE.md) · [返回首页](../../README.md)

应用 **7.1.1-local.1.2.0** · 发布日期 **2026-10-21** · 作者 **Lexible** · Git Tag **1.2.0**。

2026-10-22 已合并同版本交接报告并整理导航，未更改已发布应用或移动 Tag。历史报告从更新记录进入，日常开发步骤见维护指南，当前未完成工作只见[统一待办与验收](../BACKLOG.md)。

## 发布状态

[Release 1.2.0](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.2.0) 已正式发布 ZIP、tar.gz 和 SHA256SUMS.txt。带注释的 Tag `1.2.0` 固定在提交 `30fbdfd5e2c629ca11d44fe64ae0b2418cb9e40d`。

[Tag 发布验收](https://github.com/menggou1/FocusTodo-Local/actions/runs/39626022895) 的六组检查与发布任务全部成功，该记录保留用于核对发布版本。初始开发分支及后续测试修正的开发分支检查也成功，但后续 main 曾出现下述 macOS 偶发失败，因此不能描述为 main 所有历史 CI 均通过。

## 启动和兼容

应用继续使用浏览器本地存储和纯静态资源。新增 `node scripts/start.cjs` / `npm start`，Windows、macOS、Linux 共用同一服务器和参数：`--no-browser`、`--port 5511`。服务成功监听后才打开系统默认浏览器，打开失败会保留服务并打印手动访问地址。只监听 127.0.0.1；端口被占用或参数不合法时以非零状态退出。

通知更新列表限制高度并可滚动，避免随着历史版本增加把原任务提醒挤出面板；既有任务提醒回归继续检查实际布局。

Windows 保留 `启动.bat`、`start.ps1 -NoBrowser -Port 5511`，转交统一入口并传回退出状态。PowerShell 无 Node 时保留 Python 手动访问降级。macOS/Linux 新增 `sh start.sh`，从任意工作目录定位应用，也支持带空格和中文的路径。推荐 Node.js 22+；运行应用无需 npm 安装，开发使用锁文件和 `npm ci`。仅有 Python 时可在项目目录运行 `python3 -m http.server 5500 --bind 127.0.0.1`，浏览器手动打开地址。

## CI 与发布

GitHub Actions 在 Windows、macOS、Linux 上分别运行 Node.js 22/24 的语法、服务器、计时和发布一致性检查；Node.js 24 额外运行 Chromium 浏览器全量验收和便携包冒烟。浏览器使用独立上下文和临时端口，证据按系统上传为保留 7 天的 Artifact。

版本元信息生成器支持新克隆的 `origin`，继续优先使用 `release.json` 指定的 remote，并同步锁文件版本。CI 检查生成结果与提交一致。仅版本 Tag 触发的全部检查通过后允许发布；Tag 必须精确等于 `localVersion`，提交必须已合入 main。

Release 提供同一套跨平台运行文件的 ZIP、tar.gz 及 SHA256SUMS.txt，不包含 Node.js/Python 运行时、npm 依赖、Git 状态、测试数据或验收截图。打包使用明确文件清单；解压测试覆盖空格/中文目录、从其他目录启动、首页/主包/音频资源以及错误 Tag 拒绝。它是便携网页应用包，不是原生桌面安装程序。

## 数据与边界

本地 Windows / Node.js 24 验证：38 项核心、服务、版本和启动测试通过，1 项 POSIX 专属检查按平台跳过；43 项浏览器用例全部通过。另通过锁文件干净安装、生成文件语法检查、仅有 origin 的新仓库生成一致性、两种压缩包解压运行与错误 Tag 拒绝。三系统结果以该版本 GitHub Actions 记录为准。

默认仍为 `http://127.0.0.1:5500/index.html`。升级前建议导出备份；保持原浏览器配置、主机名和端口，数据仍在原浏览器中。跨设备或跨浏览器需要通过应用导出/导入。数据库结构和计时业务没有变更。

三平台 CI 检查服务、脚本及 Chromium 行为。未完成的实际环境验收统一见[统一待办与验收](../BACKLOG.md)。

## 历史 CI 记录

### 已修正的 Windows CI 超时

首次 main 的 Windows / Node.js 22 在 `tests/start.test.cjs` 的 PowerShell 包装器检查中超过原 10 秒上限，进程被终止，退出状态为 null，与预期 7 不符。

提交 `3f3a15e2ef064dc9661b1574b83969421f7bce69` 将上限改为 30 秒，增加进程错误断言，保留原参数和退出码检查。新 main 此项约 2.8 秒通过。该提交只修改测试，应用运行文件与已发布 Tag 相同。旧 main 重跑被新提交的并发策略取消，不应把取消误认为另一项应用失败。

### macOS 跨标签页初始化失败（已在 1.2.1 修复）

初始化事件丢失已在 1.2.1 修复，原因和验证见 [1.2.1 报告](UPDATE-7.1.1-local.1.2.1.md)。

同一后续提交在开发分支全量通过，而 main 的 macOS / Node.js 24 在 `peer tab refreshes task progress and report events for newly committed records` 等待另一页的记录和任务进度时超过 30 秒。失败位置为当时的 `tests/browser-acceptance.cjs:551`，其余五组检查成功。

该历史失败已由 1.2.1 的受控初始化用例复现并修复，不再列为当前待办。

## 2026-10-22 仓库与文档整理

远程 `codex/cross-platform-release` 已删除。工作分支今后仅在本地使用，验证后先合入本地 main，再只推送 main；`1.2.0` 是固定发布快照，不随 main 的文档整理移动。

Actions 保留成功的 Tag 发布验收和最新 Pages 部署，清理其余旧运行记录。删除记录也会删除相应日志和 Artifact，因此失败事实已保留在上节；清理记录本身不等于修复缺陷。工作流不再响应工作分支 push，纯 Markdown/docs 修改不触发完整 CI。

原独立交接报告已并入本文，原版本规范已并入维护指南；README 只提供更新记录、开发维护与架构三个入口。文档打包清单同步移除已合并文件，历史报告的引用和返回导航一并修正。

整理验证：11 个 Markdown 文件的 44 个本地链接与标题锚点全部有效，3 项发布一致性检查通过；ZIP/tar.gz 重新构建并通过解压启动、包内文档链接及错误 Tag 拒绝检查。发现原清单漏掉被引用的第一阶段报告，现将 `docs/` 顶层 Markdown 纳入便携包，验收截图与测试数据仍不打包。历史验收证据链接固定到报告对应的 Git 提交或发布 Tag，不随后续截图覆盖而改变。此次只做相应局部检查，不重新运行全量浏览器/云端 CI，整理提交使用 `[skip ci]`。

本地最近保存的验收结果见 [acceptance/results.json](https://github.com/menggou1/FocusTodo-Local/blob/1.2.0/docs/acceptance/results.json)，该目录不是每个历史版本独立的证据档案。当前未完成工作统一见[统一待办与验收](../BACKLOG.md)。
