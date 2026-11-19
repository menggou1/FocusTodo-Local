# 开发与发布维护

[首页](../README.md) · [架构](ARCHITECTURE.md) · [测试](TESTING.md) · [English](en/MAINTENANCE.md)

## 环境与正式入口

FocusTodo 2.0.0 是 React / TypeScript / Vite standalone 应用。开发需要 Node.js 22.12+、npm 和 Python 3.12+，使用 npm ci 安装锁定依赖。便携包无需 npm 安装，Python 备用服务只用标准库。

| 命令 | 用途 |
|---|---|
| `npm run build:release` | 从 release.json 同步版本、包与锁文件、词库和英文更新索引 |
| `npm run build` | 类型检查并生成 dist/app/site，私有 sourcemap 放在 dist/app/debug |
| `npm start -- --no-browser --port 5512` | 验证正式构建；日常启动默认端口为 5500 |
| `npm run dev` | 5511 上的隔离 Vite/HMR 开发预览 |
| `./scripts/preview-standalone.ps1 -Open` | Windows 隔离 HMR 预览，默认 `http://127.0.0.1:5511/`，用临时 Edge 会话打开 |
| `./scripts/preview-standalone.ps1 -Static -Port 5512 -Open` | HMR 不可用时，在隔离服务上构建并预览静态产物 |
| `npm run build:standalone` | 同一应用源码的隔离测试构建，输出 dist/standalone/site |
| `npm run start:standalone -- --port 5512` | 服务隔离构建，拒绝 5500 |
| `npm run package:standalone` | 打包隔离测试产物，供三平台复验 |
| `python scripts/package-release.py` | 打包正式 ZIP/tar.gz，核对来源摘要和资源校验和 |
| `python scripts/deploy-pages.py --ref HEAD --output dist/pages-preview` | 从已提交来源和相符构建生成 Pages；输出目录必须不存在 |

浏览器入口为 standalone/app/main.tsx，本地启动器为 scripts/start.cjs。正式构建、便携包与 Pages 共用 React 资源 manifest。仓库不再包含旧 src 主包、补丁、登录/购买页和 revise/upgrade 工具。归档版不参与生产构建或分发。

预览端口被占用时用 `-Port` 选择其他空闲端口。`-Open` 的临时 Edge 会话不使用日常浏览器数据，关闭后不保留预览数据；未安装 Edge 时，请在新的浏览器配置文件中手动打开脚本打印的 IPv4 地址，不要清除原配置文件的数据。

## 工作区与数据保护

日常复用常用目录与长期分支 dev。开始检查 git worktree list、分支和状态，保护已有改动；不强制切换、强推或修改其他工作树。提交使用 Conventional Commits，例如 `fix(timer): preserve paused state`；发布准备可用 `chore(release): prepare 2.0.0`，不改写已发布历史。

禁止开发测试访问稳定版 5500、日常 Profile、真实数据库或私人备份。使用随机 loopback 端口、临时浏览器上下文和合成数据。隔离构建校验服务证明与数据库/设置命名空间，不能关闭检查绕过保护。仅正式适配器接入同 origin 的 PomodoroDB6 v3 与既有设置键。升级前导出备份并关闭所有旧窗口，避免不同客户端同时写入。

旧版 UI 对照使用已有 archive/1.9.4 工作树。tests/helpers/legacy-runtime.cjs 只读解析归档或显式 FOCUS_LEGACY_ROOT，并核对固定提交与未修改的运行源。CI 在测试作业单独检出相同归档提交。正式构建、打包和 Pages 不读取归档。

## AI 智能体创建 PR 的授权规则

- 默认禁止 AI 智能体自行创建 Pull Request。
- 每次创建 PR 都必须获得用户针对该次操作的明确授权；一般开发、提交、推送或发布授权不视为创建 PR 的授权，既往授权也不自动延续到下一次。
- 创建前检查来源分支、目标分支、提交关系及实际差异，确认确实存在需要合并的变更。
- 分支没有需要合并的差异时，不创建 PR，也不制造无意义提交。
- 不得把创建 PR 当作开发或发布流程的强制步骤；文档中的发布流程不构成 AI 创建 PR 的授权。

### 错误操作记录：PR #3（2026-11-17）

[PR #3](https://github.com/menggou1/FocusTodo-Local/pull/3) 是 AI 执行智能体在不需要创建 PR 的情况下错误创建并合并的。当时应先确认分支关系及是否确实需要 PR，而不是机械执行发布流程。此 PR 已合并，GitHub 不支持删除单个已合并 PR 或回收编号，因此保留记录如实说明错误，不撤销合并或改写历史。PR 中实际包含的发布流程规范相关文档修改仍然有效。今后未经仓库所有者针对该次操作明确授权，不得创建 Pull Request。

## 源码与生成文件

组件只使用 ApplicationServices，不直接写 IndexedDB 或调用旧全局。写入保留 expected 冲突检查，批量操作使用事务；失败保留草稿。schema/protocol 不兼容或日志恢复未完成时停写，不清空数据库。共享弹窗、控件、滚动和服务由共同拥有者维护。

新增文案同时提供中文和英文。public/i18n 是翻译源，build:release 生成 standalone/shared/catalog.json。public 只保留应用导入的图像、音频、字体和翻译/许可源；删除资源前核对显式导入、glob、CSS 及正式 manifest。Vite 使用相对资源 URL 支持项目子路径。

设计理论文献仅供娱乐，不属于开发规范，不读取、修改或分发。调试输出只放本轮临时目录，不提交用户数据、凭证或截图。清理只针对本轮文件，权限失败不得通过修改系统权限绕过。

<a id="4-版本与发布"></a>

## 版本与日期

release.json 是版本、作者、日期、仓库与更新条目的人工来源。build:release 同步 standalone/app-version.json、package.json 和锁文件；关于页读取同一份元信息。日期为 Asia/Shanghai 的 YYYY-MM-DD，跨日修改同步当前版本条目。应用和 Tag 使用独立三段式版本；7.1.1 是来源版本。schema v3、备份 exportVersion 2 和兼容偏好 Version='6.5' 独立维护。

Tag 一经推送即永久保留，包括失败、取消及未公开候选的 Tag。不得移动、删除、重建或复用。保留真实历史、归档、版权和许可证，不得覆盖已公开附件。

### 失败候选版本

本节规则从准备 2.1.0 起生效，适用于 2.1.0 及后续版本。

- 用户明确废弃失败候选后，该版本号永久停用，后续修复递增第三位版本号。已推送的 Tag 按上述规则保留，从未创建的 Tag 不再补建。尚未明确废弃且未打 Tag 的候选可在准备期间沿用原版本号。
- 应用正式更新列表（`release.json` 的 `updates`）不得为已废弃的失败候选保留独立条目。将有效修改及其更新说明合并到下一正式版本，避免同一批改动出现重复更新卡片。保留必要的失败记录、验证证据和历史报告引用。
- [1.4.2 → 1.4.3](releases/UPDATE-7.1.1-local.1.4.3.md) 和 [1.5.1 → 1.5.2](releases/UPDATE-7.1.1-local.1.5.2.md) 都保留了失败候选的原 Tag，在下一正式版本中纳入有效修改，并在正式版本报告中保留失败经过与验证依据。
- [2.0.1](releases/UPDATE-2.0.1.md) 已明确废弃，未创建 Tag 或 GitHub Release。[2.0.2](releases/UPDATE-2.0.2.md) 已继承其有效修改。准备 2.1.0 时，从 `release.json.updates` 移除 2.0.1 条目，同步整理中英文 CHANGELOG，将相关有效改动统一归入 2.0.2，并保留 2.0.1 候选报告及验证证据。核对中英文 CHANGELOG 和历史报告中的相关链接仍可访问。2.0.2 的已发布内容保持原样。

## 质量门禁

先运行 build:release、check、build、build:standalone 和 package:standalone，再执行[测试指南](TESTING.md)列出的单元、合同、浏览器、正式升级、发布门禁和解压包验证。先提交构建输入，再运行 python tests/release/pages-build-test.py；该门禁必须核对已提交来源。最后运行 git diff --check。

生成后检查并提交全部有效生成文件。不得删除必要测试、放宽断言、缩减数据或像素阈值来通过 CI。

## CI、发布与 Pages

main 是默认稳定分支和 Pages 唯一部署来源。dev、其他开发分支和代码 PR 运行完整 CI；release/main/Tag 可按下述规则复用同一提交的已验证结果；PR 不是开发或发布的强制步骤，AI 创建 PR 须遵守本指南的逐次授权规则。Windows/macOS/Linux × Node 22/24 验证单元与服务合同；Node 24 验证同一批 ZIP/tar.gz、Python 备用启动和 Chromium，Linux 另跑 Firefox/WebKit。预检检查生成差异、正式/隔离构建、Pages 白名单及发布门禁。历史回归补充独立 React 启动、业务、恢复、UI 和正式入口验证。

### 同一提交的 CI 复用

dev 始终执行完整矩阵。release/main/Tag 仅可复用同一仓库、同一工作流、同一 SHA 的 dev 成功记录；六个 Windows/macOS/Linux × Node 22/24 作业必须全部实际成功，便携包附件必须未过期、具有有效 SHA-256，且该批附件创建时间早于三个 Node 24 附件测试作业。不能用较早的成功记录掩盖同 SHA 更新的失败、取消或超时。

每次仍执行生成差异、类型/构建、版本、Pages 来源与发布门禁。预检从成功记录下载原始附件，验证 Actions 附件摘要、正式校验和以及与当前新构建逐文件内容一致，恢复原批附件并执行解压启动检查。只有上述验证成功才跳过重复的六项矩阵；API、证据、附件或内容无法核实时自动全测，不触及尚未验证的产物。独立 Verify CI evidence 作业在末端再次核对来源；预检失败、测试失败/取消、未经核验的跳过或末端证据失效均阻止部署/发布。复用来源写入 Actions Step Summary。

Pages 和 Release 依赖成功的独立验证作业，并按 [GitHub 作业依赖规则](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds) 显式处理已验证的跳过；保留 main 唯一 Pages 来源、Tag 不变性、正式附件核验和发布分支清理要求。

## 分支与正式发布流程

| 标识 | 职责 |
|---|---|
| `main` | 默认稳定发布分支，Pages 唯一部署来源 |
| `dev` | 日常开发与集成分支 |
| `release/x.x.x` | 从 dev 创建的发布冻结分支，只接受版本修复、发布文档、元数据及必要发布问题修复，不引入新功能 |
| `x.x.x` Tag | 正式版本的不可变提交标识，精确匹配 localVersion，不添加 v 前缀 |
| GitHub Release | 正式发布说明、便携 ZIP/tar.gz 及 SHA256SUMS.txt |

1. 检查工作树状态、远程分支、Tag、Release 和 CI；确认目标版本未发布。日常继续复用 dev；发布在独立工作树执行，不切换、修改或清理其他工作树及日常稳定环境。
2. 从 dev 创建 release/x.x.x。2.0.0 因 main 已提前与 dev 同步，例外地从 main 创建 release/2.0.0。
3. 在发布分支完成版本元数据、文档、测试、缺陷修复和发布验收。日期按实际更新和发布事件维护，发布前同步最终信息；未打 Tag 不妨碍正常更新日期。未完成验收及证据边界只记录在 BACKLOG，不把自动化当作人工验收。
4. 本地验证后提交并推送发布分支，等待确切 SHA 的全部适用 CI 完成并成功。核对 BACKLOG 发布检查清单；不得降低门禁。
5. 检查来源、目标分支及实际差异，再将需要合并的发布变更合入 main。PR 不是强制步骤；AI 仅在获得用户针对该次创建操作的明确授权后才能创建 PR。没有需要合并的差异时，不创建 PR，也不制造无意义提交。允许快进，不强制无意义的合并提交。确认 main 最终发布提交通过全部适用检查。
6. 在 main 最终发布提交创建精确版本 Tag（例如 2.0.0）并推送。使用现有 GitHub Actions：Tag 推送在测试通过后默认发布 Stable 并设为 Latest。显式调度 tag 可选 release_channel=prerelease；只有已验证且附件核对一致的预发布版可用 stable 调度晋升，不覆盖附件、不绕过门禁。
7. 下载正式附件，核对 SHA-256、版本/作者/日期及构建来源，在临时目录、随机 loopback 端口和合成数据下验证便携包及 Python 备用启动。核对 main 的 Pages 部署来源提交、项目子路径和线上版本；只有正式 Release 和部署核验完成后宣布发布成功。
8. 将发布分支上的修复同步回 dev，保护其他工作树及其未提交修改。远程分支可快进同步，不为同步远程而修改已打开的本地工作树。发布成功且完成 Release/Pages/下载验证后，必须删除对应的远程 release/2.0.x 临时分支；同时检查并按相同安全条件清理旧发布分支。删除前确认全部有效提交已保留，保留正式 Tag、Release 和完整历史。

禁止强推或重写历史来消除差异。流程失败后，先确认候选是否已明确废弃以及 Tag 状态，再按[失败候选版本](#失败候选版本)规则处理。已推送 Tag 的候选或正式发布版本如需修复代码、文档或元数据，必须递增第三位版本号。纯基础设施故障可在同一不可变提交上重跑原门禁，前提是候选尚未废弃，且不覆盖正式附件。

main 完整检查成功后，Pages 仅发布 dist/app/site 的 manifest 资源及 .nojekyll、deployment.json。不发布源码、脚本、测试、私有 sourcemap、数据库、文档或 CNAME。部署前再次核对 main 当前 SHA，防止旧提交覆盖新部署。dev 的 Pages 生成测试不触发部署。正式发布后检查线上来源、项目子路径、下载校验和及附件启动。

## 来源与文档

作者 Lexible；源自 [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1，上游提交 fe15a1d9201c6298f1c28c16dcb0b58c481f9999 保存在 upstream/7.1.1。archive/1.9.4 保留最后的 1.x 本地版，不继续开发、不部署 Pages。保留 MIT、上游与本地版权；React、ReactDOM、scheduler 和 Noto 完整许可随运行包交付。

中文正式文档在 docs，英文在 docs/en，版本报告使用 releases。历史报告保留当时事实；未完成工程、人工验收与发布后检查只维护在 docs/BACKLOG.md。文档移动同步更新链接、元信息和打包清单。

已验证、尚未归档的改动累计在[下一版更新记录](NEXT-UPDATE.md)，发布前归纳到对应的中英文版本报告。
