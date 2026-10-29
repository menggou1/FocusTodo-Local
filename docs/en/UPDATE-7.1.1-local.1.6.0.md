# 7.1.1-local.1.6.0 — Local schedule and compatible 7.2.2 features

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-29. Author: Lexible.

## Delivered behavior

- Create tasks by selecting schedule time, with overlap layout and native date, pomodoro and project controls.
- Manage Schedule as a sortable, hideable list and scroll the month view.
- Align schedule typography with the unchanged sidebar.
- Display short focus in seconds and add the due-next-week shortcut.

## Technical and verification account

Final change set against main 1.5.4: local schedule task creation, native controls, overlap layout, month scrolling, managed system-list order and visibility, short-focus seconds and next-week deadlines. The sidebar remains unchanged. Native estimates support 0-1000 and 1-480 minutes; at most five plans are created atomically. Database and backup compatibility remain unchanged. Forest implementation remains in Backlog. Local browser verification covers 22 schedule cases, four invariant cases, 14 startup and three list-ordering cases; 60 Node tests passed and one platform check skipped. No Tag or Release is created.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.6.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
