# 多平台兼容与 Release 交接报告

日期：2026-10-21。按用户要求结束本轮工作，后续问题留待小版本修补；不继续修改应用或重跑测试。

## 已交付

- 应用版本：`7.1.1-local.1.2.0`；带注释的 Git Tag：`1.2.0`，指向 `30fbdfd5e2c629ca11d44fe64ae0b2418cb9e40d`。
- [Release 1.2.0](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.2.0) 已正式发布，ZIP、tar.gz 和 SHA256SUMS.txt 三个附件均确认上传成功。运行时需自行安装 Node.js 22+，无需 npm 安装应用依赖。
- Windows、macOS、Linux 共用 `node scripts/start.cjs` / `npm start`，支持 `--no-browser` 和 `--port`。Windows 保留 PowerShell、批处理入口，macOS/Linux 新增 `sh start.sh`。默认仍使用 `http://127.0.0.1:5500/index.html`。
- 服务监听成功后才打开浏览器；启动参数错误或端口占用时返回失败。验证了从其他工作目录及带空格、中文的解压路径运行。
- 引入锁定开发依赖、三系统 Node.js 22/24 CI、三系统 Chromium 验收和便携包冒烟；版本 Tag 全部检查通过后才发布 Release。
- 新增版本条目造成通知面板挤出任务提醒的问题已修复，更新列表可滚动。

## 两个分支与 Tag

| 名称 | 用途 | 本轮状态 |
|---|---|---|
| `main` | 正式主线，日常使用和后续维护的默认入口 | 已接收并推送本次功能及 CI 超时修正 |
| `codex/cross-platform-release` | 本次多平台开发分支 | 已快进合并到 main；报告提交前两分支均为 `3f3a15e2ef064dc9661b1574b83969421f7bce69`，代码一致 |
| Tag `1.2.0` | 已发布版本的固定快照，不是持续更新的分支 | 保留在 `30fbdfd`，没有移动或覆盖 |

`3f3a15e` 仅修改 `tests/start.test.cjs`，应用运行文件与 Tag `1.2.0` 相同。本报告作为文档提交同步至两个分支，提交消息包含 `[skip ci]`，避免启动新的 push 验收。此提交不会修改已发布的 Tag 或 Release。

## 验证证据

- 本地 Windows / Node.js 24：38 项测试通过，1 项 POSIX 专属检查跳过；43 项浏览器用例全部通过，语法检查通过。
- 两种压缩包解压后，在无 npm 依赖、无 Git 的目录中实际启动和读取资源成功；错误 Tag 会拒绝打包。新克隆仅有 origin 时，版本元信息生成结果一致。
- [初始开发分支 CI](https://github.com/menggou1/FocusTodo-Local/actions/runs/39624874705)：六组全部成功。
- [Tag 1.2.0 发布 CI](https://github.com/menggou1/FocusTodo-Local/actions/runs/39626022895)：六组测试与发布任务全部成功。
- CI 超时修正后的[开发分支 CI](https://github.com/menggou1/FocusTodo-Local/actions/runs/39627141465)：全部成功。
- 同一修正后的 [main CI](https://github.com/menggou1/FocusTodo-Local/actions/runs/39627142057)：五组成功，macOS / Node.js 24 的一个跨标签页浏览器用例超时，因此此轮 main 不能标记为全绿。

## 邮件中的失败与后续修补

1. 初次 main 的 Windows / Node.js 22：PowerShell 包装器测试设置了 10 秒超时，进程到时被终止，返回状态为 null，导致预期退出码 7 的断言失败。已在 `3f3a15e` 将上限改为 30 秒，并增加进程错误断言；保留原参数和退出码检查。新 main 中此项约 2.8 秒通过。旧流程重跑被新提交的并发策略自动取消，不应将取消误认为另一项应用失败。
2. 新 main 的 macOS / Node.js 24：`peer tab refreshes task progress and report events for newly committed records` 在 `tests/browser-acceptance.cjs:551` 等待跨页记录/任务进度时超过 30 秒。同提交开发分支及此前 Tag 检查均通过，但本次失败仍待处理，不能仅凭其他流程成功忽略。

已阅读该用例和计时适配器。待验证的假设：用例先把共享数据库的时间锚点回拨一小时，再从另一个浏览器调用手动 tick；两页各自的自动轮询或初始化可能在这些步骤之间运行，改变结算/恢复及事件观察顺序。目前没有抓到失败时的两页会话与事件状态，尚不能认定是测试竞态或应用缺陷。

下个小版本建议先增加失败状态诊断并稳定复现，再校正测试的初始化等待和时间推进边界；若证实应用同步有缺陷，再修业务逻辑。不要通过盲目延长等待、删除断言或无限重跑掩盖问题。后续应用修补按规范使用新版本及新 Tag，例如 `1.2.1`，不覆盖 `1.2.0`。

## 保留边界

CI 覆盖三系统服务、脚本、Chromium 和解压启动，不等同于实测所有系统默认浏览器窗口、真实通知/声音或长时间休眠。无 Web Locks 并发维护、主题图片迁移、全部图表与奖励回归继续沿用原维护清单。本轮没有改变浏览器数据库结构；升级继续使用原浏览器配置、主机名与端口，跨浏览器/设备通过应用备份导入导出。
