# 7.1.1-local.1.7.2 — Restore the reference sidebar and scope schedule typography

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-29. Author: Lexible.

## Delivered behavior

- Undo out-of-scope sidebar, search and username styles, restoring original typography and row sizes.
- Adjust only schedule typography against the unchanged sidebar, preserving native controls and rounded selection.

## Technical and verification account

Compatible patch in the local worktree only. Seven unscoped rules from e1b1477 were removed, restoring the reference sidebar, search and username. Schedule-only typography follows the unchanged 14px regular and 12px auxiliary baseline, with an 18px heading. Native pickers and rounded selection remain. An independent cfd6449 computed-style fixture guards unchanged regions in Chinese/English, light/dark themes and two widths; a deliberately injected 18px sidebar regression must fail. Maintenance now requires reference immutability and scoped changes. Validation: 22 schedule, 4 supplemental invariant, 14 startup and 3 list-ordering browser cases passed; 60 Node tests passed and one platform check skipped. Screenshot review found an existing English Today heading fallback, tracked with implementation guidance as E13; typography acceptance does not certify all translated text. No merge, push, tag or deployment.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.7.2.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
