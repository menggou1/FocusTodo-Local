# 7.1.1-local.1.7.2 — 本地专注森林、成就与任务提醒

[更新记录](../CHANGELOG.md) · [维护指南](MAINTENANCE.md) · [English](en/UPDATE-7.1.1-local.1.7.2.md)

发布日期：2026-10-30。作者：Lexible。

## 更新内容

- 恢复原版专注森林开关、入口、树木、阳光和详细攻略。森林与奖励保存在本机，不依赖账号服务器；小组和在线排名继续排除。
- 阳光由已保存的专注记录、完成任务和本地登录生成，24 小时成熟、48 小时过期，没有每日收取上限。攻略说明计算、等级、备份与收取规则。
- 原排行榜抽屉改为本地成就，保留徽章入口和铜、银、金奖杯。累计专注时长、完成任务数、专注记录结束所在自然日各有三个等级；奖励分别为 20、100、500g，达成后一次性发放。旧记录参与计算，删除记录不撤销已获成就。
- 收取复用原版一秒飞向树木的路径和树木回弹。奖励提交与动画完成分别处理，动画结束再刷新列表；连续收取时保留其他阳光的位置与身份。写入失败立即取消该颗动画，恢复原位并允许重试；关闭森林释放动画，减少动态效果模式直接更新结果。
- 任务到时提醒优先显示在版本历史之前，标题固定显示提醒数量，条目提供任务名称和实际提醒时间。到时仍提供页内提示、提示音与已授权桌面通知。按任务 ID 和提醒时间保存已读状态，已读、完成、删除或修改提醒后重新计算红点，跨标签页同步；版本更新通知保持独立。
- 网页使用相对路径标签图标，成就入口采用圆形徽章按钮，支持项目子路径。

## 数据与兼容

数据库保持 `PomodoroDB6` v3。森林余额、收取记录、成就解锁状态和任务提醒已读状态随完整备份保存与恢复。收取和成就发奖沿用维护锁，成就解锁与阳光余额在同一设置值内提交。任务变更在 IndexedDB 事务成功后通知界面，失败事务不会发布完成状态。所有验收使用生成数据和独立浏览器上下文。

## 失败版本归并与原因

1.7.0、1.7.1 的未正式完成更新统一收录于本报告，不再保留独立正式版本文档或 Release；两个原标签保留。

- 1.7.0 的 main 工作流在 macOS 恢复日程数据后立即检查 DOM，偶发读取到尚未渲染的 0 条。恢复前已确认三条计划，验收改为等待实际事件渲染后断言。原 1.7.0 标签测试虽通过，其 Release 已删除。
- [1.7.1 标签工作流](https://github.com/menggou1/FocusTodo-Local/actions/runs/41007043213)的 macOS、Linux Node 24 均在成就故障恢复断言出现 `0 !== 9`。启动后自动调度的 `syncAchievements()` 与测试手动重试共用写入队列；自动同步可能先提交九项奖励，手动调用随后正确返回零项。失败点不是等待界面不足，也不是奖励丢失。
- 新验收先确认故障写入后余额和解锁状态均未改变，再让真实自动调度确定先于手动重试完成；累计断言只解锁九项、只增加 1860g，手动重试和重复同步均为零。保留跨标签页及重复备份恢复检查，没有通过延长等待回避断言。
- 发布工作流新增同一提交的 main 测试与 Pages 成功门禁，标签六组测试通过后才检查并发布；任一相关工作流失败均不能创建 Release。失败标签保留，后续修复递增第三位版本号。

## 验证与发布

本地执行 `npm run build:release`、`npm test`、`npm run check`、`npm run test:browser`，以及 Python 3.12 的发布门禁测试、便携包构建、ZIP/tar.gz 解压启动和文档链接检查，全部通过。Node 测试 60 项通过、1 项平台跳过；浏览器完成 14 项启动、59 项应用、7 项维护、3 项清单、5 项音频、5 项资料、24 项日程，以及森林、成就和任务提醒专项。发布门禁 3 项、Pages 构建过滤 2 项通过。AST 接入脚本重复运行生成相同主包。

浏览器验收覆盖原版森林开关、奖励规则、连续收取、失败恢复、位置稳定、减少动态效果、成就实时解锁与去重、中英文攻略；任务提醒覆盖到时触发、小窗口首屏可见、持久化已读、任务实际完成、跨页已读与完成同步、已读写入失败重试、版本红点独立保留。最近本地证据位于 [成就恢复结果](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/achievement-retry.json)、[收取动画](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/forest-flight.png)、[任务提醒](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/task-reminders.png)和 `docs/acceptance/` 的完整结果。

本地与远程 main 不含 `CNAME`；Pages 继续只发布运行文件白名单，构建验收同时检查主分支和产物不含 `CNAME`。正式发布检查包括 main 的三系统 Node 22/24 测试、标签测试及发布、Pages 部署，随后下载 Release 附件核对 SHA256、解压启动，并核对线上 `deployment.json`、版本与项目子路径实际启动。

下载见 [1.7.2 Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.2)，工作流证据见 [main 测试](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain)、[1.7.2 标签测试及发布](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.2)和 [Pages 部署](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml)。线上使用 [GitHub Pages](https://menggou1.github.io/FocusTodo-Local/)。未完成的环境验收只维护于[统一待办](BACKLOG.md)。
