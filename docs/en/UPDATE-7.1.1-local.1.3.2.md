# 7.1.1-local.1.3.2 — Bing wallpaper cache and theme recovery

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-25. Author: Lexible.

## Delivered behavior

- Switch to a cached Bing wallpaper immediately and refresh expired images in the background. Closing settings does not cancel the selection.
- Recover interrupted theme changes and roll back failed writes without mixing image and activation settings.
- Centralize open engineering and verification work, removing completed and duplicate entries.

## Technical and verification account

Bing uses its 12-hour cache immediately, refreshing expired data in the background. Requests do not depend on the settings window. Theme JSON, active ID and Theme use a small journal without image copies; failed writes roll back, interrupted writes recover before startup. Internal journals cannot travel through backups. A real empty-cache Bing request completed after closing settings in about 8.04 seconds, with metadata/image HTTP 200 and successful stored-image decoding. User-confirmed manual long-duration recovery acceptance removed V01.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.3.2)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/actions/runs/40169256711)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/actions/runs/40169256821)

[Original Chinese report](../UPDATE-7.1.1-local.1.3.2.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
