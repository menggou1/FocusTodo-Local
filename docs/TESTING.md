# 测试与验证

[维护](MAINTENANCE.md) · [架构](ARCHITECTURE.md) · [English](en/TESTING.md)

## 运行范围

使用锁定的Playwright及临时浏览器上下文，合成数据、Asia/Shanghai时区、相同语言/主题/视口/DPR和缩放。旧UI基准为1.9.3（f102da8919e810006b6611aabcef5f0159057d61）/1.9.4；5513服务旧源码，5511服务隔离React预览。无独立Playwright MCP时可通过MCP Node运行时或仓库脚本调用同一Playwright。禁止连接5500或日常Profile。

正常自动化使用随机loopback端口；需5513/5511对照时设置FOCUS_RESTORE_SHARED=1，先确认两个进程归属。FOCUS_RESTORE_NEW_PORT可选择已构建的隔离服务。FOCUS_ACCEPTANCE_DIR指定本轮证据目录。截图、帧采样、computed style、IDB回读和注入失败反例共同验证，测试数量不能代替UI验收。

## 命令与证据

| 验证 | 命令/测试入口 |
|---|---|
| 类型与正式/隔离构建 | npm run build；npm run build:standalone |
| 旧兼容单元/语法 | npm test；npm run check |
| 服务纯核心差分、并发、故障回滚、版本、备份 | node --test tests/standalone/*.test.cjs |
| 隔离三引擎启动/任务/领域/服务/解压包 | npm run test:standalone |
| 生产同origin升级/子路径/元信息/下载备份 | npm run test:release-app |
| 旧兼容完整浏览器场景 | npm run test:browser |
| 最终四项和共享弹窗矩阵 | node tests/standalone/final-ui-parity.cjs |
| 报表/已完成/清单夹 | node tests/standalone/reports-parity.cjs |
| 任务状态、菜单、选择器和确认框 | node tests/standalone/r2-r3-overlays-parity.cjs |
| 设置六页及备份 | node tests/standalone/visual-settings.cjs；node tests/standalone/r4-r5-settings-drag-parity.cjs |
| 计时、模式、白噪音、组件、森林 | node tests/standalone/visual-timer-forest.cjs |
| 日程及弹窗关闭动画 | node tests/standalone/calendar-overlay-equivalence.cjs |
| 全局窗口/滚动/动画 | node tests/standalone/window-scroll-equivalence.cjs |
| 发布版本/附件门禁 | python tests/release/release-gate-test.py |
| 已提交Pages构建 | python tests/release/pages-build-test.py |
| 两种正式压缩包及备用启动 | python scripts/package-release.py；python tests/release/package-smoke.py |

CI的三平台×Node22/24完整矩阵、Chromium以及LinuxFirefox/WebKit范围见维护指南。新增测试必须验证实际行为，不以删断言、跳过失败、缩减数据或降低像素要求换取通过。UI脚本使用FOCUS_TEST_FILTER等选择项时必须注明只验证了选中范围；正式审计不能复用旧结果当成本轮复测。

## 首帧、动画与弹窗审计方法

番茄时间轴用超过70天的合成记录暴露原先330px初值与最终画布高度不一致的问题。逐帧检查CSS高度、bitmap/DPR、坐标轴与揭示进度；初帧即要求最终行距，随后从下往上显示。字体/ResizeObserver重绘不能重新挤压布局。保留注入错误高度/层级/动画的失败反例。

逐类审计覆盖普通/重复任务删除、停止计时、清单隐藏/删除、清单/清单夹/标签创建编辑（含嵌套）、补记/编辑记录、日程快速创建和详情、设置页及备份导入/导出/清空、安全备份确认、自定义主题删除、计时模式、白噪音、组件编辑、中断恢复、更新记录/通知、日期/优先级/标签/番茄/任务等实际弹层。核对尺寸、字体、按钮顺序、遮罩、主题、层级、滚动、取消与确认、焦点返回及动画。浏览器/系统提供的文件选择、通知权限与Document PiP由平台控制，检查触发与能力降级，不宣称可重绘系统UI。

## 迁移保留的基线与历史证据

原docs/2.0.0的服务合同已并入架构文档，下面保留可复用的审计事实与取样边界；逐轮原始报告仍在Git历史。历史结果不表示当前提交或人工验收通过。

- 2026-11-07基线在Windows/Node24.16/npm11.16取样；旧主包2231533字节、旧CSS421259字节（非压缩）。审计工具在tests/performance/audit-*.cjs，历史产物在docs/acceptance/2.0.0-a等目录。
- 数据基准包括10份授权历史备份的隔离内存差分、任务/设置字段和未知兼容信息保留；不能公开私人备份，也不能据此宣称真实Profile原地升级完成。当前CI只使用生成数据。
- 已记录过三引擎旧新客户端协议/schema拒写、事务故障回滚、主题恢复日志、备份往返、同schema版本命名往返；不能推广为任意未来版本可降级。
- 历史UI回归包括计时/森林/设置/工作区/日程/报表、字体与控件几何、滚动、原始图标、指针/键盘和中英明暗状态。成就使用共享ScrollView是已接受的旧版差异。
- 2026-11-15历史结果：设置专项单元60项，三引擎工作区60项，三引擎服务浏览器31项；Bing使用可控响应。这些是历史取样，不是本轮最终数量。
- 既往计时组件/森林采样存在长帧；Vite开发预览与旧生产包条件不同，不能据此直接归因或宣称性能等价。系统缩放、真实Safari/声音和实际长期数据的证据只在BACKLOG跟进。
- 已知纽约回拨日的日程轴/历史偏移提示问题按BACKLOG V03维护，不修改历史时间戳掩盖结果。App版本、DB v3和旧Version='6.5'分别维护。
- 上游版本、版权和分发许可证见根LICENSE及THIRD-PARTY-NOTICES.txt；React、ReactDOM、scheduler与Noto字体完整文本进入运行包。静态依赖识别仅是旧包取证，不作为新版运行时依赖声明。

本轮实际结果和逐类弹窗审计见[2.0.0报告](releases/UPDATE-2.0.0.md)，未完成事项仅见[BACKLOG](BACKLOG.md)。正式Release附件、线上deployment.json与部署后行为只在发布后验证，不在准备阶段提前标为通过。
