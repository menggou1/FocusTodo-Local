# FocusTodo 7.1.1-local.1.2.3 更新与验收报告

- 日期：2026-10-22
- 作者：Lexible
- Git Tag：`1.2.3`

## 修复内容

通知面板原先将版本更新限制在 `40vh`，随后固定预留 264 像素给任务提醒。没有提醒时仍显示大片空白，长历史被压进上半部；旧验收只检查提醒区域位于面板内，没有证明末条更新可见、可点击。

现在标题固定，版本更新与任务提醒共用一个原生滚动区域，面板受可用视口高度限制；空提醒列表不占位，保留既有提醒文本、深浅主题和详情弹窗。原 bundle 与对应接入脚本同步修改，避免重新接入时恢复旧布局。版本号更新并刷新静态资源缓存标识，保留用户任务、设置和数据库版本。

## 云端发现的窗口缩放兼容问题

候选标签 `1.2.2` 在本机 Edge 通过，但三系统云端 Playwright Chromium 在新增窗口缩放用例报 `Cannot read properties of undefined (reading 'storage')`。日志定位到旧 `window.onresize`：它依赖旧平台标志直接访问 `window.chrome.storage` 或 `window.browser.storage`，普通网页环境不一定具备这些扩展对象。

修复为仅在存在真实扩展 runtime ID 和 sync.set 接口时保存扩展窗口尺寸；普通网页始终继续发送原布局刷新事件。没有添加假的扩展存储，也没有忽略页面异常或移除缩放断言。接入脚本同步此守卫。`1.2.2` 被发布门禁拦截，没有创建 Release；保留该标签和失败证据，最终修复使用新标签 `1.2.3`。本轮同时补齐 README、架构和维护文档的当前版本标注。

## 文档整理

历史 `7.1.1-patch.1` 的第一、第二阶段合并为 [UPDATE-7.1.1-patch.1.md](UPDATE-7.1.1-patch.1.md)，保留两阶段原始范围、测试结果和当时未完成事项。移除独立第二阶段文件，更新 CHANGELOG、发布元数据和报告内链接。便携包继续包含合并后的文档，不改变历史 Release。

## 验收与交付

最终候选本机结果（Chromium）：7 个业务脚本语法检查通过；38 项核心、HTTP、版本和启动检查通过，1 项 POSIX 专属检查按 Windows 平台跳过；45 项完整浏览器验收全部通过，机器结果见该版本提交的 `docs/acceptance/results.json`。ZIP/tar.gz 解压后在含空格、中文路径启动通过，错误 Tag 拒绝检查通过；49 个本地 Markdown 链接与锚点有效。新增通知用例覆盖正常视口、较小视口及等效 125% 缩放后的 CSS 视口，验证空提醒零占位、末条更新未被覆盖且可打开、滚动时标题固定；既有任务提醒和深浅主题继续回归。

本机验收使用临时服务器与独立浏览器上下文，不操作用户数据库。三系统 Node.js 22/24 检查和便携包由版本 Tag 的 Actions 门禁执行；通过后发布 Release。源码先合入 main 再推送，`gh-pages` 专门承载同版本静态内容。云端结果以对应 [Actions](https://github.com/menggou1/FocusTodo-Local/actions) 和 [Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.2.3) 为准。

当前边界：未新增真实系统休眠、长期运行或所有浏览器引擎验证；已有数据维护并发、主题迁移等待办见[维护指南](MAINTENANCE.md)。
