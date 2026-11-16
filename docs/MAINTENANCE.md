# 开发与发布维护

[首页](../README.md) · [架构](ARCHITECTURE.md) · [测试](TESTING.md) · [English](en/MAINTENANCE.md)

## 环境和入口

Node.js 22.12+，npm 锁文件安装使用 `npm ci`；发布打包使用 Python 3.12+。便携包运行不需 npm 依赖，Python 备用服务仅使用标准库。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 5511 隔离 Vite/HMR 预览；禁止使用日常 Profile |
| `npm run build:release` | 从 release.json 同步包版本、锁文件、候选版本文件、旧兼容元信息及中英文更新记录 |
| `npm run build` | 类型检查并构建正式 React 应用到 dist/app/site，私有 sourcemap 放 dist/app/debug |
| `npm start -- --no-browser --port 5512` | 启动正式构建的本地服务；默认端口为 5500 |
| `npm run build:standalone` | 构建保持命名空间隔离的测试版本到 dist/standalone/site |
| `npm run start:standalone -- --port 5512` | 只服务隔离测试构建，拒绝使用 5500 |
| `npm run package:standalone` | 生成供 CI 复验的隔离 ZIP/tar.gz |
| `python scripts/package-release.py` | 打包当前正式构建及发行文档，验证源文件摘要以拒绝陈旧构建 |
| `python scripts/deploy-pages.py --output dist/pages-preview` | 从已提交来源和相符的正式构建生成 Pages 目录；输出必须不存在 |

源码从 `standalone/app/main.tsx` 进入 `App`，组件、领域和显式服务分别维护在 `standalone/features`、`domain` 和 `services`。`src/` 的 1.x 主包和本地模块仅作兼容、历史差分和旧版 UI 基准；不进入 2.0 正式运行包或 Pages。`revise-*.cjs` 是旧包兼容工具，不是 2.0 应用构建步骤；`upgrade-*.cjs` 是历史一次性工具。

升级前关闭所有旧版窗口，避免旧新应用同时写入。正式构建使用旧 `PomodoroDB6` v3 和设置键；隔离预览使用独立数据库、前缀与 loopback 服务证明。不得为调试关闭隔离验证，不能访问或修改 5500 稳定版、真实数据库或私人备份。使用临时浏览器上下文和合成数据。调试文件可放 Codex 工作区或安全识别的临时目录；结束后只清理本轮文件，遇权限问题不得更改系统权限。

## 开发约束

复用常用开发目录与长期分支 `dev`；本次发布准备按用户要求使用 `refactor/standalone-app`。开始检查 Git 状态，保护原有改动，不强推。提交使用 Conventional Commits：`fix:`、`feat:`、`docs:`、`refactor:`、`test:`、`chore:`；发布准备可用 `chore(release): prepare 2.0.0`。不重写已发布历史。

UI 优先对照 1.9.3 / 1.9.4，在相同数据、语言、主题、视口、缩放下核对真实 DOM、computed style、截图、交互和动画。已修复的旧版缺陷应保留。共享弹窗、控件和服务优先修根因，避免局部覆盖堆叠。输入/可复制区域保留文字选择，其余装饰资源不允许意外拖动。

组件仅使用 ApplicationServices，禁止直接写 IndexedDB 或通过旧全局接入。业务写入保留 `expected` 冲突检查，多行变更使用批次事务。失败保留草稿；不兼容 schema/protocol 或未完成恢复必须停写，不重置数据。新增文案同时提供中文和英文，并运行生成器。

<a id="4-版本与发布"></a>

## 版本与日期

`release.json` 是版本、作者、日期、仓库及更新条目的人工编辑来源；`standalone/app-version.json`、包版本及锁文件通过 `build:release` 同步。2.0.0 起应用和 Tag 使用独立三段式，7.1.1 仅作来源信息。旧版本记录、MIT、版权及上游来源保留。数据库 v3、备份 exportVersion 2、兼容偏好 Version='6.5' 不随应用版本改写。

日期字段含义仍为本地发布/更新日，格式 YYYY-MM-DD。未发布版本在开发期间也要维护真实更新日期；当前 2.0.0 为 2026-11-16，正式发布前若跨日更新则同步日期与对应版本条目。关于页读取同一份元信息。当前未发布 2.0.0 的修复及 CI 不额外加版本号。

正式发布后任何已推送 Tag 均不得移动、删除重建或复用，包括失败、取消及未公开的候选；修复必须递增第三位并创建新 Tag。不得覆盖已公开附件。更新已读键仍为 FocusTodo.releaseRead，仅打开当前最新条目后写入当前版本，查看历史不清除最新提示。

## 本地质量门禁

```powershell
npm run build:release
npm run check
npm run build
npm run build:standalone
npm test
node --test tests/standalone/*.test.cjs
npm run test:standalone
npm run test:browser
npm run test:release-app
python tests/release/release-gate-test.py
python tests/release/pages-build-test.py
python scripts/package-release.py
python tests/release/package-smoke.py
git diff --check
```

完整命令范围和 UI 专项见[测试说明](TESTING.md)。仅文档变化检查文件/锚点链接；打包清单变化额外验证解压包链接与启动。不能删除有效断言、跳过失败或放宽像素阈值让 CI 通过。生成后检查工作区差异并提交所有有效生成文件，禁止提交用户数据库、凭证或调试输出。

## CI、发布与部署

main 是默认稳定分支及 Pages 唯一部署来源。分支推送触发 CI；PR 推荐但非必需。发布准备流程：本地验证、提交推送、等待本次提交的 Actions 全部适用作业结束，再创建审核 PR。当前 PR 为 `refactor/standalone-app` → `dev`；创建后停止，不合并、不创建 Tag/Release。

CI 预检生成元信息、检查无未提交生成差异、检查语法/类型、构建正式和隔离版本、校验发布门禁并打包。Windows/macOS/Linux × Node 22/24 跑单元和服务合同；Node 24 复用预检打包产物、验证 ZIP/tar.gz 启动并运行 Chromium。Linux 额外运行 Firefox/WebKit 能力降级与隔离业务测试。正式构建另测同 origin 的合成旧数据升级、项目子路径、元信息和实际备份下载。WebKit 不代表真实 Safari 人工验收。

人工批准正式发布后，从通过验收的提交创建与 localVersion 完全一致的新 Tag。Tag 工作流完整通过后产生 Pre-release；正式版可在明确验收后用 `gh workflow run ci.yml --ref <Tag> -f release_channel=stable`。流水线核对 Tag、版本、校验和及已测试附件，保留失败候选历史。

main 完整检查成功后，Pages 构建检查已提交来源与正式构建摘要，发布 `dist/app/site` 的 manifest 资源及 `.nojekyll`、`deployment.json`。不发布 src、脚本、测试、私有 sourcemap、数据库、文档或 CNAME。部署作业再次核对 main 来源，防止旧提交覆盖新部署。发布后实际检查线上 deployment.json、项目子路径和附件下载，不能在发布准备中声称已完成。

## 源码来源与原版归档

作者 Lexible；源自 [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1，上游提交 `fe15a1d9201c6298f1c28c16dcb0b58c481f9999` 保留于 `upstream/7.1.1`，连同原作者、LICENSE 与完整历史保存。归档分支不继续开发，不用于 Pages。第三方许可文本随构建和便携包交付，见根 THIRD-PARTY-NOTICES.txt。娱乐性质的设计理论文献不属于开发规范，不修改或分发进运行包。

## 文档维护

中文正式文档位于 docs，英文位于 docs/en；版本报告分别使用 releases 子目录。服务合同已并入 ARCHITECTURE，基线与验证依据已并入 TESTING；不再维护 docs/2.0.0 临时阶段目录。历史版本报告保留当时事实；未完成工作和验收状态仅写 docs/BACKLOG.md。文档移动须同步报告元信息、打包清单和文件/锚点链接。
