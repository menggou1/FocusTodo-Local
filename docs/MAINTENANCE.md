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
| `npm run build:standalone` | 同一应用源码的隔离测试构建，输出 dist/standalone/site |
| `npm run start:standalone -- --port 5512` | 服务隔离构建，拒绝 5500 |
| `npm run package:standalone` | 打包隔离测试产物，供三平台复验 |
| `python scripts/package-release.py` | 打包正式 ZIP/tar.gz，核对来源摘要和资源校验和 |
| `python scripts/deploy-pages.py --ref HEAD --output dist/pages-preview` | 从已提交来源和相符构建生成 Pages；输出目录必须不存在 |

浏览器入口为 standalone/app/main.tsx，本地启动器为 scripts/start.cjs。正式构建、便携包与 Pages 共用 React 资源 manifest。仓库不再包含旧 src 主包、补丁、登录/购买页和 revise/upgrade 工具。归档版不参与生产构建或分发。

## 工作区与数据保护

日常复用常用目录与长期分支 dev。开始检查 git worktree list、分支和状态，保护已有改动；不强制切换、强推或修改其他工作树。提交使用 Conventional Commits，例如 `fix(timer): preserve paused state`；发布准备可用 `chore(release): prepare 2.0.0`，不改写已发布历史。

禁止开发测试访问稳定版 5500、日常 Profile、真实数据库或私人备份。使用随机 loopback 端口、临时浏览器上下文和合成数据。隔离构建校验服务证明与数据库/设置命名空间，不能关闭检查绕过保护。仅正式适配器接入同 origin 的 PomodoroDB6 v3 与既有设置键。升级前导出备份并关闭所有旧窗口，避免不同客户端同时写入。

旧版 UI 对照使用已有 archive/1.9.4 工作树。tests/helpers/legacy-runtime.cjs 只读解析归档或显式 FOCUS_LEGACY_ROOT，并核对固定提交与未修改的运行源。CI 在测试作业单独检出相同归档提交。正式构建、打包和 Pages 不读取归档。

## 源码与生成文件

组件只使用 ApplicationServices，不直接写 IndexedDB 或调用旧全局。写入保留 expected 冲突检查，批量操作使用事务；失败保留草稿。schema/protocol 不兼容或日志恢复未完成时停写，不清空数据库。共享弹窗、控件、滚动和服务由共同拥有者维护。

新增文案同时提供中文和英文。public/i18n 是翻译源，build:release 生成 standalone/shared/catalog.json。public 只保留应用导入的图像、音频、字体和翻译/许可源；删除资源前核对显式导入、glob、CSS 及正式 manifest。Vite 使用相对资源 URL 支持项目子路径。

设计理论文献仅供娱乐，不属于开发规范，不读取、修改或分发。调试输出只放本轮临时目录，不提交用户数据、凭证或截图。清理只针对本轮文件，权限失败不得通过修改系统权限绕过。

<a id="4-版本与发布"></a>

## 版本与日期

release.json 是版本、作者、日期、仓库与更新条目的人工来源。build:release 同步 standalone/app-version.json、package.json 和锁文件；关于页读取同一份元信息。日期为 Asia/Shanghai 的 YYYY-MM-DD，跨日修改同步当前版本条目。应用和 Tag 使用独立三段式版本；7.1.1 是来源版本。schema v3、备份 exportVersion 2 和兼容偏好 Version='6.5' 独立维护。

Tag 一经推送不得移动、删除重建或复用，包括失败、取消及未公开候选；修复必须递增第三位并创建新 Tag。尚未创建 Tag 的版本准备修复可保留当前版本。不覆盖已公开附件；保留真实历史、归档、版权和许可证。

## 质量门禁

先运行 build:release、check、build、build:standalone 和 package:standalone，再执行[测试指南](TESTING.md)列出的单元、合同、浏览器、正式升级、发布门禁和解压包验证。先提交构建输入，再运行 python tests/release/pages-build-test.py；该门禁必须核对已提交来源。最后运行 git diff --check。

生成后检查并提交全部有效生成文件。不得删除必要测试、放宽断言、缩减数据或像素阈值来通过 CI。

## CI、发布与 Pages

main 是默认稳定分支和 Pages 唯一部署来源。分支推送运行完整 CI；PR 推荐但非必要。Windows/macOS/Linux × Node 22/24 验证单元与服务合同；Node 24 验证同一批 ZIP/tar.gz、Python 备用启动和 Chromium，Linux 另跑 Firefox/WebKit。预检检查生成差异、正式/隔离构建、Pages 白名单及发布门禁。历史回归补充独立 React 启动、业务、恢复、UI 和正式入口验证。

发布顺序：本地验证，提交推送 dev，等待该 SHA 全部适用 CI 完成，核对 BACKLOG 发布检查清单。需要 PR 时按实际目标分支创建，不固定临时 PR 号或任务分支。正式发布指令下，才从验收提交创建与 localVersion 一致的新 Tag。Tag 推送默认发布正式 Release；显式调度 tag 可选 release_channel=prerelease，已验证预发行版可用 stable 调度晋升，流水线拒绝覆盖正式附件。

main 完整检查成功后，Pages 仅发布 dist/app/site 的 manifest 资源及 .nojekyll、deployment.json。不发布源码、脚本、测试、私有 sourcemap、数据库、文档或 CNAME。部署前再次核对 main 当前 SHA，防止旧提交覆盖新部署。dev 的 Pages 生成测试不触发部署。正式发布后检查线上来源、项目子路径、下载校验和及附件启动。

## 来源与文档

作者 Lexible；源自 [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) 7.1.1，上游提交 fe15a1d9201c6298f1c28c16dcb0b58c481f9999 保存在 upstream/7.1.1。archive/1.9.4 保留最后的 1.x 本地版，不继续开发、不部署 Pages。保留 MIT、上游与本地版权；React、ReactDOM、scheduler 和 Noto 完整许可随运行包交付。

中文正式文档在 docs，英文在 docs/en，版本报告使用 releases。历史报告保留当时事实；未完成工程、人工验收与发布后检查只维护在 docs/BACKLOG.md。文档移动同步更新链接、元信息和打包清单。
