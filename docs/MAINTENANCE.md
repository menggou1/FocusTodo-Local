# 后续维护指南

[返回首页](../README.md) · [更新记录与版本报告](../CHANGELOG.md) · [架构说明](../ARCHITECTURE.md)

本文是开发、测试、版本管理与发布的统一入口，已合并原版本规范。当前应用为 `7.1.1-local.1.2.1`。历史报告只记录当时事实，当前步骤和待修复问题以本文为准。

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

## 4. 版本与发布

官方基础版本固定为 **7.1.1**，作者为 **Lexible**。完整版本格式为 `7.1.1-local.<主版本>.<功能版本>.<修复版本>`，Git Tag 只使用本地三段数字：

| 情况 | 完整版本示例 | Tag |
|---|---|---|
| 当前发布 | `7.1.1-local.1.2.1` | `1.2.1` |
| 兼容修复 | `7.1.1-local.1.2.2` | `1.2.2` |
| 兼容功能 | `7.1.1-local.1.3.0` | `1.3.0` |
| 本地不兼容改变 | `7.1.1-local.2.0.0` | `2.0.0`，另附迁移和回退方案 |

历史 `7.1.1-patch.1` 是规范建立前的名称，未额外发布 `7.1.1-local.1.0.0`。npm SemVer 会将带连字符的完整版本视作预发布；本项目按本地三段数字判断更新顺序，不直接与官方 `7.1.1` 比较，也不用字符串字典序。当前通知仅比较是否为不同版本，没有联网更新检查。

`release.json` 是版本、作者、日期、remote 名及更新条目的唯一人工编辑入口，日期按本地发布日 `YYYY-MM-DD`。新版本在 `updates` 首部新增条目及对应报告，保留历史条目。`items` 只写面向用户的简短变化，`report` 供仓库维护和一致性检查，不在产品界面提供报告下载入口。

运行 `npm run build:release` 同步 `js/local-release.js`、包版本/作者、锁文件版本、页面标题及缓存参数；勿单独编辑生成文件。这不能重建旧主包，组件接入使用上一节指定的 AST 脚本。

生成器优先使用 `release.json` 指定的 `Focustodo-local`，缺失时使用新克隆默认的 `origin`，校验 GitHub HTTPS/SSH 地址后生成仓库链接。始终核对 URL；日常应用使用已生成地址，无需 Git，只有用户点击图标才打开仓库。

应用版本、IndexedDB v3 和旧偏好 `Version='6.5'` 用途不同，不要为了统一显示修改数据库兼容标记。通知已读键 `FocusTodo.releaseRead` 在打开最新详情后保存当前完整版本；查看历史详情不会标记最新更新已读，后续版本变化后恢复提示。

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

当前全量包含计时核心、服务、发布信息、启动器和 44 项浏览器用例。便携包使用 Python 3.12+ 执行 `python scripts/package-release.py` 和 `python tests/package-smoke.py`，覆盖 ZIP/tar.gz 解压后的实际启动。报告以实际结果为准。25 秒门槛、深浅主题、重置恢复、停止/叉号/圆圈、快速完成与原始番茄记录渲染、跨标签页初始化同步、120/145 分钟恢复、事务回滚、导入日志和删除确认是本地版关键回归。

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
git -C "<main工作区>" tag -a 1.2.2 -m "Release 1.2.2"
git push Focustodo-local refs/tags/1.2.2
```

### Actions 与发布产物

`.github/workflows/ci.yml` 响应 main 代码推送、面向 main 的 PR、版本号 Tag 和手动触发；不响应工作分支 push，纯 Markdown/docs 修改不自动跑测试，Tag 发布仍执行完整检查。三系统分别跑 Node.js 22/24，Node.js 24 运行完整 Chromium 和便携包验收，浏览器 Artifact 保存 7 天。

版本 Tag 全部检查成功、版本匹配且提交在 main 历史中，才允许发布 ZIP、tar.gz、SHA256SUMS.txt。便携包不含运行时、npm 依赖、Git 状态或测试数据。文档合并/改名必须同步 `scripts/package-release.py`，确保压缩包内的本地文档链接也可用；普通文档整理不覆盖旧 Release。

可清理重复、失败和取消的 Actions 运行记录，保留成功发布验收与最新 Pages 部署。删除运行记录会移除其日志/Artifact，先在版本报告保留失败原因；清理记录不等于修复缺陷。发布失败应检查日志，修复后用新版本，或在尚未创建 Release 时重跑失败任务。

提交前检查生成文件、文档链接、已读状态和截图，确认没有用户备份、真实数据库、账号凭证或临时输出。选择相关文件提交，推送前核对 remote 和远程分支；远端新增提交时先处理分歧，不强推覆盖。

### GitHub Pages 专用部署分支

线上地址为 [GitHub Pages](https://menggou1.github.io/FocusTodo-Local/)。源码与开发继续使用 `main`，Pages 发布源固定为 `gh-pages` 分支的根目录 `/`。`gh-pages` 是长期保留的部署分支，不属于完成后删除的临时测试分支，也不要反向合入 main。

从完整仓库使用 Python 3.12+ 更新部署：

```bash
# 可选：生成本地预览，输出目录必须是新目录
python scripts/deploy-pages.py --output dist/pages-preview
# 从已提交的 main 发布；也可用 --ref 1.2.1 指定已合入 main 的版本
python scripts/deploy-pages.py --push
```

脚本只读取已提交的 main 或其祖先版本，发布浏览器运行资产、`.nojekyll` 和记录来源版本/提交的 `deployment.json`。不发布工作区未提交内容、开发脚本、测试、文档或上游遗留 `CNAME`；保留当前 GitHub 默认域名，不擅自关联其他域名。脚本使用独立临时索引，不切换当前工作区、改动当前索引或强推，后续部署沿 gh-pages 现有历史追加；相同来源重复执行不会重复提交。

仓库 Pages 设置为 Deploy from a branch → `gh-pages` → `/`，使用本机已有 GitHub 认证推送后由 GitHub 构建。普通 `GITHUB_TOKEN` 在工作流里推送分支不会自动触发 Pages 构建；若以后改为完全自动部署，应另行设计 Pages 官方部署工作流，不在仓库中保存个人令牌。

线上地址与本机 loopback 使用不同浏览器存储，数据迁移依赖应用备份导出/导入。部署不会读取或上传本地浏览器数据库。部署后核对 `deployment.json` 的来源提交、Pages 构建状态和项目子路径下的真实页面启动。

## 6. 待修复与验收边界

此前 macOS 跨标签页用例暴露的初始化事件丢失已在 `1.2.1` 修复：计时器先订阅广播，再等待首次初始化，收到的刷新排在现有队列中。新增受控初始化用例同时检查全部记录 ID 与任务进度，避免只观察事件回调就提前判定成功。复现、修补和验收见 [1.2.1 报告](UPDATE-7.1.1-local.1.2.1.md)。

优先处理无 Web Locks 时并发导入/删除维护归属、主题图片迁移及多设置原子更新。随后验证真实长时间进程结束/休眠、其他浏览器、大数据库、所有图表/跨日分配/奖励、真实通知和声音。当前长时间自动验收通过测试锚点模拟，不代表已实测两小时休眠。

历史报告入口统一放在[更新记录](../CHANGELOG.md)，其中的旧通过数量和待办只代表当时状态，不替代本文的当前清单。
