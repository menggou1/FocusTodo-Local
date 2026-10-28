# 7.1.1-local.1.5.2 — 清单排序反馈与本地兼容修复

[更新记录](../CHANGELOG.md) · [维护指南](MAINTENANCE.md) · [统一待办与验收](BACKLOG.md)

发布日期：2026-10-28。

- 清单管理每行显示三条杠拖动手柄，提供分组排序说明、插入位置和排序动画。拖动系统清单时自定义清单变灰，反向同理；不能跨组移动。保留键盘排序、持久化、隐藏和删除操作，减少动态效果偏好下停用排序动画。
- 背景音在支持 Web Locks 的浏览器中由一个窗口持有播放权，释放后交接。没有 Web Locks 时停用自动背景音并在请求播放时解释原因，试听及完成提示音仍可使用。
- 本地昵称与头像更新通过数据服务保存，写入失败不再经旧网络模拟伪装成成功。
- 将后续 Conventional Commits 提交格式写入仓库约定与维护文档。

## 验证

本地语法检查通过，Node 测试 57 项通过，1 项 POSIX 专用用例在 Windows 跳过。本轮产品改动完成 92 项本地 Edge 验收；候选 CI 的原有 14 项启动、59 项应用及 7 项维护场景也均通过。修正验收流程后，3 项清单专项在 CI 同款 Chromium 中连续两次通过；该浏览器的启动 14 项、音频协调 5 项及资料保存 5 项也分别通过。正式发行门禁运行全部 93 项浏览器场景。ZIP 与 tar.gz 在带空格和中文的路径下解压，无 npm 依赖、无 Git 状态时均能启动；错误版本标签会被拒绝。Pages 文件筛选两项检查通过，两个组件接入生成脚本重复执行保持主包哈希不变。

验收使用独立浏览器上下文和生成数据。清单场景使用实际鼠标拖动与键盘操作；音频场景使用真实 Web Locks 和 Audio 替身，只证明协调与调用行为。实际系统声音和其他尚无完整证据的环境验收继续以统一待办为准。E07 的能力降级与交接策略已完成；E08 本轮完成本地资料保存路径，其余旧网络模拟继续在统一待办维护。

专项截图见 [清单拖动状态](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/list-drag-1.5.2.png)，检查记录见 [本地验收记录](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/release-1.5.2.json)。发布使用带注释的 `1.5.2` 标签，由[三平台 CI](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml)验证后生成 [Release 与校验文件](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.5.2)；[官方 Pages 工作流](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml)从 main 部署运行文件。

## 候选版本与验收修复

已推送的 `1.5.1` 标签保留。该候选版本的原有 14 项启动、59 项应用及 7 项维护场景在 CI 中均通过；新增清单测试的第一场景通过，第二场景在 CI 同款 Chromium 中因同一上下文混用键盘排序与原生拖动，导致 Playwright 等待 Chromium 的拖动拦截事件而挂起。两轮候选工作流已取消，未生成正式 Release。`1.5.2` 合并本轮全部产品修复，隔离拖动手势并为验收程序增加时间边界。
