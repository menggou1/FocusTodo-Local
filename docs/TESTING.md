# 测试与验证

[维护](MAINTENANCE.md) · [架构](ARCHITECTURE.md) · [English](en/TESTING.md)

## 环境与隔离

使用锁定的 Playwright、临时浏览器上下文与合成数据。浏览器时区为 Asia/Shanghai；对照测试统一语言、主题、视口、DPR、缩放与动画偏好。禁止连接稳定版 5500、日常 Profile、真实数据库或私人备份。

`npx playwright install chromium firefox webkit` 安装测试引擎；Linux CI 使用 --with-deps 安装系统依赖。默认使用随机 loopback 端口。FOCUS_ACCEPTANCE_DIR 选择本轮证据目录；FOCUS_STANDALONE_ENGINES 可指定 chromium,firefox,webkit，完整验收应覆盖三者。FOCUS_TEST_FILTER 仅供定位，选择性结果不能代替完整通过。

## 正式应用门禁

先执行 npm ci、npm run build:release、npm run check、npm run build、npm run build:standalone 和 npm run package:standalone。

| 验证 | 命令 |
|---|---|
| 单元、数据校验、生产服务和版本元信息 | `npm test` |
| 服务合同、计时差分、并发、回滚、兼容和备份 | `node --test tests/standalone/*.test.cjs` |
| React 三引擎启动、任务、领域页面、真实存储及隔离解压包 | `npm run test:standalone` |
| 正式同 origin 的 1.9.4 升级、ID/设置、备份、子路径和白名单 | `npm run test:release-app` |
| 全部历史浏览器回归，对独立归档运行 | `npm run test:browser` |
| 历史 Firefox/WebKit 能力降级基线 | `npm run test:compat` |
| 中英明暗 UI、共享弹窗与首帧动画 | `node tests/standalone/final-ui-parity.cjs` |
| 详情删除、子任务标志及保留/清除记录 | `node tests/standalone/inspector-dialog-parity.cjs` |
| 发布版本、校验和、篡改拒绝及工作流门禁 | `python tests/release/release-gate-test.py` |
| 正式 ZIP/tar.gz 与 Python 备用启动 | `python scripts/package-release.py`，`python tests/release/package-smoke.py` |
| 已提交来源的 Pages 内容逐字节核对 | `python tests/release/pages-build-test.py`（先提交构建输入） |

CI 验证 Windows/macOS/Linux × Node 22/24；Node 24 跑 Chromium 和相同便携包，Linux 另跑 Firefox/WebKit。三引擎 React 用例涵盖失败启动重试、生命周期、命名空间保护、任务/日程/计时/报表/森林/设置、下载导入和维护锁。WebKit 不代表真实 Safari 人工验收。任何失败都保留断言和诊断，不靠跳过、重试掩盖或放宽质量要求通过。

## 历史基线与 UI 对照

tests/helpers/legacy-runtime.cjs 只读使用现有 archive/1.9.4 工作树，固定提交 b0ee5e26c133ea273e1634fa52b8a107e1649a69；也可显式指定 FOCUS_LEGACY_ROOT。CI 仅在测试作业检出固定归档。旧实现不复制到 dev 的生产目录，不参与正式构建、打包或 Pages。历史单元与差分仍检验旧 JSON/Gzip、计时、日程、设置及未知兼容字段；这些测试不代表 React 界面本身通过。

paired 对照默认为归档和隔离 React 各启动随机端口，均使用临时上下文。FOCUS_RESTORE_SHARED=1 仅用于人工准备的 5513/5511 对照服务；先核对进程来源，FOCUS_RESTORE_NEW_PORT 可选择隔离服务端口。不得用它接入稳定服务。

专项脚本保留在 tests/standalone：reports-parity、r2-r3-overlays-parity、visual-settings、r4-r5-settings-drag-parity、visual-timer-forest、calendar-overlay-equivalence 和 window-scroll-equivalence。这些检查覆盖实际 DOM、computed style、截图、输入和动画；已修复的旧版缺陷不回退。历史一次性 bundle 审计工具已删除，原结果保留在 Git 历史与 docs/acceptance。

## 判定与证据

时间轴用超过 70 天的合成记录，逐帧核对 CSS 高度、bitmap/DPR、坐标轴和从下往上的揭示。字体与 ResizeObserver 不能挤压行距。弹窗检查覆盖停止、普通/重复任务删除、子任务、清单/文件夹/标签、补记、日程、设置、备份/清空、安全确认、主题删除、计时组件、恢复、更新与各选择器，核对取消/确认、焦点返回、层级和动画，保留注入错误反例。

森林奖励场景在应用启动前固定时钟，并在完成任务后切换到确定的次日时刻；41g 收取、61g 余额及重复收取不加分保持精确断言，避免引擎安装时钟时的毫秒边界影响结果。

当前提交结果写入版本报告；历史验证文件注明取样日期，不能当作当前 SHA 的复测。自动化不证明人工视觉接受、真实长期数据升级、Safari、系统声音/通知、下载保存或真实 Bing 边界。未完成范围和发布前检查只维护在 [BACKLOG](BACKLOG.md)。

`node tests/standalone/settings-regression.cjs` 使用合成数据、随机隔离端口验证设置、头像、主题解码、菜单、音频反馈及文件选择结果；`node tests/standalone/settings-legacy-reference.cjs` 只核对指定的旧版控件与 VolumeTip 资源。Windows 使用 `FOCUS_TEST_BUNDLED_BROWSER=1` 选择 Playwright 自带 Chromium，使用独立浏览器安装；不要接入日常 Profile。Chromium/Firefox 的短 WAV 提示音专项测试通过同字节 Blob 执行原生解码与播放，仅在该测试页面允许 Blob 媒体，以避免宿主下载管理器截获响应；Windows WebKit 不支持这条 Blob 播放路径，使用真实打包 URL 和原有 CSP。专项测试同时核对正式构建内 WAV 字节，其他回归保持产品的原始传输与安全策略。

`python tests/release/ci-validation-test.py` 验证同 SHA CI 复用的来源、六项矩阵、附件有效期/摘要/测试时序、更新失败记录、非法跳过和安全解包；`release-gate-test.py` 验证独立证据门禁与发布/Pages 依赖，不能将普通 skipped 当作通过。
