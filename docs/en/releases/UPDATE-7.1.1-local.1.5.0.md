# 7.1.1-local.1.5.0 — Fonts, list ordering and scrolling fixes

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-27. Author: Lexible.

## Delivered behavior

- Apply the bundled English font when ready while retaining individual component fonts.
- Reorder system and custom lists separately by dragging or keyboard; the order is saved.
- Fix the extra scrollbar in list management.
- Improve local network compatibility for reused same-origin requests.

## Technical and verification account

Version 1.4.4 at commit e374b532 passed the six-platform CI matrix and was released; its annotated tag is preserved. The version was corrected to 1.5.0 because this release adds list ordering. The correction changes metadata and documentation, and the test workflow was not rerun. Local verification covered 14 startup, 59 application and 7 maintenance browser cases, along with package smoke checks.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.5.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
