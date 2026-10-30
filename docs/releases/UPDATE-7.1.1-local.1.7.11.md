# 7.1.1-local.1.7.11 — 教程、发布稳定性与维护规则

[更新记录](../../CHANGELOG.md) · [维护指南](../MAINTENANCE.md) · [English](../en/releases/UPDATE-7.1.1-local.1.7.11.md)

日期：2026-10-30。作者：Lexible。

## 初始问题

关于页缺少完整的中英文图文教程；Windows 发布验收曾出现启动超时和套接字资源错误。取消图片、字体下载时，静态服务器的源文件流可能仍保持打开，部分验收失败现场未进入上传证据。

## 最终变化

- 关于页提供中英文教程，覆盖任务、计时、报表、设置、日程、森林和备份；便携包包含教程及隔离数据配图。
- 运行与验收服务器使用 Node pipeline，取消下载时关闭源文件流；真实 HTTP 回归检查验证资源释放及后续请求。
- 验收等待实际启动完成，从发布配置选择历史条目，定位实际设置控件；失败请求、页面错误、启动状态和截图进入上传证据。
- 临时 Windows CI runner 扩大动态 TCP 端口池并保存连接诊断，保留完整平台、业务断言和浏览器验收。日常电脑的网络设置不变。
- 正式版本留档规则适用于整个 1.7 系列及未来版本：全部要求流程成功且发布 Release，才保留独立版本报告；失败候选的有效内容并入成功版本，不保留逐次尝试记录。1.6 及以前按原规则保留。
- 1.7 系列保留成功发布的 1.7.3 与 1.7.11 报告，更新记录和文档链接指向对应归档位置。

## 最终验证与发布

同一提交 edc8ebb 的 [main 六组检查](https://github.com/menggou1/FocusTodo-Local/actions/runs/41049658124)、[Pages 部署](https://github.com/menggou1/FocusTodo-Local/actions/runs/41049658084)及[标签检查与发布](https://github.com/menggou1/FocusTodo-Local/actions/runs/41050570153)全部成功。

[1.7.11 Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.11)提供 ZIP、tar.gz 和 SHA256SUMS.txt。实际下载附件的摘要、解压启动及文档链接检查通过；线上版本、来源提交和页面启动已核对。未完成的环境验收仅在[统一待办](../BACKLOG.md)维护。
