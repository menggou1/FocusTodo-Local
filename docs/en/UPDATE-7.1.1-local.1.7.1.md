# 7.1.1-local.1.7.1 — Local Focus forest and achievements

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Restore the original Focus forest, sunlight collection and detailed guide, with local storage.
- Earn bronze, silver and gold local achievements with immediate sunlight rewards.
- Remove the daily collection limit and fix sunlight collection and position refresh.
- Fix the browser tab icon and make the achievements entry a prominent circular button.

## Technical and verification account

The original forest switch, tree and sunlight interface use local reward storage; sunlight collection has no daily cap. Nine offline achievements use the original ranking drawer and bundled bronze, silver and gold trophies. Each one-time achievement and its sunlight credit are stored together and included in full backups. The implementation retains the existing database schema and excludes online groups and rankings. Browser acceptance exercises collection, concurrent awards and repeated restoration.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.1)
- [Public evidence 2](https://menggou1.github.io/FocusTodo-Local/)

[Original Chinese report](../UPDATE-7.1.1-local.1.7.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
