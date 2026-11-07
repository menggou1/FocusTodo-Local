# 7.1.1-local.1.9.0 更新报告

[更新记录](../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [统一待办](../BACKLOG.md)

日期：2026-11-07（Asia/Shanghai）。作者：Lexible。

## 行为与兼容

- 设置 → 通用 → 功能开关加入外部联网（实验性），默认关闭。关闭时点击 Bing 每日主题，复用补记时间的全局底部提示显示“请打开外部联网”，不会切换主题或发出壁纸请求。已有主题图片仍可离线恢复；开启后才允许选择、获取或自动刷新 Bing。
- 壁纸元数据与图片使用可取消的 fetch，拒绝重定向，省略凭据与来源信息。图片只接受 HTTPS 精确 Bing 域名，下载为 Blob 后再在本地处理；CSP 不允许直接加载远程图片。关闭开关或维护时丢弃过期结果，失败时保留已保存图片。缓存同时检查 12 小时期限与本地日期。
- 主题写入和启动恢复复用现有 IndexedDB 维护事务锁；没有 Web Locks 仍按真实事务归属排队，不靠超时接管。写入前比较三项旧值，拒绝过期覆盖；异步图片下载不占用锁。
- 缩小计时器时优先请求 Document Picture-in-Picture，显示当前任务、计时和状态，开始/暂停/停止复用原适配器。没有 API 或打开失败时提示并回退页内浮动计时器。迷你窗口不创建 tick、数据库或业务会话，关闭/维护/主页面退出时清理引用。
- 最新版本未读条目右上角直接复用通知图标内的小红点；打开最新详情后清除，查看历史详情不标记最新已读。恢复默认排序复用按钮和内部防重复提交锁，保存时不再临时禁用、闪烁或切换等待光标。
- 通用设置复用原滚动容器，较小窗口中也可滚动访问新增开关。停用本地版不使用的旧云消息订阅，避免 Firefox 因 WebSocket 被 CSP 拒绝而中断启动；拦截的 XHR 使用不实际发送的同源占位地址。

数据库保持 PomodoroDB6 v3；偏好、主题存储键、计时会话和历史格式延续旧版。新增可选偏好 `FocusTodo.externalNetwork` 缺省视为关闭，随原完整备份保留。回退到 1.8.x 前导出备份；旧版忽略此开关，仍会按旧规则访问 Bing，不保证 1.9 的网络边界。迷你窗口属于临时视图，无需迁移。

迷你窗口遵循 [Chrome Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) 的用户手势和关闭生命周期，不承诺原生窗口权限。

## 验证证据

- Windows / Node 24：93 项单元中 92 通过，1 项 POSIX 专属跳过；语法、发布生成及差异空白检查通过。
- 全量隔离 Edge：18 项启动、66 项应用、8 项维护、31 项日程及清单、音频、资料、森林、成就、提醒和四组中英/亮暗共用控件检查通过。主题提交、XHR 与后续设置滚动调整另有专项复验。
- 1.9 独立 9 项场景通过：默认关闭与键盘底部提示、红点与跨标签已读、图片/元数据重定向零目的地请求、跨日刷新/取消、无 Web Locks/BroadcastChannel 的主题冲突、超时/断网缓存、排队缓存切换在关闭联网或出现较新选择后取消、API 缺失/拒绝回退、原生迷你窗口控制与清理。迷你窗口额外按 340×280 验证按钮边界，并验证休息阶段和跨标签状态。
- 隔离 Edge 真实联网：Bing 元数据和图片均返回 HTTP 200，壁纸成功保存并激活。超时、故障、重定向及跨日场景使用受控请求和模拟时间，未将其写成真实服务跨日长期观测。
- Firefox/WebKit × 中英共 4 组隔离场景通过：启动、任务保存、开始/暂停/停止、重新加载恢复、主题保存、备份导入；强制移除 Document PiP、BroadcastChannel、Web Locks 和压缩 API 后仍可降级运行，未产生 CSP 违规。这是引擎自动化结果，不代表真实 Safari 全量验收。
- Python 3.12：ZIP/tar.gz 在包含空格和中文、无 npm/Git 的路径中解压启动，Python 回退启动及错误 Tag 拒绝通过；包内文档链接验证通过。

自动化 JSON 与截图输出到 `dist/acceptance/`，CI 保存为 `acceptance-<系统>` 附件。未完成的真实环境范围只保留在 [BACKLOG](../BACKLOG.md)。

[1.9.0 发布与便携包](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.9.0) · [版本流水线](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.9.0) · [Pages](https://menggou1.github.io/FocusTodo-Local/)。
