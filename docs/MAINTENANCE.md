# 后续维护指南

本指南适用于官方基础 7.1.1、本地 `7.1.1-local.1.1.2`。入口为 [README](../README.md)，组件边界见 [前端架构](../ARCHITECTURE.md)，版本发布规则见 [VERSIONING](VERSIONING.md)。历史报告记录当时状态，当前行为以代码和本指南为准。

## 1. 开始修改前

1. 在仓库根目录查看 `git status --short`、当前分支和 `git remote -v`，辨认已有改动，勿覆盖其他人的工作。
2. 备份实际浏览器数据；开发/自动测试使用临时端口和独立上下文，避免在日常数据库上清空、导入或试验迁移。
3. 阅读对应模块及历史报告，确认是计时规则、持久化、旧组件接入还是界面问题。

业务运行直接使用 `node scripts/server.cjs` 或 Windows 启动脚本。默认地址为 `http://127.0.0.1:5500/index.html`，不同主机名/端口隔离浏览器数据。没有热更新或完整 React 源码构建流程，修改静态文件后刷新页面。

## 2. 开发与测试依赖

```powershell
npm install
npm test
npm run check
```

`package.json` 中 Acorn 用于 AST 接入脚本和语法检查；浏览器运行无需它。当前 `package-lock.json` 被仓库 `.gitignore` 忽略，依赖未锁定；若准备升级依赖或引入锁文件，应作为单独改动验收，不与业务修复混做。

浏览器验收需 Playwright 与 Chromium/Edge。本机有 Codex 捆绑运行时可被测试脚本自动找到；其他机器可临时安装：

```powershell
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

验收脚本优先使用 Windows 默认路径的 Edge/Chrome，否则使用 Playwright 浏览器。可通过 `$env:FOCUS_TEST_BROWSER` 指定浏览器可执行文件。`$env:FOCUS_TEST_FILTER` 用于临时按用例名筛选；运行完整验收前移除该变量：

```powershell
Remove-Item Env:FOCUS_TEST_FILTER -ErrorAction SilentlyContinue
npm run test:browser
```

浏览器用例启动临时 loopback 服务，使用独立浏览器上下文、测试数据并阻断外部网络。完整结果和截图写入 `docs/acceptance/`；筛选结果写入 `results-filtered.json`，不能用其替代全量结果。提交前核对截图只有测试数据。

## 3. 修改和生成边界

| 文件/边界 | 维护规则 |
|---|---|
| `local-timer-core.js` | 保持纯状态转换；区分完整番茄、部分片段、正常完成事件与恢复补记，不依赖 React/DOM |
| `local-data.js` | 数据库仍为 `PomodoroDB6` v3；记录和游标同事务提交；导入/删除保留完整备份与设置日志；数据库版本变更须设计迁移 |
| `local-timer-ui.js` | 调用数据服务后更新旧界面；处理任务/子任务清除、订阅释放、跨页刷新、提示与音频 |
| `local-app-ui.js` | 面向用户的更新、关于、删除确认；更新详情不包含维护 Markdown 按钮；错误反馈与关闭清理保持一致 |
| `release.json` | 唯一人工编辑的发布元信息；`report` 字段保留供仓库维护和一致性检查，不作为 UI 入口 |
| `patch.js` | 仍有网络、凭证、主题和 DOM 兼容层；抽离前检查初始化顺序，不全局转换变量或删未知调用分支 |
| `js/main.js` | 已修改的压缩旧包，非可丢弃构建产物；不要替换成原版后假定脚本能重建所有修改 |

只修改独立本地模块时通常不需要编辑旧包。需要改变旧组件接入时，修改对应脚本后在仓库根目录运行：

```powershell
node scripts/revise-timer-integration.cjs
node scripts/revise-app-integration.cjs
node scripts/revise-pomodoro-rendering.cjs
```

三个脚本共用 `scripts/lib/bundle-editor.cjs`，校验已知 1484 个模块的 AST 边界、唯一匹配及编辑重叠，写入前再次解析。番茄渲染脚本维护数字进度转换及完成按钮的异步点击锁。脚本结构断言失败时先检查新 bundle，不能绕过断言强行替换。修改后重复运行并比较哈希，确保结果稳定。

`upgrade-local.cjs`、`upgrade-patch.cjs` 是历史一次性记录，不是最终构建链。没有完整组件源码、依赖清单及原打包配置的恢复流程；高风险拆包应独立推进。

## 4. 版本与用户更新

官方 7.1.1 固定，后续本地版本按三段数字递增，详见版本规范。修改 `release.json` 的版本、日期、更新条目，创建维护报告，再执行 `npm run build:release`。生成器同步 `js/local-release.js`、包版本/作者、页面标题及缓存参数。

通知详情只展示用户能够理解的变化，不添加内部模块、验收技术或 Markdown 下载入口。仓库保留详细报告便于维护；用户无需从产品界面读报告。本次移除报告按钮属于同一未提交版本的交付整理，版本仍为 `7.1.1-local.1.1.1`。

生成器要求 Git remote 名 `Focustodo-local`。新克隆默认 remote 通常为 `origin`，先核对 URL，必要时重命名为 `Focustodo-local`，或在 `release.json` 设置实际 remote 名。不要为了构建添加不属于本项目的仓库地址。日常应用使用已生成地址，无需 Git。

## 5. 验收与提交

```powershell
npm run build:release
npm test
npm run check
npm run test:browser
git diff --check
git diff --stat
git status --short
```

当前全量基线：25 项核心、7 项服务、3 项发布信息、43 项浏览器，共 78 项。新增功能可增加用例数量，报告以实际结果为准。25 秒门槛、深浅主题、重置恢复、停止/叉号/圆圈、快速完成与原始番茄记录渲染、120/145 分钟恢复、事务回滚、导入日志和删除确认是本地版关键回归。

提交前检查生成文件、文档链接、已读状态和截图，确认没有用户备份、真实数据库、账号凭证或临时输出。选择相关文件提交，推送前核对 remote 和远程分支；远端新增提交时先处理分歧，不强推覆盖。

## 6. 已知边界和下轮优先级

优先处理无 Web Locks 时并发导入/删除维护归属、主题图片迁移及多设置原子更新。随后验证真实长时间进程结束/休眠、其他浏览器、大数据库、所有图表/跨日分配/奖励、真实通知和声音。当前长时间自动验收通过测试锚点模拟，不代表已实测两小时休眠。

详细剩余事项见 [本地 1.1.1 报告](UPDATE-7.1.1-local.1.1.1.md) 与 [第二阶段报告](PROGRESS-2026-10-03-stage-2.md)。移除产品内报告按钮不删除这些维护记录。
