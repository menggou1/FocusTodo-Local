# 7.1.1-local.1.4.1 — 渐进启动、语言字体与兼容模块整理

[更新记录](../CHANGELOG.md) · [维护指南](MAINTENANCE.md)

日期：2026-10-26（Asia/Shanghai）。作者：Lexible。应用版本：`7.1.1-local.1.4.1`。本次交付范围为本地修补、main 合并与官方 Actions Pages 部署。

## 已实现行为

- HTML 内置轻量骨架、系统字体和启动控制器；应用 CSS、脚本尚未下载完成时也能显示第一屏。骨架不展示伪造的用户清单和计时结果。
- 两个应用样式表异步加载，13 个脚本并行下载、按原依赖顺序执行。主脚本提前请求；本地数据恢复仍在应用挂载前完成。应用与必要样式就绪即展示真实界面，无需等待所有图片、字体或整个 `window.load`。
- 进度条按 15 个必要资源的实际完成事件及真实界面挂载，共 16 个启动步骤更新；数字表示步骤数，不代表下载字节或剩余秒数。没有按时间虚增的百分比。
- 等待 15 秒后解释加载较久，并提供重新加载。资源请求失败、初始化异常或数据恢复失败时显示失败提示与重试；重试只刷新页面，不清理用户数据。
- 启动界面支持简体中文/英语、已有深色偏好、系统深色、窄屏、键盘重试和减少动态效果。禁用 JavaScript 时仍显示启用提示。
- 中英文直接复用已生成的完整词库，省去启动时额外的语言文件请求和不存在的 `strings_zh.txt` 请求。其他系统语言保留原解析/格式化器，改为异步请求；跳过空的区域文件，失败请求也结算队列并使用已有英文回退，避免异步完成一直悬挂。
- 中文界面首选附带的 Noto Sans SC，加载前使用系统字体，下载完成后通过 `font-display: swap` 自动应用；英文首选系统西文字体，不触发附带中文字体下载。启动界面、主界面和本地弹窗使用同一语言字体变量。番茄钟的普通/翻页数字与全屏字体声明恢复并保持归档官方 7.1.1 的字体顺序。
- 将旧补丁按功能并入已有服务：身份与原生存储保护归入 `local-data.js`，备份编码和备份界面归入 `local-backup.js`，偏好兼容归入 `local-settings-ui.js`，主题存储/恢复和主题界面归入 `local-theme-storage.js`。网络策略独立为 `local-network.js`；`patch.js` 只负责按原顺序安装，重复安装不重写 API 或重复恢复。
- 确认 jQuery 使用 bundle 内模块导出且无 `window.jQuery` 实例，移除从未接入该实例的 50 ms 全局拦截轮询及其用户名/删除模拟分支；删除无人调用的 `testSetUsername` 调试入口和用户名调试输出。实际用户资料修改的 XHR 路径与当前本地 reset 入口保留并验证。
- 删除页面中的强制禁用缓存元信息，继续通过版本参数区分发布资源，实际 HTTP 缓存由主机决定。

## 验证记录

本地验证覆盖单元检查、语法、启动与字体、模块重复安装、实际账号修改/删除、备份、主题、计时及并发维护。证据在 `docs/acceptance/results.json`、`startup-results.json`、`typography-*.png` 与 `startup-*.png`，只使用隔离生成数据。

字体专项在附带字体请求被阻塞时确认工作区已显示；完成下载后，通过浏览器字体接口确认中文文本实际使用 Noto Sans SC。英文界面确认不请求附带中文字体。番茄钟字体声明与归档提交 `fe15a1d9201c6298f1c28c16dcb0b58c481f9999` 的 CSS 比对。旧应用接入脚本重复执行后的主包 SHA256 一致。

本地最终结果：单元检查 57 项通过、1 项 POSIX 平台跳过；语法检查通过；14 项启动/字体、57 项业务浏览器和 7 项维护并发场景全部通过。ZIP/tar.gz 通过含空格和中文目录的解压启动、文档链接、运行资源及 SHA256 检查。重置用例按历史/任务已清空、计时为空闲且无遗留区间核对，覆盖重载时适配器先写入空闲会话的时序。

## 冷启动对比

执行 `node tests/startup-performance.cjs 89274a1`，在同一台机器上分别使用新的空白浏览器上下文、禁用 HTTP 缓存、150 ms 模拟延迟和 200 KiB/s 下载速度，各取一次。服务地址使用 `/FocusTodo-Local/` 项目子路径；双方同样拦截可选字体和图片，以比较必要资源与语言初始化。基线的已修改既有启动文件均取自已提交的基线，包括入口、样式、主脚本、语言、版本、数据、备份、设置、主题模块与旧 patch.js；未改动资源共享当前文件。

| 指标 | 基线 `89274a1` | 本次工作版本 |
|---|---:|---:|
| 首次内容绘制 FCP | 17.828 秒 | 0.332 秒 |
| 工作区 DOM/CSS 就绪 | 17.759 秒 | 15.154 秒 |
| 未处理页面异常 | 0 | 0 |

原始结果在 `docs/acceptance/startup-performance.json`。FCP 是浏览器实际首次内容绘制；就绪时间是测试观察到工作区 DOM 已挂载且样式可见的时刻，可能略早于一次实际绘制。这是一次本地模拟测量，不是线上 Pages 速度保证；主要收益是尽早提供反馈，完整旧主包仍需下载，不能将首屏绘制时间描述为整个应用全部加载完成。

## Pages 部署方式记录

当前方式已通过 `main` 上的 [.github/workflows/pages.yml](https://github.com/menggou1/FocusTodo-Local/blob/main/.github/workflows/pages.yml) 核对：2026-10-26 开始本次工作时，基线提交为 `89274a1`（`ci: migrate Pages to official artifact deployment`）。

`main` 推送或在 main 上手动运行 **Deploy GitHub Pages** → 按白名单生成 `dist/pages` → 官方 `upload-pages-artifact` 上传 → `deploy-pages` 通过 `github-pages` 环境发布。仓库 Pages Source 使用 GitHub Actions；不再写入或依赖 `gh-pages`，构建脚本没有 `--push` / `--remote`。构建使用 `contents: read`，部署使用 `pages: write` / `id-token: write`，不需要个人令牌。

本次内联的启动样式和控制器由 `npm run build:release` 从 `startup.css` / `js/local-startup.js` 生成进 `index.html`；网络模块与归并后的功能模块均位于既有 `js/` 白名单。`scripts/deploy-pages.py` 同时检查这些必需文件存在，产物保留记录版本和来源提交的 `deployment.json`。
