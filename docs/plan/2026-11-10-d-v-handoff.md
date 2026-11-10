# D-V 接管与快速预览验证

日期：2026-11-10（Asia/Shanghai）。本次按用户要求完成 D-R4 检查点与快速预览，然后停止供人工检查。

## 检查点

`69cd2e3f9acf77c1c2b0667e199dddcceaa7adeb`：`refactor(standalone): checkpoint D-R4 before visual parity`。

审阅 AGENTS、维护指南、D-R3/D-R4、S1/S2 归档、交互等价清单及全部 21 个变更文件；均属于 D-R 成果，未发现无关或来源不明修改。原样保留既有成果，包括历史报告的 Markdown 双空格换行（Git whitespace 检查提示）；未纳入 dist、缓存或截图。旧版 src/public 与 Tag 1.9.3 无差异。提交后工作区干净。

本次重新执行：类型检查与构建通过；standalone 单测 59/59；旧版单测 92 通过、1 跳过；syntax check 通过；Workspace Chromium 20/20；Domain Chromium 11/11，包括日历安排→计时→记录→报表。三引擎和完整视觉矩阵为 D-R4 既有证据，本次没有重跑。构建仍提示大 chunk。

## 快速预览

```powershell
Set-Location D:\document\projects\Focustodo-dev
npm run dev -- --host 127.0.0.1 --port 5511 --strictPort
# 或
.\scripts\preview-standalone.ps1
```

URL：`http://127.0.0.1:5511/`。普通浏览器直接打开，不依赖 Playwright。脚本不清理、不构建、不安装依赖，不自动打开浏览器、不终止其他进程；Ctrl+C 停止前台服务。缺少依赖时先 npm ci。

实际使用 Windows PowerShell 运行脚本成功；独立 Chromium context 验证 app-shell 渲染、搜索框指针点击，无 pageerror。临时分别修改 CSS 与 App 组件后，计算样式和组件属性热更新成功，文档标记保留，没有整页 reload；验证内容随后逐字节恢复。截图仅留在 dist/acceptance/d-v-preview.png。重复启动脚本以非零状态报 Port 5511 is already in use，原预览继续运行。

## D-V 方法与边界

逐组件采用 1.9.3 在 5513 的运行时 DOM、CSS、计算样式、交互与动画为权威；先提取再比较，只修改目标组件及相关逻辑/样式。每轮保留业务断言、浏览器自动化和实际指针操作证据。现有 sidebar-interactions 对新版排序使用合成 DragEvent，不能证明实际指针拖动体验；既有全屏动画门禁也不证明停止确认或轨道整体宽度一致。

任务顺序与未完成状态统一见 [BACKLOG E09](../BACKLOG.md)，差异编号见 [交互等价清单](2.0.0-interaction-equivalence.md)。清单内 D-R4“未开始”等早期描述由 D-R4 报告与本次记录更正；本次仅完成 D-V 准备，没有 UI 修复或整体视觉一致结论。

5511 保留预览供用户检查；5512/5513 本次没有启动或访问。未访问或操作 5500；未接触真实浏览器 Profile 或真实库。仅本地提交，未推送、合并、发布，未进入 E/F。
