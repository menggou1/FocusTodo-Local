# 7.1.1-local.1.2.3 — Notification panel layout fixes

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-22. Author: Lexible.

## Delivered behavior

- Updates and reminders share a scroll area without a fixed empty spacer.
- Browser resizing no longer calls extension-only storage APIs.
- Keep headings fixed and support small windows, zoom, mouse and keyboard interaction.
- Consolidate the two historical patch.1 phases and documentation links.

## Technical and verification account

Updates and task reminders share one scroll area with a fixed heading. Empty reminder space is removed and the final history item stays reachable at small viewports/zoom. Extension-only resize storage is guarded in ordinary browsers. Candidate 1.2.2 was blocked by cloud browser validation; the final 1.2.3 passed all six platform combinations. Portable ZIP/tar.gz and Pages were synchronized.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/actions)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.2.3)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/actions/runs/39732667175)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/actions/runs/39732649979)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/actions/runs/39732698230)
- [Public evidence 6](https://menggou1.github.io/FocusTodo-Local/)

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.2.3.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
