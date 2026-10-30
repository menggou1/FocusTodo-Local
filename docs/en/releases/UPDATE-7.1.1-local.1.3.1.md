# 7.1.1-local.1.3.1 — Theme selection and daily wallpaper fixes

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-24. Author: Lexible.

## Delivered behavior

- Bing downloads and automatic refreshes no longer override a later theme choice.
- Classic backgrounds, checkmarks and borders update together; returning to the previous classic theme works.
- Image uploads respect the latest selection, and deleting an active custom theme restores Leaf.

## Technical and verification account

The latest theme selection owns activation; obsolete Bing refresh/download and upload results cannot overwrite it. Classic selection clears custom overlays inside the legacy event, so background, checkmark and border update together even when returning to a PureComponent-cached classic. Deleting the active custom theme uses the native Leaf event. Three focused theme scenarios and two existing appearance/storage scenarios passed locally; six platform combinations passed CI.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.3.1)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/actions/runs/40106592534)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/actions/runs/40106592186)

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.3.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
