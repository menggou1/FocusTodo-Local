# 7.1.1-patch.1 — Timer recovery and durable local data

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-03. Author: Lexible.

## Delivered behavior

- Recover complete historical focus blocks and retain the remaining partial work after confirmation.
- Persist timer sessions and commit records and progress together without duplicates.
- Fix stale elapsed time after stopping and incorrect task cancellation or switching.
- Validate complete backups, recover interrupted imports, and clean up notifications, audio and subscriptions.

## Technical and verification account

The first two local patch phases established pure timer transitions, durable sessions and recoverable imports. Complete focus blocks retain historical boundaries; partial work is preserved and interrupted time requires confirmation. Records and cursor commit together and retries do not duplicate records. Stop/detach/mode changes cannot resurrect stale elapsed time. Full backups include business tables, settings and timer snapshots; validation rejects settings-only replacement. Imported running snapshots become recovery, and settings rollback is journaled. Cross-tab refresh, event cleanup, audio resumption and an independent audio Web Lock were added. The loopback server gained correct single audio ranges and failure reporting. Later releases supersede the original temporary status and old unfinished lists.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/results.json)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/app.png)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/about.png)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/recovery.png)

[Original Chinese report](../../releases/UPDATE-7.1.1-patch.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
