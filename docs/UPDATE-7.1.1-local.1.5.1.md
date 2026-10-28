# 7.1.1-local.1.5.1 — 清单排序反馈与本地兼容修复

[更新记录](../CHANGELOG.md) · [维护指南](MAINTENANCE.md) · [统一待办与验收](BACKLOG.md)

发布日期：2026-10-28。

- 清单管理每行显示三条杠拖动手柄，提供分组排序说明、插入位置和排序动画。拖动系统清单时自定义清单变灰，反向同理；不能跨组移动。保留键盘排序、持久化、隐藏和删除操作，减少动态效果偏好下停用排序动画。
- 背景音在支持 Web Locks 的浏览器中由一个窗口持有播放权，释放后交接。没有 Web Locks 时停用自动背景音并在请求播放时解释原因，试听及完成提示音仍可使用。
- 本地昵称与头像更新通过数据服务保存，写入失败不再经旧网络模拟伪装成成功。
- 将后续 Conventional Commits 提交格式写入仓库约定与维护文档。

## 验证

本地语法检查通过，Node 测试 57 项通过，1 项 POSIX 专用用例在 Windows 跳过。完整浏览器验收共 92 项通过：14 项启动/字体、59 项应用、7 项并发维护，以及新增的 2 项清单排序、5 项音频协调、5 项资料保存。ZIP 与 tar.gz 在带空格和中文的路径下解压，无 npm 依赖、无 Git 状态时均能启动；错误版本标签会被拒绝。Pages 文件筛选两项检查通过，两个组件接入生成脚本重复执行保持主包哈希不变。

验收使用独立浏览器上下文和生成数据。清单场景使用实际鼠标拖动与键盘操作；音频场景使用真实 Web Locks 和 Audio 替身，只证明协调与调用行为。实际系统声音和其他尚无完整证据的环境验收继续以统一待办为准。E07 的能力降级与交接策略已完成；E08 本轮完成本地资料保存路径，其余旧网络模拟继续在统一待办维护。

专项截图见 [清单拖动状态](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/list-drag-1.5.1.png)，检查记录见 [本地验收记录](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/release-1.5.1.json)。发布使用带注释的 `1.5.1` 标签，由[三平台 CI](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml)验证后生成 [Release 与校验文件](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.5.1)；[官方 Pages 工作流](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml)从 main 部署运行文件。
