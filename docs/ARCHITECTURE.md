# React standalone 架构

[维护](MAINTENANCE.md) · [测试](TESTING.md) · [English](en/ARCHITECTURE.md)

## 入口与构建

FocusTodo 2.0.0 从 standalone/ 的完整 React / TypeScript 源码经 Vite 构建。standalone/app/main.tsx 等待必需样式后构造浏览器能力和服务，挂载错误边界与 App。正式构建不加载 src/js/main.js、patch.js、旧 React/Redux 或 FocusLocal 全局。src/ 与相关 revise 工具只用于旧版兼容、差分与历史 UI 基准。

| 目录 | 职责 |
|---|---|
| standalone/app | 入口、应用合同、错误启动反馈 |
| standalone/features/workspace | 任务、清单、计时、日程、历史、报表、森林、设置与共享弹窗 |
| standalone/domain | 计时纯核心、重复规则、日程布局、统计、版本和统一格式 |
| standalone/services | 数据事务/日志、设置、业务快照、计时、主题、声音、网络、森林及备份 |
| standalone/shared | 界面文案、生成词库及类型 |
| standalone/styles | 应用与按功能归属的样式；共享控件和弹窗由其拥有者维护 |
| public | 来源资源、字体、音频及翻译目录 |
| scripts | 元信息生成、正式/隔离构建、启动、打包与 Pages 门禁 |

正式 build 输出 dist/app/site；独立预览输出 dist/standalone/site。两者均使用相对资源 URL 支持项目子路径，资源 manifest 为本地服务和分发白名单。私有 sourcemap 与 Vite manifest 放独立 debug 目录，不进入浏览器运行包。生产构建摘要覆盖源码、资源、配置、元信息及锁文件；打包拒绝陈旧产物，Pages 还验证已提交来源。

## 数据及恢复

正式浏览器适配器明确选择 PomodoroDB6 和不带前缀的既有设置；隔离构建使用 FocusTodoStandalone.PomodoroDB6 与 FocusTodoStandalone.data.*，启动前核对 loopback 证明、数据库与设置隔离。正式构建不依赖候选证明接口或 indexedDB.databases，因此可以在 Pages 上运行。数据服务默认仍拒绝正式数据库，只有正式适配器提供匹配的显式能力才允许使用。

数据库版本为 3。Project、Task、Subtask、Pomodoro、Schedule 保存业务数据；Group、GroupUser、Message 仅保留旧备份兼容；TimerSession 保存计时；LocalMeta 保存客户端协议、维护及恢复日志。Group 的主键为 groupId，Message 为 messageId，其余为 id。Group 索引包括 membersNum。锁库独立于业务数据库。应用版本2.0.0不改变 schema、exportVersion 2 或旧偏好 Version='6.5'。

启动依次恢复导入/主题日志、身份和设置、计时及业务快照，再显示界面。维护锁、协议检查与原值校验覆盖并发写入。导入/清空先等待完整安全备份确认，再通过日志保持 IndexedDB 和设置的一致性；失败回滚，恢复未完成则停写。旧 JSON 和 Gzip 均验证格式、引用、容量及业务字段，未知兼容数据保留。

计时核心使用持久会话及事件投影；组件不持有另一套计时真相。有效段达到25秒才进入记录，中断超过5分钟要求确认。页面后台、跨窗口和重载通过服务生命周期协调。原生小窗通过 React portal 复用会话和命令，不创建第二个数据库写入者。自动背景音需 Web Locks 所有权；不支持时保留显式试听/铃声，关闭自动背景播放。

## 界面与布局

App 负责工作区导航与选择，Timer 在导航外持续挂载。次级页面保留底层工作区；原生 dialog 顶层容纳设置、森林、表单和确认框。ConfirmDialog 统一停止/删除/安全确认；Dialog 管理标题、错误、焦点恢复和关闭动画；专用选择器保留自己的草稿与确认语义。弹层和编辑控件通过 portal 避免被详情栏或滚动容器裁切。

报表时间轴在 render 中计算完整行高，layout effect 在首帧前以最终 CSS 高度同步画布像素和坐标轴；记录随后从下往上揭示。ResizeObserver 和字体就绪只触发重绘，不通过延迟隐藏修饰错误布局。已完成页按完成/记录结束日分组，记录与任务卡片使用旧版背景、日期格式及中性完成图标。运行图标仅在 work 状态关联该任务时使用秒表；暂停、停止和完成恢复相应图标。森林入口订阅已提交的 forestEnabled 偏好。

## 服务合同

权威类型为 standalone/services/core.d.mts 的 ApplicationServices，组合入口 createCoreServices，浏览器入口 createBrowserServices。组件只接收 ApplicationServices，不接收 repository、事务或旧全局。接口变更应同步实现、类型与差分证据。

| 服务 | 界面使用的合同 |
|---|---|
| `timer` / `startForTask` | `getSnapshot`、`subscribe`、`command`、`view`；任务/子任务启动用 `startForTask`，提交时再次校验关联。`refresh/recover` 属服务/生命周期入口。会话和嵌套配置不可变；同一数据重复刷新保持快照身份。tick 由服务调度，组件只显示投影。 |
| `business` | 一个事务内提交判别联合 `BusinessCommand`：清单/文件夹、任务/重复完成、子任务、日程及手动记录。`expected` 对指定字段做同事务原值检查，冲突拒绝；ID 与未知兼容字段保留。`tasksInView/search/history/progress/report/buckets` 从已提交快照查询。 |
| `calendar` | `events` 保留真实时间戳与来源记录；`layoutEvents` 是纯区间布局，`deadlineInSevenDays` 用本地日历。`createTask` 原子创建任务及计划；`put` 以原值保护拖动/删除。界面自行把数据投影为日/周/月界面，不重写历史时间戳。 |
| `settings` / `language` | 设置单键命令在维护所有权内提交，失败不发布新值；保留旧默认值和范围。语言显式选项 auto/zh-CN/en，系统语言使用现有词库和回退，用户任务/备注不翻译。资料通过 `saveProfile` 验证昵称/头像，历史未知设置只随完整备份保留。 |
| `themes` / `wallpaper` | `themes.read/commit` 保留原主题日志；图片通过 `wallpaper.add/select/classic/remove/bing`。联网默认关闭，Bing 取消代际及 guard 在取得锁后再次验证；自定义原图与 Bing 缩略图各保留旧处理顺序。 |
| `network` | 唯一显式请求入口；同源与精确 Bing 白名单、拒绝重定向、无凭证/referrer、大小/超时/取消。界面不绕过此入口直接 fetch 云账号或壁纸；没有云模拟成功响应。 |
| `audio` / `notifications` / `reminders` | 自动背景音要求原生 Web Locks；缺失/失败则关闭自动播放，保留显式试听/铃声。通知权限只在用户明确操作时请求，未授权不调用系统显示。提醒保留 `[taskId, reminderDate]` 已读标识和独立调度。原生资源由浏览器适配器注入。 |
| `forest` | 规范账本、奖励标记和余额在一个 localStorage 值内提交；维护锁保护并发收取。重复收取不加分，成就从已提交记录计算并幂等奖励。界面动画不拥有数据写入。 |
| `backup` | `export` 返回 bytes、格式、MIME、大小和范围；界面负责下载交互。`restore/reset` 默认先等待备份接收器，随后以日志维护数据/设置一致性；成功后刷新服务。`backup:false` 只供显式隔离测试装载，产品确认流程使用默认。 |
| `release` | 元信息来自 `release.json`，识别旧完整版本和独立版本，schema/备份版本各自独立。只有打开当前最新条目才 `markRead`；展示历史条目不清除最新提示。 |

`refresh/suspend/resume/dispose` 是组合生命周期入口。非缓存离开释放连接、活事务、广播、计时与提醒调度、监听和媒体；缓存恢复只暂停/恢复，不销毁 React 或数据。组件取消订阅只释放自己的订阅，不能销毁共享服务。

领域失败使用 `validation`、`conflict`、`network-blocked`、`timeout`、`cancelled`、`incompatible-client`、`disposed` 等代码。底层 IndexedDB 可保留 `ConstraintError/VersionError/AbortError`；恢复错误保留 `rolledBack/recoveryRequired`。只有成功提交才更新事实快照；通知回调失败不能把成功提交改写为失败。恢复未完成或协议/schema 不兼容时必须停写、保留存储并提示重建兼容服务，不能重置数据库“修复”。


### 批次、目标、主题订阅与报表投影

| 新入口/适配 | 行为与边界 |
|---|---|
| business.batch(commands) | 接受 1–2000 条 updateTask/updateSubtask/updateProject/removeProject，与单命令共享校验、关联及 expected 检查。全部在一个事务提交，任一冲突/失败全部回滚；后续命令读取同批先前更新。仅成功后发布快照，未知字段保留。用于任务/子任务原子排序和清单批量移动/删除，不是任意 repository 访问。 |
| settings.goals() / setGoal(minutes) | 使用旧 Goals JSON 和分钟单位，缺省 180；提交保留 {time,type:'TIME',value,sync:false}。0 表示移除目标，范围 0–1440 整数。24 小时内修改替换最后目标，旧历史保留，服务维护锁保护设置写入。 |
| forest.dailyLaunch() / rewards() | 按本地日记录一次启动，保留连续天数及既有 LaunchReward 字段；查询未收取且成熟的专注/任务/每日/连续奖励。每日 30、连续 6*min(days,80)、任务 5、专注 max(floor(minutes),1)；24–48 小时可收取。实际收取仍调用 v1 的规范账本/幂等提交，不由 UI 自加余额。 |
| 浏览器通知标题 | 组合适配器提供按当前中英语言解析的标题；直接服务调用保留默认值，权限和调度合同不变。 |
| 浏览器备份接收器 | 产品先下载完整替换前备份，再要求用户确认“已保存且可读”。取消抛 cancelled，恢复/清空不会继续。仅发出下载不自动算接收成功，产品不使用 backup:false。 |



`wallpaper.subscribe/getSnapshot` 提供不可变 `{loading, version}`：`loading` 表示共享 Bing 请求，取消、失败或完成后释放；`version` 只在主题命令成功提交后递增。设置页据此展示下载及缓存激活，计时器仅订阅版本更新背景，组件卸载不取消共享下载。现有命令、取消代际、持久化日志和存储格式不变。`network-services.test.cjs` 与 `settings-interactions.cjs` 覆盖过期缓存先激活、请求中途切换/关闭重开、失败和重试。


`business.getSnapshot().projects` 是清单顺序的唯一来源：所有系统清单（type >= 4000）在自定义清单之前，两组内按持久化 order 稳定排序，等值保留来源次序。清单夹的 parentId 和 expanded 仅控制侧栏/日程的层级展示，不重写子清单的 order；隐藏、删除的过滤仍由使用方决定。组件过滤快照而不再各自重排，拖动预览调用相同的 `orderedProjects`。主工作区按快照中的清单位置排列分组，去掉默认清单的局部特殊权重。排序命令、expected 冲突校验与持久化格式保持原合同。

`business.report(start,end)` 在同一已提交业务快照内复用冻结的聚合结果；任何成功刷新都会使缓存失效，失败事务不发布新事实。缓存有容量上限，不跨快照保存，不改变秒数、区间重叠计算、任务归属或数据库记录。图表的分钟舍入属于显示投影；原始区间总秒数仍由聚合服务返回。

## 资源、网络和许可

外部联网默认关闭，Bing 通过显式网络服务白名单访问；同源资源本地交付。源码、翻译、音频及图像保留上游来源，根 LICENSE 保留上游和本地版权；React/ReactDOM/scheduler 与 Noto 字体完整许可随运行包交付。语言词库由 build:release 生成，系统语言缺项回退英文，用户内容不翻译。
