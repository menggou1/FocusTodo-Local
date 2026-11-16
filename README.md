# FocusTodo

浏览器本地专注清单 · **2.0.0** · 作者 **Lexible** · [English](README_en.md)

FocusTodo 使用 React、TypeScript 和 Vite 从完整应用源码构建。任务、专注记录和设置保存在浏览器中，无需账号服务器。项目源自 [Lâm Ngọc Khương 的 FocusTodo 7.1.1](https://github.com/lamngockhuong/focustodo)，原版及完整历史保留在 `upstream/7.1.1`。

## 安装与运行

从 [Releases](https://github.com/menggou1/FocusTodo-Local/releases) 选择已发布版本。本文描述正在准备的 2.0.0；创建发布 PR 不代表 Release 或线上站点已经更新。

便携 ZIP / tar.gz 解压后安装 Node.js 22.12+，运行 `node scripts/start.cjs` 或 `npm start`；无需安装 npm 依赖。Windows 可双击 `启动.bat`，macOS / Linux 可运行 `sh start.sh`。启动器默认打开 `http://127.0.0.1:5500/index.html`；无桌面环境使用 `--no-browser`，其他端口使用 `--port 5511`。Python 3.7+ 可用 `python scripts/serve-static.py` 作为备用服务。压缩包附有 `SHA256SUMS.txt`，不包含 Node/Python 运行时。

从源码运行需要先构建：

```powershell
npm ci
npm run build:release
npm run build
npm start
```

开发预览使用 `npm run dev`（5511）。它使用独立数据库和设置，拒绝读取日常数据。旧版对照可运行 `node -e "require('./scripts/server.cjs').createServer().listen(5513,'127.0.0.1')"`。测试不得使用 5500 稳定服务。

[GitHub Pages](https://menggou1.github.io/FocusTodo-Local/) 仅由 `main` 的成功流水线部署。网页与本地地址的浏览器存储不同，通过备份迁移数据；不能直接双击 HTML 运行。

## 功能

- 清单、清单夹、标签、任务、子任务、优先级、重复、到期日和提醒。
- 倒计时/正计时、暂停与继续、休息、白噪音、计时组件及支持浏览器中的独立小窗。
- 日/周/月日程、快速创建、拖动安排、手动补记、已完成历史与报表。
- 本地专注森林、阳光收取和成就；功能开关控制顶部入口。
- 明暗主题、内置/上传壁纸；Bing 每日壁纸仅在主动开启外部联网后请求允许的来源。
- 完整 JSON / Gzip 备份、旧版备份导入、体积分析、可选壁纸范围及覆盖前安全备份确认。
- 跟随系统、简体中文和 English；其他既有系统语言词库缺项回退英文。

小组、云同步和在线排名不属于本地版。系统通知、声音、下载和 Document PiP 取决于浏览器及系统能力；减少动态效果设置会关闭相应动画。

## 数据与升级

正式构建继续使用 `PomodoroDB6` v3 和既有设置键。版本标识变为独立三段式 `2.0.0`，来源版本 7.1.1 仅用于来源信息；数据库版本、备份格式和偏好 `Version='6.5'` 不随应用版本改写。同一浏览器、主机名、端口和站点路径下可继续使用原数据；更换 origin 需要导出/导入备份。开发预览使用 `FocusTodoStandalone.PomodoroDB6` 和 `FocusTodoStandalone.data.*`。

升级前导出完整备份。导入支持旧 JSON 和内容识别的 Gzip，文件与解压数据上限均为 128 MB。缺少压缩能力时导出 JSON；旧版需先解压 Gzip。图片目前仍存于 localStorage，受浏览器配额限制。覆盖或清空前下载完整安全备份，并要求确认已保存且可读；取消会保留现有数据。清除站点存储会丢失本地内容。

计时会话持久化在 TimerSession；超过 5 分钟的执行中断需要确认，停止保存满足 25 秒门槛的有效专注片段。回退应先退出所有窗口并保留完整备份，不删除数据库来绕过兼容检查。

## 文档

| 内容 | 入口 |
|---|---|
| 安装、任务与专注使用 | [使用教程](docs/GUIDE.md) |
| 开发、打包、部署与版本规则 | [维护指南](docs/MAINTENANCE.md) |
| React 架构、服务与数据兼容 | [架构说明](docs/ARCHITECTURE.md) |
| 自动化、UI 对照与验证边界 | [测试说明](docs/TESTING.md) |
| 更新与历史证据 | [更新记录](docs/CHANGELOG.md) |
| 未完成工作及人工验收 | [统一待办](docs/BACKLOG.md) |

## 许可证

[MIT License](LICENSE)。保留 Lâm Ngọc Khương 与 Lexible 的版权声明。[第三方声明](THIRD-PARTY-NOTICES.txt)及构建包中的 `licenses/` 保留第三方许可文本。
