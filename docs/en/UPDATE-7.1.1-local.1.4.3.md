# 7.1.1-local.1.4.3 — Language fonts, feature consolidation and release verification

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-26. Author: Lexible.

## Delivered behavior

- Apply bundled Chinese fonts when ready, prefer western system fonts in English, and retain official timer fonts.
- Consolidate data, backup, settings and theme services, removing unused polling and debug controls.
- Keep progressive startup and real progress, show the workspace when ready, and retry failed loads.
- Improve cross-tab verification and provide portable packages with SHA256 verification.

## Technical and verification account

This release consolidates the font and feature-ownership changes from failed 1.4.2. Chinese swaps to bundled Noto Sans SC; English uses western system fonts, and timer declarations match the archived official version. Identity/storage, backup UI, settings compatibility and theme UI belong to existing feature services. Network policy remains distinct. The 1.4.2 main Windows check exposed a test-fixture race: publishing an artificially aged cursor let another tab correctly enter recovery before the intended tick. Elapsed-time injection now occurs within the real timer transaction, leaving real polling and broadcasts enabled. The helper covers normal delivery, queued initialization and notifications. The original 1.4.2 annotated tag is preserved and its unfinished publication was cancelled; this is the new 1.4.3 release.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/actions/runs/40317135653)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/actions/runs/40317145757)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.4.3)
- [Public evidence 4](https://menggou1.github.io/FocusTodo-Local/)

[Original Chinese report](../UPDATE-7.1.1-local.1.4.3.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
