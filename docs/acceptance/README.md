# 历史验收证据 / Historical acceptance evidence

此目录保存既有版本报告引用的截图、结果和性能数据。旧记录的文件名和内容沿用当时口径。新验收默认写入 `dist/acceptance/`，CI 将浏览器结果作为运行附件保存。测试使用的回归基准在 `tests/fixtures/`。

已移除一份无引用的字节级重复截图：根层的 `list-drag-1.7.2.png` 与保留的 `list-drag-1.7.3.png` 相同。独立的 [1.7.2 字体验收截图](typography-1.7.2/list-drag-1.7.2.png) 仍保留。

清理时移除了 `release-1.7.10/` 中未被引用的 32 张重复或近似截图；对应场景的根目录截图、该版本的机器结果和验证记录仍保留。近似截图来自不同运行，不能视为字节相同或作为该版本的精确像素基准。

New acceptance output goes to `dist/acceptance/`. This directory preserves historical evidence; test inputs and baselines live under `tests/fixtures/`.
