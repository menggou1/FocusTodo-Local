# 后续维护指南

[返回首页](../README.md) · [更新记录与版本报告](CHANGELOG.md) · [架构说明](ARCHITECTURE.md)

本文是开发、测试、版本管理与发布的统一入口，已合并原版本规范。当前工作树应用为 `7.1.1-local.1.8.2`；版本见下表。历史报告只记录当时事实；当前开发与发布步骤以本文为准，未完成工作、未来计划的任务状态及未完成验收只在[统一待办与验收](BACKLOG.md)维护，阶段目标与依赖见[实施安排](plan/README.md)。

设计理论文献仅供娱乐，不属于开发规范。除非用户明确要求，模型不得阅读、参考或修改这些文献；开发决策以用户要求、代码事实和本维护指南为准。

## 1. 开始修改前

1. 在仓库根目录查看 `git status --short`、当前分支和 `git remote -v`，辨认已有改动，勿覆盖其他人的工作。
2. 备份实际浏览器数据；开发/自动测试使用临时端口和独立上下文，避免在日常数据库上清空、导入或试验迁移。
3. 阅读对应模块及历史报告，确认是计时规则、持久化、旧组件接入还是界面问题。

业务运行直接使用 `node scripts/start.cjs`、`npm start`、macOS/Linux 的 `sh start.sh` 或 Windows 启动脚本。默认地址为 `http://127.0.0.1:5500/index.html`，不同主机名/端口隔离浏览器数据。没有热更新或完整 React 源码构建流程，修改静态文件后刷新页面。

Node 本地服务仅接受 `127.0.0.1`、`localhost` 及有效端口的 Host；自定义域名访问不受支持。读取文件前解析实际路径，拒绝目录外及指向隐藏文件、依赖和开发工具目录的链接。Python 备用服务使用同一份文件清单；它不提供 Node 入口的 Host 校验和音频范围支持。

暂停中的休息使用可选会话字段 `pausedFrom: 'rest'`，备份恢复保留该阶段，数据库版本仍为 v3。回退到 1.7.11 或更早版本前先结束该休息会话并备份，旧版不识别此字段。系统时钟回退后的专注片段按实际发生顺序保存，允许墙上时间重叠；导入时间早于游标时仍要求确认，但不补记负时间。

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

浏览器用例启动临时 loopback 服务，使用独立上下文和测试数据，通常阻断外部网络。新截图和 JSON 默认写入 `dist/acceptance/`；可用 `FOCUS_ACCEPTANCE_DIR` 选择另一个绝对路径。筛选结果 `results-filtered.json` 不替代全量结果。`docs/acceptance/` 仅保存历史证据，不由当前测试覆盖。

## 3. 修改和生成边界

| 文件/边界 | 维护规则 |
|---|---|
| `src/startup.css` / `src/js/local-startup.js` | 首屏源文件，经 `build:release` 内联到 HTML；独立于外部样式/字体。步骤进度只统计真实资源完成和应用挂载，必要样式与数据恢复就绪后展示，不等待可选资源 |
| `src/js/local-timer-core.js` | 保持纯状态转换；区分完整番茄、部分片段、正常完成事件与恢复补记，不依赖 React/DOM |
| `src/js/local-calendar.js` | 日程交互、布局和生命周期；快速创建复用数据服务事务，安排启动复用现有计时适配器 |
| `src/js/local-data.js` | 数据库仍为 `PomodoroDB6` v3；记录和游标同事务提交；导入/删除保留完整备份与设置日志；数据库版本变更须设计迁移 |
| `src/js/local-achievements.js` | 本地森林收取动画、本地成就定义、原排行榜样式的成就面板和刷新调度；奖励及解锁状态由数据服务一起提交，复用完整备份 |
| `src/js/local-timer-ui.js` | 调用数据服务后更新旧界面；处理任务/子任务清除、订阅释放、跨页刷新、提示与音频 |
| `src/js/local-app-ui.js` | 面向用户的任务提醒、更新、关于、删除确认；更新详情不包含维护 Markdown 按钮；错误反馈与关闭清理保持一致 |
| `src/js/local-backup.js` | 紧凑 JSON/Gzip 编码、按内容识别、128 MB 上限、范围与图片引用校验及体积分析；完整业务校验保留在数据层 |
| `src/js/local-theme-storage.js` | 单次主题设置提交与恢复日志；内部日志不复制图片、不写入备份，初始化必须等待数据库导入日志恢复 |
| `src/js/local-i18n.js` / `src/js/local-settings-ui.js` | 语言解析、回退、通用设置中的语言与通知授权；不翻译用户任务/备注。显式选项只包含完整适配语言 |
| `src/local-controls.css` | 全应用共用控件原子样式；复用按钮、开关、番茄图标、日期选择与菜单等既有视觉规则，功能布局留在所属模块 |
| `release.json` | 唯一人工编辑的发布元信息；`report` 字段保留供仓库维护和一致性检查，不作为 UI 入口 |
| `src/patch.js` | 按原边界安装数据身份、网络、备份界面、设置兼容与主题；逻辑按功能归入已有模块，重复安装无副作用 |
| `src/js/local-network.js` | 同源/精确 Bing 白名单与实际旧账号 XHR 兼容；资料修改的调用路径必须保留验证 |
| `src/js/main.js` | 已修改的压缩旧包，非可丢弃构建产物；不要替换成原版后假定脚本能重建所有修改 |

### 全体样式重构与视觉验收

修改前明确样式整理范围、参考基准和允许的视觉变化。**1.8.2 的原子化重构覆盖全体样式，包括侧栏、设置、计时、日程、森林及其他页面，不设非目标区域。** 可调整选择器、样式归属与复用方式；默认保持既有视觉和交互，明确要求的语言菜单与一键收取等变化按各自需求验收。样式结构允许重构，不等于必须改变字号、布局或交互。

先在修改前提交、相同语言/主题/视口/缩放与隔离数据下取得 computed style 和截图，再核对重构前后及明确要求的新行为；图片像素不直接等于 CSS 像素。基准不得从待测实现反向生成。验收包含尺寸、裁切、弹层、键盘操作和交互状态，并用注入越界样式的反例确认检查会失败。现有侧栏数值来自 cfd6449，见 tests/fixtures/sidebar-typography-cfd6449.json，继续作为视觉回归证据，不冻结 CSS 文件或选择器的组织方式。今后若要改变既有视觉基准，须有明确需求及独立证据；局部功能修改应限定影响范围，避免全局规则意外波及其他控件。测试数量和截图留存不等于视觉需求通过。失败先局部修正回归，保留其他有效改动，未经评估不整笔回退。

只修改独立本地模块时通常不需要编辑旧包。需要改变旧组件接入时，修改对应脚本后在仓库根目录运行：

```powershell
node scripts/revise-timer-integration.cjs
node scripts/revise-app-integration.cjs
node scripts/revise-controls-integration.cjs
node scripts/revise-pomodoro-rendering.cjs
node scripts/revise-project-management.cjs
node scripts/revise-local-profile.cjs
node scripts/revise-calendar-integration.cjs
```

这些脚本共用 `scripts/lib/bundle-editor.cjs`，校验已知 1484 个模块的 AST 边界、唯一匹配及编辑重叠，写入前再次解析。番茄渲染脚本维护数字进度转换及完成按钮的异步点击锁。脚本结构断言失败时先检查新 bundle，不能绕过断言强行替换。修改后重复运行并比较哈希，确保结果稳定。

`upgrade-local.cjs`、`upgrade-patch.cjs` 是历史一次性记录，不是最终构建链。没有完整组件源码、依赖清单及原打包配置的恢复流程。


模块按功能归属维护。新增或整理兼容逻辑时，先复用现有数据、备份、设置与主题服务；只拆文件、缩短行数不构成完成依据。

### 样式归属与复用入口

| 文件/入口 | 维护范围 |
|---|---|
| `src/main.css` | 旧组件各模块布局、字体、主题与 vendor 基础；覆盖侧栏、任务、计时、日程、统计等全应用区域 |
| `src/local-controls.css` | 共用按钮、图标按钮、设置行、菜单、日期选择/弹层、番茄小图标与文本截断；旧类名作为兼容别名共用同一份规则，保留各选择器优先级及必要例外 |
| `src/local-ui.css` | 本地功能的布局与交互状态；共用按钮基础边框、背景、文字色和指针由控件样式维护 |
| `FocusSettings.selectStyles()` / `switchProps()` | 番茄设置、外观设置、语言选择共享下拉样式；番茄与通用设置共享开关参数。颜色须在使用时读取当前主题 |
| `src/startup.css` | 独立首屏，生成时内联；不依赖应用控件和外部字体 |
| `src/purchase.css` / `src/resetpassword.css` | 原独立页的布局样式；不引入本地应用主题变量，旧账号联网入口仍按既有边界隔离 |

新增控件先选择已有原子或兼容别名，功能布局留在所属模块。调整旧组件接入时，在 `revise-app-integration.cjs` 后运行 `revise-controls-integration.cjs` 并核对幂等；新增入口或运行资源须同步 HTML 与共享运行文件清单 `scripts/runtime-layout.json`。

## 4. 版本与发布

### 正式版本与报告留存

历史报告与公开证据按当时事实保留。新版本报告记录问题、最终行为、验证结果及必要的失败原因；未完成事项只放 BACKLOG。

`main` 是默认稳定分支，PR 是推荐的审查方式，不是开发或发布前提。任何开发分支均可通过版本 Tag 独立发布便携包；正式 Pages 只由 `main` 部署。功能分支测试版默认发布为 Pre-release；release 分支经过完整验收后可显式选择正式 Release。

未公开的候选版本失败后可修复并重新验证，必要时可移动其 Tag；确认没有公开 Release 且没有并发发布运行后，再更新远程 Tag 并重新触发完整检查。已公开的 Pre-release 不得静默替换：使用新版本发布修复，或在附件与本次验收一致时显式提升为正式版。已公开正式版本及附件不得覆盖，修复使用新版本。保留历史失败记录及必要证据。

作者为 **Lexible**。1.x 系列（含本次 1.8.2）使用 `7.1.1-local.<主版本>.<功能版本>.<修复版本>`，Git Tag 只使用本地三段数字。**从 2.0.0 起，应用版本与 Tag 均使用独立三段式 `2.0.0`，之后按主版本、功能版本、修复版本递增；7.1.1 仅保留为来源元信息，不再拼入应用版本。** 这是已确定的版本规则。

| 情况 | 完整版本示例 | Tag |
|---|---|---|
| 当前版本 | `7.1.1-local.1.8.2` | `1.8.2` |
| 仅补 Tag | `7.1.1-local.1.6.0` | `1.6.0` |
| 兼容修复 | `7.1.1-local.1.2.3` | `1.2.3` |
| 兼容功能 | `7.1.1-local.1.3.0` | `1.3.0` |
| 启用独立版本 | `2.0.0` | `2.0.0`，保留来源、兼容与回退说明 |

历史 `7.1.1-patch.1` 是规范建立前的名称，未额外发布 `7.1.1-local.1.0.0`。npm SemVer 会将带连字符的完整版本视作预发布；本项目按本地三段数字判断更新顺序，不直接与官方 `7.1.1` 比较，也不用字符串字典序。当前通知仅比较是否为不同版本，没有联网更新检查。

**1.8.2 仍按旧格式发布**，当前生成器和元信息结构继续适用。2.0.0 开发时同步改造版本生成、显示、旧新版本识别、更新记录、打包和部署门禁；验证旧备份、已读状态、缓存与数据连续性。版本更名不得重置数据库、设置或历史记录，也不改写已有 Tag、Release 和历史版本。实施顺序见[2.0.0 版本计划](plan/2.0.0.md)，进度只在 BACKLOG 维护。

`release.json` 是版本、作者、日期、remote 名及更新条目的唯一人工编辑入口，日期按本地发布日 `YYYY-MM-DD`。新版本在 `updates` 首部新增条目及对应报告，保留历史条目。`items` 只写面向用户的简短变化，`report` 供仓库维护和一致性检查，不在产品界面提供报告下载入口。

运行 `npm run build:release` 同步 `src/js/local-release.js`、包版本/作者、锁文件版本、页面标题及缓存参数；勿单独编辑生成文件。这不能重建旧主包，组件接入使用上一节指定的 AST 脚本。

生成时同时读取 `public/i18n/local-en.json` 和原语言文件，生成同步回退词库，并从 `release.json` 的 `titleEn/itemsEn` 生成缺失的英文历史报告与更新记录。新增本地文案须同时提供英文；当前使用、维护、架构与统一清单的英文文档位于 `docs/en/`，与中文版本按同一范围同步。已存在的英文历史报告保持原文；新英文历史报告是技术摘要，保留原中文报告与公开证据。

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

当前全量包含计时核心、服务、发布信息、启动器、备份编码，18 项启动/字体用例、应用浏览器用例和 7 项并发维护场景，以及清单拖动、音频协调、本地资料和日程、森林、成就及任务提醒专项验收。便携包使用 Python 3.12+ 执行 `python scripts/package-release.py` 和 `python tests/release/package-smoke.py`，覆盖 ZIP/tar.gz 解压后的实际启动。`npm run benchmark:backup` 在隔离浏览器用生成的 1/10/50 MB 任务历史和图片样本测量容量，结果保存为 `dist/acceptance/backup-performance.json`，不作为每次 CI 的重复负载。报告以实际结果为准。

仅整理文档时检查文件和锚点链接；若变更文档打包清单，额外构建压缩包并检查解压后的链接与启动，不必重跑全部浏览器测试。

### 开发与发布流程

1. 在功能分支修改并运行适当检查；PR 推荐用于审查，是否合并由任务决定。应用变化时更新 `release.json`、生成文件和中英文报告。
2. 从拟发布的提交创建与 `localVersion` 完全一致的版本 Tag 并推送。Tag push 自动执行完整 CI，成功后创建 Pre-release；无需先合并或部署 Pages。避免在待发布提交使用 `[skip ci]`。
3. release 分支完成验收后，可运行 `gh workflow run ci.yml --ref <版本Tag> -f release_channel=stable`，完整 CI 再次通过后创建正式 Release，或将同一 Tag 已有的 Pre-release 显式提升。提升前会校验已有附件与本次测试包的内容一致。手动选择正式版表示已完成验收；工作流不根据分支名称推断验收。
4. 检查 Actions、Release 的 ZIP、tar.gz、SHA256SUMS 和报告证据。部署 Pages 时另行核对 main 工作流及线上 `deployment.json`；独立发布不改变 Pages。

`.github/workflows/ci.yml` 响应分支推送、面向 main 的 PR、版本 Tag 和手动运行。预检检查生成文件、语法、Pages 白名单、发布测试并打包；仅文档 PR 可缩减矩阵。其余运行包括 Tag 均执行 Windows/macOS/Linux × Node 22/24 单元测试，三个 Node 24 作业测试同一份便携包并运行 Chromium 验收。发布依赖该次 Tag 运行的预检和全部矩阵成功，校验 Tag、版本和附件校验和，使用已测试的包；不依赖 main 历史或 Pages。Pages 仅在 main 通过完整测试后部署，并防止旧提交覆盖新部署。浏览器证据保存 7 天，发布报告保留必要证据。便携包不含运行时、npm 依赖、Git 状态或测试数据。文档移动时同步打包清单并检查包内链接。

提交前检查生成文件、文档链接、已读状态和截图，确认没有用户备份、真实数据库、账号凭证或临时输出。选择相关文件提交，推送前核对 remote 和远程分支；远端新增提交时先处理分歧，不强推覆盖。

### 启动反馈与性能取样

修改 `src/startup.css` 或 `src/js/local-startup.js` 后运行 `npm run build:release`，将首屏源文件内联到 HTML；不要直接维护两份启动代码。`node tests/browser/startup-acceptance.cjs` 可独立运行启动用例；`npm run test:browser` 包含它们。

按需运行 `node tests/performance/startup-performance.cjs <已确认的基线提交>`，在隔离数据库和项目子路径下比较一次冷启动。模拟条件为 150 ms 延迟、200 KiB/s 下载，双方同样拦截可选字体和图片；结果写入 `dist/acceptance/startup-performance.json`，不代表线上速度承诺，也不作为每次 CI 的波动阈值。

### GitHub Pages 官方工作流

线上地址为 [GitHub Pages](https://menggou1.github.io/FocusTodo-Local/)。`main` 保存完整项目；`.github/workflows/ci.yml` 在 main 推送通过测试后部署，也支持在 main 上手动运行。仓库 Settings → Pages → Source 使用 **GitHub Actions**，不再维护或依赖 `gh-pages` 分支。

工作流使用官方 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages`，通过 `github-pages` 环境发布。构建使用 `contents: read` 和 `pages: read`；部署使用 `pages: write` 与 `id-token: write`，无需个人令牌。并发部署串行执行，避免中断正在发布的网站。

`scripts/runtime-layout.json` 是本地服务、便携包和 Pages 的共享运行文件白名单。构建从已提交的版本读取 `src/` 和 `public/`，将其映射到原浏览器目录（例如 `index.html`、`js/`、`font/`）。Pages 还写入 `.nojekyll` 和记录版本/来源提交的 `deployment.json`，不上传开发脚本、测试、文档或 CNAME；便携包额外包含启动器和发行文档。

使用 Python 3.12+ 可按同一规则生成本地预览（输出目录必须不存在）：

```bash
python scripts/deploy-pages.py --output dist/pages-preview
# 在 main 上重新部署当前提交
# GitHub Actions → Test, deploy and release → Run workflow → main
```

默认使用已提交的 `HEAD`，可用 `--ref` 指定提交（包括 PR 分支的本地预览）。脚本仅构建目录，不再提供 `--push` / `--remote` 或写入部署分支。本次迁移不修改应用版本、历史 Tag 或 Release。部署不会读取或上传本地浏览器数据库。线上地址与本机 loopback 使用不同浏览器存储，数据迁移依赖备份导出/导入。部署后核对工作流成功、线上 `deployment.json` 的来源提交，以及项目子路径下的真实页面启动。

## 文档存放与链接

中文和英文教程分别位于 `docs/GUIDE.md`、`docs/en/GUIDE.md`，配图位于 `docs/guide-images/` 并包含在便携包中。中文版本报告位于 `docs/releases/`，英文报告位于 `docs/en/releases/`；不保留旧路径跳转页，链接直接指向归档目录。更新记录指向归档报告。移动文件时同步相对链接、`release.json`、生成器和打包清单，并检查文件及锚点。

工程版本计划放在 [`docs/plan/`](plan/README.md)，英文版本位于 `docs/en/plan/`；记录范围、优先级、实施顺序和验收标准，任务状态只在 BACKLOG 维护。工程文档与娱乐性质的设计理论文献隔离，不互相链接，不从理论文献生成贡献指南或开发要求。娱乐理论不随便携运行包交付；所有文档均不上传 Pages 运行目录。

## 6. 统一待办入口

未完成工程、未完成验收和未来计划的任务状态统一写入[统一待办与验收](BACKLOG.md)。新增事项、优先级与进度只在该文件维护；`docs/plan/` 可以记录稳定的阶段目标、先后依赖和完成依据，引用 BACKLOG 编号，不维护第二份任务状态。完成并验证后删除 BACKLOG 条目，实际结果写入对应版本报告。历史报告不再复制待办清单。

## 7. 源码来源与原版归档

| 分支 | 用途 |
| --- | --- |
| `main` | 默认稳定分支及正式 Pages 来源 |
| `upstream/7.1.1` | 原始上游 7.1.1 代码及其完整历史，固定归档 |

2026-10-22 从 [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 核对并归档上游提交 [fe15a1d9201c6298f1c28c16dcb0b58c481f9999](https://github.com/menggou1/FocusTodo-Local/commit/fe15a1d9201c6298f1c28c16dcb0b58c481f9999)，提交说明为 `feat: update to v7.1.1`，时间为 2025-12-15 23:32:46 UTC。远程 [upstream/7.1.1](https://github.com/menggou1/FocusTodo-Local/tree/upstream/7.1.1) 直接指向该提交，Git tree 为 `b163dc146decc50e5cc5f64ed2b046e73098c750`；没有加入本地版补丁、重写原文件或只复制工作目录。该分支及祖先的可达 Git 对象由本仓库的归档引用保留，不依赖上游分支以后是否移动。

原版分支长期保留，不继续开发、不用于 Pages 或本地版 Release，也不反向合入 main。保留原作者信息、LICENSE 和包括原 CNAME 在内的原始文件；本地版继续在 main 维护，正式网站通过 main 的官方 Pages 工作流部署。读取归档可执行：

```bash
git fetch Focustodo-local upstream/7.1.1
git log Focustodo-local/upstream/7.1.1
git archive --format=zip --output upstream-7.1.1.zip Focustodo-local/upstream/7.1.1
```

分支归档与 GitHub 的 fork 关系是两回事。2026-10-22 用户已在 GitHub 完成 Leave fork network；随后通过实时 REST API 确认本仓库 `fork=false`，`parent` 和 `source` 均为空，仓库 ID 仍为 `1308433974`。原版分支保留 4 个原始提交，当时 main、gh-pages、版本标签、Release 及其附件均被保留；现行 Pages 部署规则见上节，gh-pages 已退出维护。脱离前已在本机 `dist/repository-before-detach-2026-10-22.bundle` 保存并验证完整 Git 历史，旁边的同名 JSON 保存仓库、分支、标签、Release 和 Pages 设置快照；这些恢复辅助文件不提交、不发布，也不替代远程归档分支。

