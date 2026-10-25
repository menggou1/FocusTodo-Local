# 7.1.1-local.1.4.0 — Language selection, English support and notifications

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-25. Author: Lexible.

## Delivered behavior

- Choose Follow system, Simplified Chinese or English in General settings. Other existing languages remain available through Follow system.
- Use English local dialogs, errors, release notes and documentation, with readable fallbacks for missing translations.
- Enable or test desktop notifications explicitly, and clarify the offline scope and group/forest design.

## Technical and verification account

General settings expose Follow system, Simplified Chinese and English. Partial existing translations are system-selected only. Static local strings and errors are translated without touching user content. Complete fallback catalogs prevent internal keys being shown. Notification permission is requested only from its explicit button. Groups/rankings and the old forest stay disabled, including imported enable flags; the personal-growth proposal remains in the backlog.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.4.0)

[Original Chinese report](../UPDATE-7.1.1-local.1.4.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
