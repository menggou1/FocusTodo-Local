# FocusTodo

FocusTodo 专注清单 - 浏览器本地版

官方基础版本 **7.1.1** · 本地版本 **7.1.1-local.1.1.2** · 作者 **Lexible**

## 项目说明

本项目基于 [lamngockhuong/FocusTodo](https://github.com/lamngockhuong/FocusTodo) 修改，为方便开发调试而设计的本地版本。

任务、专注记录和设置保存在浏览器中，运行时无需账号服务器。Bing 壁纸会访问允许的外部来源；关于页的 GitHub 图标在点击后打开[本地版仓库](https://github.com/menggou1/FocusTodo-Local)。本仓库保留原压缩 React 主包，并使用独立本地模块接入，不是已经恢复完整源码的 React 工程。

> **免责声明**：本项目仅供个人学习研究使用。请支持 [FocusTodo 官方](https://focustodo.cn)。

## 必要环境

### 方式一：Node.js（推荐）
- Node.js 18+，本次验收使用 Node.js 24
- 无需全局安装 npm/http-server；运行 `node scripts/server.cjs`
- 默认仅监听 `127.0.0.1:5500`，禁用缓存，支持音频范围请求

### 方式二：Python
- Python 3.6+
- 无需安装任何依赖

请通过本地 HTTP 服务器访问，保持原有主机名和端口。不同地址对应不同的浏览器存储；直接打开文件不属于本次验收范围。

## 快速开始

### Windows
双击 `启动.bat` 或运行 PowerShell `.\start.ps1`

默认访问 `http://127.0.0.1:5500/index.html`。需要手动打开浏览器时，可用 `.\start.ps1 -NoBrowser`；临时指定端口可加 `-Port 5511`，更换端口后不会直接显示旧端口的数据。

### macOS / Linux
```bash
node scripts/server.cjs
# 或使用 Python，保持相同端口和访问地址
python3 -m http.server 5500 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:5500/index.html`。

## 主要功能

- 🍅 番茄钟计时器（25/5/15 分钟可调）
- ✅ 任务管理（清单、子任务、截止日期、提醒）
- 📅 日历视图
- 📊 专注时间报表
- 🎨 自定义主题（Bing 每日壁纸 + 本地上传）
- 💾 数据导出/导入备份
- 🌲 专注森林（阳光奖励）
- 🌐 原应用包含 32 种语言；新增本地界面目前为中文

## 技术栈

- React 16.14.0 + Redux
- jQuery + Moment.js + Bootstrap Datepicker
- IndexedDB (PomodoroDB6) + localStorage
- 纯静态文件，无需后端

## 文件结构

```
FocusTodo/
├── index.html                # 按顺序加载本地模块和旧应用
├── release.json              # 版本、作者、日期、更新内容、Git remote 名
├── patch.js                  # 旧本地兼容、网络、凭证、主题等补丁
├── main.css / local-ui.css   # 原应用样式 / 本地模块样式
├── js/
│   ├── main.js               # 已集成修改的旧 React 压缩包
│   ├── local-release.js      # 生成文件，勿单独手改版本
│   ├── local-timer-core.js   # 纯计时状态和片段结算
│   ├── local-data.js         # 数据库事务、备份、导入、重置
│   ├── local-timer-ui.js     # 计时器接入、恢复确认、音频
│   └── local-app-ui.js       # 关于、更新详情、删除冷却窗口
├── scripts/                  # 本地服务器、元信息生成、AST 接入和语法检查
├── tests/                    # 核心、服务器、发布与浏览器验收
├── docs/                     # 维护指南、版本规范、历史报告和验收截图
├── i18n/ / img/ / audio/ / font/  # 本地资源
└── start.ps1 / 启动.bat       # Windows 启动入口
```

## 数据存储

- **IndexedDB**: 任务、番茄记录、日程等
- **localStorage**: 设置、用户凭证、主题等

计时会话保存在 `PomodoroDB6` v3 的 `TimerSession` 表中。超过 5 分钟的执行中断会要求确认是否计入；停止会保存达到 25 秒门槛的有效片段并归零，取消计时任务只解除关联，任务仍保留在列表中。

设置 → 账号可导出/导入完整 JSON 备份。删除数据无需密码，等待 5 秒后确认；删除前发起备份下载，完成后恢复“本地用户”和默认系统清单并刷新，失败时显示错误。程序无法确认下载已永久保存到磁盘，请保留浏览器下载的备份。清除浏览器站点数据会丢失本地内容，Git 仓库不保存日常使用的浏览器数据库。

右上角铃铛展示面向用户的日期、版本和简短更新详情，并保留原任务提醒。维护报告仅在仓库文档中提供，不在更新窗口展示 Markdown 入口。

## 后续维护入口

先阅读 [维护指南](docs/MAINTENANCE.md)，再按问题定位到 [前端架构](ARCHITECTURE.md) 和 [版本规范](docs/VERSIONING.md)。日常运行无需安装 npm 依赖；修改/检查代码需要从仓库根目录执行 `npm install`，安装 Acorn。浏览器验收另需 Playwright 和浏览器，配置见维护指南。

| 修改内容 | 首选位置 |
|---|---|
| 计时规则、历史片段和停止归零 | `js/local-timer-core.js`，补充核心和浏览器行为验收 |
| 持久化、备份、导入和删除 | `js/local-data.js`，验证事务失败、恢复日志和旧数据兼容 |
| 旧计时器事件/任务关联/声音 | `js/local-timer-ui.js` 与计时 AST 接入脚本 |
| 关于页、更新详情、删除窗口 | `js/local-app-ui.js` 与 `local-ui.css`，必要时修改应用 AST 接入脚本 |
| 版本、作者、日期、简短更新 | `release.json`，随后运行 `npm run build:release` |
| HTTP 服务或 Windows 启动 | `scripts/server.cjs`、`start.ps1` |

不要批量重跑 `scripts/upgrade-*.cjs`；它们是历史一次性改造。不要用删除数据库解决兼容问题，也不要全局替换压缩包字符串。详细边界和提交步骤见维护指南。

## 检查与当前完成范围

```powershell
npm test
node tests/browser-acceptance.cjs
node scripts/check-syntax.cjs
```

浏览器验收需要 Playwright 和 Chromium/Edge；当前测试可使用本机 Codex 自带的 Playwright。业务运行不需要 Playwright 或 Acorn。

当前版本为 `7.1.1-local.1.1.2`、作者 Lexible，官方基础版本固定为 7.1.1。本轮修复完成任务白屏及快速重复点击。更新内容在右上角小铃铛，点击查看详情；关于页提供 GitHub 图标仓库链接。设置中删除数据无需密码，等待 5 秒后可确认，删除前发起完整备份。

自动验收包含 25 项计时核心、7 项服务器、3 项发布一致性及 43 项浏览器测试。主题图片迁移、无 Web Locks 并发维护、真实休眠/长时间杀进程及全部报表奖励回归仍未完成，具体边界见最新报告。

版本和更新条目统一编辑 `release.json`，运行 `npm run build:release` 同步元信息、标题与缓存参数；这不是完整旧 bundle 构建。后续版本规则和维护命令见版本规范。

## 文档

- [前端架构文档](./ARCHITECTURE.md) - 详细的技术架构说明
- [维护指南](docs/MAINTENANCE.md) - 开发准备、修改位置、验收与提交步骤
- [当前详细更新与验收报告](docs/UPDATE-7.1.1-local.1.1.2.md) - 本次修改、验证及未完成清单
- [版本规范](docs/VERSIONING.md)
- [简短更新](CHANGELOG.md)
- [第二阶段历史报告](docs/PROGRESS-2026-10-03-stage-2.md)
- [English](./README_en.md)

## 许可证

请勿用于商业用途，仅供个人学习研究使用。请支持正版软件。
