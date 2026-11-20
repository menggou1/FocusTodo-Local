# FocusTodo 2.1.2

[更新记录](../CHANGELOG.md) · [English](../en/releases/UPDATE-2.1.2.md)

开发准备日期为 2026-11-20（Asia/Shanghai）。2.1.2 继承 2.1.1 开发候选的改动。本轮准备范围为 dev。

## 工作区与计时

- 清单夹按直属可见清单聚合未完成和已完成任务，清单顺序和任务分组沿用各自设置。任务保留原清单 ID。归档版对照使用固定提交 b0ee5e26c133ea273e1634fa52b8a107e1649a69。
- 日期类系统清单的快捷创建栏显示清单选择，普通清单和「任务」显示到期日。清单夹、标签、全部和优先级清单依次显示清单选择和到期日。清单菜单复用共享弹层，选中清单后关闭。点击外部时关闭弹层，外部操作仍可执行。到期日使用原有偏好键。
- 通知面板支持外部点击和 Escape，保留提醒、更新阅读状态和触发按钮开合。
- 独立迷你计时器请求 147×58 或 232×58 CSS 像素，重新打开时请求初始尺寸。浏览器控制窗口边框及系统拖动。应用将内容限制在紧凑尺寸内，居中显示，窗口放大时由同一壁纸填满背景。主窗与小窗继续使用同一计时服务和会话。[Chrome 的 Document Picture-in-Picture 接口](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)

## 图标与弹窗

- 标签页及系统通知使用含 16、32、48、256 像素原始帧的 ICO。启动卡片及启动错误磁贴仍为 30×30 CSS 像素，按像素密度选择 30、48 或 120 像素原始图像。

| 弹窗用途 | 磁贴处理 |
| --- | --- |
| 删除本地数据、更新详情 | 新增 44×44 CSS 像素的左上角应用磁贴，保留各自的字体、按钮、关闭及业务流程。 |
| 停止计时、中断恢复、任务或子任务删除、清单操作、其他简短确认及运行错误 | 沿用共享确认框中的现有磁贴。 |
| 导入和导出备份、设置、清单或任务编辑、番茄记录、计时模式、白噪音和组件配置 | 保留现有功能布局。导入预览在内层滚动表单旁绘制共享滚动条，圆角和裁切由外层窗口负责。 |

## 2.1.0 之后累计更新

- Windows 预览的 `-Open` 使用临时 Edge 会话。`-Static` 从同一源码构建隔离版，在 HMR 不可用时使用。HMR 终端恢复快捷键，并支持输入 `f` 刷新连接的页面。[预览命令](../MAINTENANCE.md#环境与正式入口)
- 启动错误包含阶段、未完成的步骤和可用原因。渲染错误也提供可复制详情，两处都支持手动复制并使用应用的明暗配色。
- 预览可在同源旧设置或旧数据库存在时启动，同时继续验证服务证明、预览数据库版本和独立命名空间。
- 任务完成音由应用脚本内嵌，避免下载管理器截获独立音频请求。导入后，工作区、账号资料和森林接受有效的折行或大小写不同的内嵌 Base64 头像，并支持 JPEG 简写与 WebP，坏图沿用默认头像。
- Python 备用服务绑定数值 loopback 后直接监听，避免反向 DNS 阻塞启动。启动回归禁止反向查询，并保留 Host、GET/HEAD 和缓存断言。报表动画对照在页面加载前准备虚拟时钟，八组对照继续使用原有采样点和像素断言。[CI #161](https://github.com/menggou1/FocusTodo-Local/actions/runs/44524165036) · [修复提交](https://github.com/menggou1/FocusTodo-Local/commit/5d076b77ef1f9e17493fc4a74708ab5dd96657a9)

## 预览与 CI

- HMR 的启动标题与应用共读 `release.json`。正式或隔离静态构建会拒绝未同步的生成版本文件。已有数据库和设置沿用原兼容规则。
- `5d076b7` 上的 dev #162 通过六项矩阵。之后的 Tag #163 因 2.1.1 与 2.1.0 版本错配失败，main #164 因此重新运行矩阵。新预检先核对 Tag 版本。只有错配的 Tag 在独立版本检查中明确失败时，该失败才不会使同 SHA 的 dev 证据失效。构建、附件摘要、六项矩阵、附件字节核对及发布门禁继续检查。[dev #162](https://github.com/menggou1/FocusTodo-Local/actions/runs/44536915837) · [Tag #163](https://github.com/menggou1/FocusTodo-Local/actions/runs/44731267752) · [main #164](https://github.com/menggou1/FocusTodo-Local/actions/runs/44731361287)

- `main` 在 CI 预检和 Pages 部署前都用远端版本 Tag 核对生产提交。若提交上的 Tag 与 `localVersion` 冲突、该版本已分配给其他提交，或无 Tag 的版本没有超过已占用版本，流程会失败。Pages 打包还核对构建元信息和网页标题。2.1.0 曾由 main #164 部署到线上，来源为 `5d076b7`。[线上部署清单](https://menggou1.github.io/FocusTodo-Local/deployment.json)
- CI #165 暴露了 Windows 临时目录的短路径别名和 Linux 导入表单键盘滚动两个问题。HMR 回归先解析临时目录的真实路径，保留 Vite 的目录访问限制。聚焦导入预览滚动区域时，Home 和 End 分别滚到顶部和底部。[dev CI #165](https://github.com/menggou1/FocusTodo-Local/actions/runs/44733052745)

持久化继续使用数据库 schema v3、备份格式 2 和兼容设置标识 6.5。未完成的验收范围统一记录在 [BACKLOG](../BACKLOG.md)。
