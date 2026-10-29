# 7.1.1-local.1.6.1 — 日程与提示样式优化

[更新记录](../CHANGELOG.md) · [维护指南](MAINTENANCE.md) · [English](en/UPDATE-7.1.1-local.1.6.1.md)

发布日期：2026-10-29。作者：Lexible。

## 更新内容

- 日程快速创建任务时，空名称或仅含空白字符的名称会显示表单内提示并聚焦名称输入框；输入有效名称后提示消失，未通过验证时不会创建任务。
- 底部提示使用主题背景和文字颜色，适配浅色、深色主题；移除关闭按钮，显示 6 秒后渐隐。新提示出现时重新计时，并将提示上移以避免遮挡底部计时控件。
- 错误提示关联输入框并通过辅助技术播报；减少动态效果的系统设置会禁用渐隐动画。

## 验证与发布

本地单元测试 60 项通过、1 项因平台跳过；语法检查、完整浏览器验收及 ZIP、tar.gz 解压启动检查通过。日程验收 24 项通过，包括浅色和深色的空名称、重复提示和自动消失，以及侧边栏样式不变性。

提交 `4389dcd` 已合入 main；标签 `1.6.1` 指向该提交。[GitHub Actions 发布检查](https://github.com/menggou1/FocusTodo-Local/actions/runs/40822836444) 和 [main 检查](https://github.com/menggou1/FocusTodo-Local/actions/runs/40822829700) 均通过三系统 Node 22/24 矩阵。[Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.6.1) 的 ZIP 和 tar.gz 下载后与 SHA256SUMS 一致。[Pages](https://menggou1.github.io/FocusTodo-Local/) 部署清单指向该提交，线上启动检查通过且无脚本错误。

1.6.0 标签指向原始提交 `c81d2cc`；该版本未创建 Release。当前维护事项见[统一待办](BACKLOG.md)。
