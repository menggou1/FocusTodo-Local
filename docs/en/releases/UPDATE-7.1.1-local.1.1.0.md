# 7.1.1-local.1.1.0 — Local notifications and data management

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-03. Author: Lexible.

## Delivered behavior

- Read release details from the notification bell.
- Replace rating links with the local GitHub repository link.
- Reset data without a password after five-second confirmation, with a complete safety backup.
- Keep timer stop, task detachment, background recovery and rollback fixes.
- Show both the official base version and the local version.

## Technical and verification account

Release metadata is generated from release.json. The bell renders updates beside existing reminders and persists read state only after opening the newest details. About shows official/local versions, author and GitHub. Standalone dialogs trap focus, close on Escape and suppress underlying shortcuts. Data deletion uses the local service directly, with no password dialog and no premature success. The initial report was later organized and committed without a new release tag.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/results.json)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/about.png)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/notifications.png)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/update-details.png)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/reset-confirm.png)

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.1.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
