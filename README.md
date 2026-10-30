# FocusTodo

FocusTodo 专注清单 - 浏览器本地版

官方基础版本 **7.1.1** · 本地版本 **7.1.1-local.1.7.5** · 作者 **Lexible** · [English](README_en.md)

## 项目说明

本项目基于 [lamngockhuong/FocusTodo](https://github.com/lamngockhuong/focustodo) 的 7.1.1 版本持续维护，现为独立仓库。上游原版单独保存在 `upstream/7.1.1` 分支，来源、校验和分支用途见[维护指南](docs/MAINTENANCE.md#7-源码来源与原版归档)。

任务、专注记录和设置保存在浏览器中，运行时无需账号服务器。Bing 壁纸会访问允许的外部来源；关于页的 GitHub 图标在点击后打开[本地版仓库](https://github.com/menggou1/FocusTodo-Local)。本仓库保留原压缩 React 主包，并使用独立本地模块接入，不是已经恢复完整源码的 React 工程。

> **免责声明**：本项目仅供个人学习研究使用。请支持 [FocusTodo 官方](https://focustodo.cn)。

## 必要环境

### 方式一：Node.js（推荐）
- Node.js 22+；CI 覆盖 Windows、macOS、Linux 的 Node.js 22/24
- 无需安装应用依赖；运行 `node scripts/start.cjs` 或 `npm start`
- 默认仅监听 `127.0.0.1:5500`，禁用缓存，支持音频范围请求

### 方式二：Python
- Python 3.7+（手动启动备用方式）
- 无需安装任何依赖

请通过本地 HTTP 服务器访问，保持原有主机名和端口。不同地址对应不同的浏览器存储；直接打开文件不属于本次验收范围。

## 快速开始

在线使用：[GitHub Pages](https://menggou1.github.io/FocusTodo-Local/)。线上站点与本地 `127.0.0.1` 地址使用不同的浏览器存储，迁移数据请先导出备份再导入。

Pages 随 `main` 推送由官方 Actions 自动部署，沿用运行文件白名单；`main` 保留完整项目，无需维护 `gh-pages`。部署与本地预览见[维护指南](docs/MAINTENANCE.md)。

从 [Releases](https://github.com/menggou1/FocusTodo-Local/releases) 下载 ZIP 或 tar.gz 并解压，安装 Node.js 22+。三个系统使用同一份便携包，无需运行 `npm install`。发布附带 `SHA256SUMS.txt`，运行时需自行安装，不包含在压缩包中。

三个系统通用：`node scripts/start.cjs` 或 `npm start`。成功启动后自动打开浏览器；无桌面环境可用 `node scripts/start.cjs --no-browser`，指定端口用 `--port 5511`（npm 方式为 `npm start -- --no-browser --port 5511`）。

### Windows
双击 `启动.bat` 或运行 PowerShell `.\start.ps1`

默认访问 `http://127.0.0.1:5500/index.html`。需要手动打开浏览器时，可用 `.\start.ps1 -NoBrowser`；临时指定端口可加 `-Port 5511`，更换端口后不会直接显示旧端口的数据。

### macOS / Linux
```bash
sh start.sh
# 无桌面环境或自定义端口：sh start.sh --no-browser --port 5511
# 或使用 Python，保持相同端口和访问地址
python3 -m http.server 5500 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:5500/index.html`。

## 主要功能

- 🍅 番茄钟计时器（25/5/15 分钟可调）
- ✅ 任务管理（清单、子任务、截止日期、提醒）
- 📅 日程视图、快速建任务、重叠布局和从安排开始专注
- 📊 专注时间报表
- 🎨 自定义主题（Bing 每日壁纸 + 本地上传）
- 💾 完整 Gzip / JSON 备份、旧版导入、体积分析与壁纸范围选择
- 🌐 通用设置可选择跟随系统、简体中文或 English；其他既有翻译只通过跟随系统启用，缺失内容回退英文
- 🔔 通用设置可主动允许和测试桌面通知

专注森林沿用原版入口、树木和阳光收取，设置 → 通用可开关；阳光无需联网且没有每日收取上限；收取沿原版路径飞向树木，支持减少动态效果。成就按照累计专注、已完成任务和专注记录结束的自然日统计，铜、银、金奖杯解锁后一次性发放阳光。小组和在线排名仍不属于本地版。

设置 → 通用 → 语言可选择“跟随系统、简体中文、English”；切换后刷新同一地址，任务与记录保留。其他已有部分翻译只由跟随系统启用，缺项使用可读回退内容。[英文文档入口](docs/en/README.md)提供使用、维护、架构、待办与版本技术报告。

## 数据存储

- **IndexedDB**: 任务、番茄记录、日程等
- **localStorage**: 设置、用户凭证、主题等

计时会话保存在 `PomodoroDB6` v3 的 `TimerSession` 表中。超过 5 分钟的执行中断会要求确认是否计入；停止会保存达到 25 秒门槛的有效片段并归零，取消计时任务只解除关联，任务仍保留在列表中。

设置 → 账号可查看各类数据体积和记录数，默认下载完整 `.json.gz` 无损压缩备份，也可选择普通 JSON 或不含壁纸。导入按内容识别旧 v1/v2 JSON 和 Gzip，先显示范围再确认覆盖；不含壁纸时回退到内置主题。缺少压缩能力时导出回退到 JSON，导入 Gzip 需要解压能力；文件和解压数据上限均为 128 MB。旧版应用不直接支持 Gzip。

删除数据无需密码，等待 5 秒后确认；导入前和删除前均发起完整 JSON 安全备份，完成后刷新，失败时显示错误并恢复。图片仍存于 localStorage，大图片恢复受浏览器配额约束。程序无法确认下载已永久保存到磁盘，请检查浏览器下载文件。清除浏览器站点数据会丢失本地内容，Git 仓库不保存日常使用的浏览器数据库。

右上角铃铛展示面向用户的日期、版本和简短更新详情，并保留原任务提醒。维护报告仅在仓库文档中提供，不在更新窗口展示 Markdown 入口。

## 文档导航

| 你想做什么 | 从这里开始 |
|---|---|
| 学习任务、计时、日程和备份 | [使用教程](docs/GUIDE.md) |
| 看版本变化、发布验收或历史报告 | [更新记录](CHANGELOG.md) |
| 开发、测试或发布新版本 | [开发维护指南](docs/MAINTENANCE.md) |
| 未完成工程、验收与未来计划 | [统一待办与验收](docs/BACKLOG.md) |
| 理解模块、数据库、计时与旧主包之间的关系 | [架构说明](ARCHITECTURE.md) |

更新记录按版本链接详细报告；维护指南已包含版本规范和发布步骤。日常使用只需按本页启动，无需逐篇阅读历史报告。开发先运行 `npm ci`，其余准备和检查命令集中在维护指南。

## 许可证

请勿用于商业用途，仅供个人学习研究使用。请支持正版软件。
