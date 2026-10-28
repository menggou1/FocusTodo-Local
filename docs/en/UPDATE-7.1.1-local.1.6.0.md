# 7.1.1-local.1.6.0 — Quick calendar tasks, layout and deadline shortcuts

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-28. Author: Lexible.

## Delivered behavior

- Double-click or select empty planned time to create a task, preview it, and save the task and plans together.
- View overlapping blocks side by side, start focus from a plan, and refresh edited details.
- Choose dates, retain timeline scrolling and refresh the current-time indicator.
- Use Due next week in the task menu for the end of the day seven calendar days ahead.

## Technical and verification account

Prepared and committed only in the local worktree; not merged, pushed, tagged or deployed. Compatible enhancements retain the modified 7.1.1 bundle and database v3. A checked AST integration attaches an independent calendar module. Task and up to five spaced plans commit in one transaction, with maintenance-journal exclusion, rollback and retry. The timeline adds overlap columns, clipping, project colors and compact labels, timer start guards, date selection, scroll restoration and removable minute/refresh listeners. Calendar edits broadcast after commit and refresh associations. Existing movement, resizing and copy/delete persist through the local service. Due next week means seven calendar days ahead at end of day. No official account, diagnostics, telemetry or native Windows bridges are imported. Local verification is recorded in the Chinese completion report and calendar/startup/application acceptance results. Focus forest is confirmed for a later implementation; its methods and browser mini-window adaptation are maintained only in Backlog.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.6.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
