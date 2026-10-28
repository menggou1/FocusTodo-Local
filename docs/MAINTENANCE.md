# 后续维护指南

[返回首页](../README.md) · [更新记录与版本报告](../CHANGELOG.md) · [架构说明](../ARCHITECTURE.md)

本文是开发、测试、版本管理与发布的统一入口，已合并原版本规范。当前应用为 `7.1.1-local.1.5.4`。历史报告只记录当时事实；当前开发与发布步骤以本文为准，未完成工作、未来计划及未完成验收只在[统一待办与验收](BACKLOG.md)维护。

## 1. 开始修改前

1. 在仓库根目录查看 `git status --short`、当前分支和 `git remote -v`，辨认已有改动，勿覆盖其他人的工作。
2. 备份实际浏览器数据；开发/自动测试使用临时端口和独立上下文，避免在日常数据库上清空、导入或试验迁移。
3. 阅读对应模块及历史报告，确认是计时规则、持久化、旧组件接入还是界面问题。

业务运行直接使用 `node scripts/start.cjs`、`npm start`、macOS/Linux 的 `sh start.sh` 或 Windows 启动脚本。默认地址为 `http://127.0.0.1:5500/index.html`，不同主机名/端口隔离浏览器数据。没有热更新或完整 React 源码构建流程，修改静态文件后刷新页面。

## 2. 开发与测试依赖

```powershell
npm ci
npm test
npm run check
```

使用 Node.js 22+；CI 检查 Node.js 22/24。Acorn 与 Playwright 仅为开发依赖，运行应用不需要安装。`package-lock.json` 已提交，通过 `npm ci` 固定依赖；升级依赖时同时更新锁文件并运行全量验收。

浏览器验收需 Playwright 与 Chromium/Edge。本机有 Codex 捆绑运行时可被测试脚本自动找到；其他机器可临时安装：

```powershell
npx playwright install chromium
npm run test:browser
```

验收脚本优先使用 Windows 默认路径的 Edge/Chrome，否则使用 Playwright 浏览器。CI 设置 `FOCUS_TEST_BUNDLED_BROWSER=1` 统一使用 Playwright Chromium。可通过 `$env:FOCUS_TEST_BROWSER` 指定浏览器可执行文件。`$env:FOCUS_TEST_FILTER` 用于临时按用例名筛选；运行完整验收前移除该变量：

```powershell
Remove-Item Env:FOCUS_TEST_FILTER -ErrorAction SilentlyContinue
npm run test:browser
```

浏览器用例启动临时 loopback 服务，使用独立浏览器上下文、测试数据并阻断外部网络。完整结果和截图写入 `docs/acceptance/`；这是最近一次保存的本地证据，不是各历史版本独立的截图档案。筛选结果写入 `results-filtered.json`，不能用其替代全量结果。提交前核对截图只有测试数据。

## 3. 修改和生成边界

| 文件/边界 | 维护规则 |
|---|---|
| `startup.css` / `js/local-startup.js` | 首屏源文件，经 `build:release` 内联到 HTML；独立于外部样式/字体。步骤进度只统计真实资源完成和应用挂载，必要样式与数据恢复就绪后展示，不等待可选资源 |
| `local-timer-core.js` | 保持纯状态转换；区分完整番茄、部分片段、正常完成事件与恢复补记，不依赖 React/DOM |
| `local-data.js` | 数据库仍为 `PomodoroDB6` v3；记录和游标同事务提交；导入/删除保留完整备份与设置日志；数据库版本变更须设计迁移 |
| `local-timer-ui.js` | 调用数据服务后更新旧界面；处理任务/子任务清除、订阅释放、跨页刷新、提示与音频 |
| `local-app-ui.js` | 面向用户的更新、关于、删除确认；更新详情不包含维护 Markdown 按钮；错误反馈与关闭清理保持一致 |
| `local-backup.js` | 紧凑 JSON/Gzip 编码、按内容识别、128 MB 上限、范围与图片引用校验及体积分析；完整业务校验保留在数据层 |
| `local-theme-storage.js` | 单次主题设置提交与恢复日志；内部日志不复制图片、不写入备份，初始化必须等待数据库导入日志恢复 |
| `local-i18n.js` / `local-settings-ui.js` | 语言解析、回退、通用设置中的语言与通知授权；不翻译用户任务/备注。显式选项只包含完整适配语言 |
| `release.json` | 唯一人工编辑的发布元信息；`report` 字段保留供仓库维护和一致性检查，不作为 UI 入口 |
| `patch.js` | 按原边界安装数据身份、网络、备份界面、设置兼容与主题；逻辑按功能归入已有模块，重复安装无副作用 |
| `local-network.js` | 同源/精确 Bing 白名单与实际旧账号 XHR 兼容；资料修改的调用路径必须保留验证 |
| `js/main.js` | 已修改的压缩旧包，非可丢弃构建产物；不要替换成原版后假定脚本能重建所有修改 |

只修改独立本地模块时通常不需要编辑旧包。需要改变旧组件接入时，修改对应脚本后在仓库根目录运行：

```powershell
node scripts/revise-timer-integration.cjs
node scripts/revise-app-integration.cjs
node scripts/revise-pomodoro-rendering.cjs
node scripts/revise-project-management.cjs
node scripts/revise-local-profile.cjs
```

这些脚本共用 `scripts/lib/bundle-editor.cjs`，校验已知 1484 个模块的 AST 边界、唯一匹配及编辑重叠，写入前再次解析。番茄渲染脚本维护数字进度转换及完成按钮的异步点击锁。脚本结构断言失败时先检查新 bundle，不能绕过断言强行替换。修改后重复运行并比较哈希，确保结果稳定。

`upgrade-local.cjs`、`upgrade-patch.cjs` 是历史一次性记录，不是最终构建链。没有完整组件源码、依赖清单及原打包配置的恢复流程。


模块按功能归属维护。新增或整理兼容逻辑时，先复用现有数据、备份、设置与主题服务；只拆文件、缩短行数不构成完成依据。

## 4. 版本与发布

新的修补发行递增本地版本第三位修订号。已推送的失败 Tag 保留，修复提交使用下一修订版本；版本报告按实际任务范围归档，本次失败的 1.4.2 内容归并至 1.4.3。

官方基础版本固定为 **7.1.1**，作者为 **Lexible**。完整版本格式为 `7.1.1-local.<主版本>.<功能版本>.<修复版本>`，Git Tag 只使用本地三段数字：

| 情况 | 完整版本示例 | Tag |
|---|---|---|
| 当前发布 / main / Pages | `7.1.1-local.1.5.4` | `1.5.4` |
| 兼容修复 | `7.1.1-local.1.2.3` | `1.2.3` |
| 兼容功能 | `7.1.1-local.1.3.0` | `1.3.0` |
| 本地不兼容改变 | `7.1.1-local.2.0.0` | `2.0.0`，另附迁移和回退方案 |

历史 `7.1.1-patch.1` 是规范建立前的名称，未额外发布 `7.1.1-local.1.0.0`。npm SemVer 会将带连字符的完整版本视作预发布；本项目按本地三段数字判断更新顺序，不直接与官方 `7.1.1` 比较，也不用字符串字典序。当前通知仅比较是否为不同版本，没有联网更新检查。

`release.json` 是版本、作者、日期、remote 名及更新条目的唯一人工编辑入口，日期按本地发布日 `YYYY-MM-DD`。新版本在 `updates` 首部新增条目及对应报告，保留历史条目。`items` 只写面向用户的简短变化，`report` 供仓库维护和一致性检查，不在产品界面提供报告下载入口。

运行 `npm run build:release` 同步 `js/local-release.js`、包版本/作者、锁文件版本、页面标题及缓存参数；勿单独编辑生成文件。这不能重建旧主包，组件接入使用上一节指定的 AST 脚本。

生成时同时读取 `i18n/local-en.json` 和原语言文件，生成同步回退词库，并从 `release.json` 的 `titleEn/itemsEn` 生成英文历史报告与更新记录。新增本地文案须同时提供英文；当前使用、维护、架构与统一清单的英文文档位于 `docs/en/`，与中文版本按同一范围同步。英文历史报告是技术摘要，保留原中文报告与公开证据。

生成器优先使用 `release.json` 指定的 `Focustodo-local`，缺失时使用新克隆默认的 `origin`，校验 GitHub HTTPS/SSH 地址后生成仓库链接。始终核对 URL；日常应用使用已生成地址，无需 Git，只有用户点击图标才打开仓库。

应用版本、IndexedDB v3 和旧偏好 `Version='6.5'` 用途不同，不要为了统一显示修改数据库兼容标记。通知已读键 `FocusTodo.releaseRead` 在打开最新详情后保存当前完整版本；查看历史详情不会标记最新更新已读，后续版本变化后恢复提示。

## 5. 验收与提交

提交遵循 Conventional Commits：`类型(可选范围): 简短说明`，例如 `fix(lists): improve drag feedback`。`fix:` 表示修复，`feat:` 表示新增功能，`docs:`、`refactor:`、`test:`、`chore:` 分别用于文档、重构、测试和维护；只约束后续提交，不改写已发布历史。

```powershell
npm run build:release
npm test
npm run check
npm run test:browser
git diff --check
git diff --stat
git status --short
```

当前全量包含计时核心、服务、发布信息、启动器、备份编码，14 项启动/字体用例、59 项应用浏览器用例和 7 项并发维护场景，以及清单拖动、音频协调和本地资料专项验收。便携包使用 Python 3.12+ 执行 `python scripts/package-release.py` 和 `python tests/package-smoke.py`，覆盖 ZIP/tar.gz 解压后的实际启动。`npm run benchmark:backup` 在隔离浏览器用生成的 1/10/50 MB 任务历史和图片样本测量容量，结果保存为 `docs/acceptance/backup-performance.json`，不作为每次 CI 的重复负载。报告以实际结果为准。

仅整理文档时检查文件和锚点链接；若变更文档打包清单，额外构建压缩包并检查解压后的链接与启动，不必重跑全部浏览器测试。

### 合并与推送顺序

**工作分支只在本地使用，先合入本地 main，再推送 main。不要为了触发 CI 推送工作分支。**

仅在用户明确授权时，可临时推送用于指定平台验证的分支；只运行获准平台，完成后删除远程临时分支，并恢复常规三平台发布门禁。本次 `1.2.1` 的 macOS 专项验证属于这项明确授权。

1. 在本地工作分支修改、验证并更新报告；应用变化才递增版本，纯文档整理不新发应用版本。
2. 确认 main 工作区干净，读取远端最新 main；有分歧先处理，不强推覆盖。本项目 main 位于独立工作区，不要在其他工作区重复切换到 main。
3. 在 main 所在工作区合并已验证分支，再只推送 main。
4. 正式发布时，从已合并、已验证的 main 提交创建带注释的新版本 Tag 并推送；Tag 必须等于 `localVersion`，不要覆盖旧 Tag。

```bash
# 将路径、分支和后续修补版本示例替换为实际值
git -C "<main工作区>" merge --ff-only "<本地工作分支>"
git push Focustodo-local main
# 仅正式发布新版本时执行
git -C "<main工作区>" tag -a 1.2.3 -m "Release 1.2.3"
git push Focustodo-local refs/tags/1.2.3
```

### Actions 与发布产物

`.github/workflows/ci.yml` 响应 main 代码推送、面向 main 的 PR、版本号 Tag 和手动触发；不响应工作分支 push，纯 Markdown/docs 修改不自动跑测试，Tag 发布仍执行完整检查。三系统分别跑 Node.js 22/24，Node.js 24 运行完整 Chromium 和便携包验收，浏览器 Artifact 保存 7 天。

版本 Tag 全部检查成功、版本匹配且提交在 main 历史中，才允许发布 ZIP、tar.gz、SHA256SUMS.txt。便携包不含运行时、npm 依赖、Git 状态或测试数据。文档合并/改名必须同步 `scripts/package-release.py`，确保压缩包内的本地文档链接也可用；普通文档整理不覆盖旧 Release。

可清理重复、失败和取消的 Actions 运行记录，保留成功发布验收与最新 Pages 部署。删除运行记录会移除其日志/Artifact，先在版本报告保留失败原因；清理记录不等于修复缺陷。发布失败应检查日志，修复后用新版本，或在尚未创建 Release 时重跑失败任务。

提交前检查生成文件、文档链接、已读状态和截图，确认没有用户备份、真实数据库、账号凭证或临时输出。选择相关文件提交，推送前核对 remote 和远程分支；远端新增提交时先处理分歧，不强推覆盖。

### 启动反馈与性能取样

修改 `startup.css` 或 `js/local-startup.js` 后运行 `npm run build:release`，将首屏源文件内联到 HTML；不要直接维护两份启动代码。`node tests/startup-acceptance.cjs` 可独立运行启动用例；`npm run test:browser` 包含它们。

按需运行 `node tests/startup-performance.cjs <已确认的基线提交>`，在隔离数据库和项目子路径下比较一次冷启动。模拟条件为 150 ms 延迟、200 KiB/s 下载，双方同样拦截可选字体和图片；结果写入 `docs/acceptance/startup-performance.json`，不代表线上速度承诺，也不作为每次 CI 的波动阈值。

### GitHub Pages 官方工作流

线上地址为 [GitHub Pages](https://menggou1.github.io/FocusTodo-Local/)。`main` 保存完整项目；`.github/workflows/pages.yml` 在 main 推送时自动部署，也支持在 main 上手动运行。仓库 Settings → Pages → Source 使用 **GitHub Actions**，不再维护或依赖 `gh-pages` 分支。

工作流使用官方 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages`，通过 `github-pages` 环境发布。构建仅有 `contents: read`；部署使用 `pages: write` 与 `id-token: write`，无需个人令牌。并发部署串行执行，避免中断正在发布的网站。

沿用原有 `scripts/deploy-pages.py` 文件白名单：根目录浏览器 HTML/CSS/JS、图标、`release.json`、`LICENSE`，以及 `js/`、`audio/`、`font/`、`i18n/`、`img/`。脚本只读取已提交 main 或其祖先，输出这些运行文件、`.nojekyll` 和记录版本/来源提交的 `deployment.json`；开发脚本、测试、文档、上游 `CNAME` 仍不上传。官方工作流上传的目录是 `dist/pages`，不是整个仓库。

使用 Python 3.12+ 可按同一规则生成本地预览（输出目录必须不存在）：

```bash
python scripts/deploy-pages.py --output dist/pages-preview
# 在 main 上重新部署当前提交
# GitHub Actions → Deploy GitHub Pages → Run workflow → main
```

脚本仅构建目录，不再提供 `--push` / `--remote` 或写入部署分支。本次迁移不修改应用版本、历史 Tag 或 Release。部署不会读取或上传本地浏览器数据库。线上地址与本机 loopback 使用不同浏览器存储，数据迁移依赖备份导出/导入。部署后核对工作流成功、线上 `deployment.json` 的来源提交，以及项目子路径下的真实页面启动。

## 6. 统一待办入口

未完成工程、未完成验收和未来计划统一写入[统一待办与验收](BACKLOG.md)。新增事项只在该文件维护；完成并验证后删除条目，实际结果写入对应版本报告。历史报告不再复制待办清单。

## 7. 源码来源与原版归档

| 分支 | 用途 |
| --- | --- |
| `main` | 当前本地版源码、维护文档与版本发布 |
| `upstream/7.1.1` | 原始上游 7.1.1 代码及其完整历史，固定归档 |

2026-10-22 从 [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 核对并归档上游提交 [fe15a1d9201c6298f1c28c16dcb0b58c481f9999](https://github.com/menggou1/FocusTodo-Local/commit/fe15a1d9201c6298f1c28c16dcb0b58c481f9999)，提交说明为 `feat: update to v7.1.1`，时间为 2025-12-15 23:32:46 UTC。远程 [upstream/7.1.1](https://github.com/menggou1/FocusTodo-Local/tree/upstream/7.1.1) 直接指向该提交，Git tree 为 `b163dc146decc50e5cc5f64ed2b046e73098c750`；没有加入本地版补丁、重写原文件或只复制工作目录。该分支及祖先的可达 Git 对象由本仓库的归档引用保留，不依赖上游分支以后是否移动。

原版分支长期保留，不继续开发、不用于 Pages 或本地版 Release，也不反向合入 main。保留原作者信息、LICENSE 和包括原 CNAME 在内的原始文件；本地版继续在 main 维护，正式网站通过 main 的官方 Pages 工作流部署。读取归档可执行：

```bash
git fetch Focustodo-local upstream/7.1.1
git log Focustodo-local/upstream/7.1.1
git archive --format=zip --output upstream-7.1.1.zip Focustodo-local/upstream/7.1.1
```

分支归档与 GitHub 的 fork 关系是两回事。2026-10-22 用户已在 GitHub 完成 Leave fork network；随后通过实时 REST API 确认本仓库 `fork=false`，`parent` 和 `source` 均为空，仓库 ID 仍为 `1308433974`。原版分支保留 4 个原始提交，当时 main、gh-pages、版本标签、Release 及其附件均被保留；现行 Pages 部署规则见上节，gh-pages 已退出维护。脱离前已在本机 `dist/repository-before-detach-2026-10-22.bundle` 保存并验证完整 Git 历史，旁边的同名 JSON 保存仓库、分支、标签、Release 和 Pages 设置快照；这些恢复辅助文件不提交、不发布，也不替代远程归档分支。
