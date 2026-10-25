# 7.1.1-local.1.1.1 — Dark dialogs, focus records and reset fixes

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-04. Author: Lexible.

## Delivered behavior

- Use the selected light or dark appearance for local notifications and dialogs.
- Exclude focus shorter than 25 seconds; valid work can accumulate across short pauses.
- Coordinate export and import buttons and support keyboard interaction.
- Reset to the local user and default system lists, including recovery of missing navigation lists.
- Keep a complete safety backup, five-second confirmation and rollback on failure.

## Technical and verification account

Local dialogs, update lists and account controls use the selected appearance. Valid focus requires 25 seconds of actual active time; short pauses retain spans. Reset atomically restores the local user and 15 system navigation lists; startup repairs missing lists without replacing existing configuration. Complete pre-reset backup, five-second confirmation and rollback are retained.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/blob/eb0ce5d45a335d179cce03e0649a29dd02e9bb46/docs/acceptance/notifications-dark.png)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/blob/eb0ce5d45a335d179cce03e0649a29dd02e9bb46/docs/acceptance/notifications-light.png)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/blob/eb0ce5d45a335d179cce03e0649a29dd02e9bb46/docs/acceptance/account-dark.png)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/blob/eb0ce5d45a335d179cce03e0649a29dd02e9bb46/docs/acceptance/account-light.png)
- [Public evidence 5](https://github.com/menggou1/FocusTodo-Local/blob/eb0ce5d45a335d179cce03e0649a29dd02e9bb46/docs/acceptance/results.json)

[Original Chinese report](../UPDATE-7.1.1-local.1.1.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
