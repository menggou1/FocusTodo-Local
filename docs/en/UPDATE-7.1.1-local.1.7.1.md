# 7.1.1-local.1.7.1 — Native schedule controls and text sizing fixes

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-28. Author: Lexible.

## Delivered behavior

- Reuse the native pomodoro row, duration wheels and project picker; cancelling leaves no draft data.
- Use the existing month/day date panel for schedule navigation.
- Round the selection rectangle; the sidebar typography change exceeded scope and its acceptance was invalidated, corrected by the local rollback in 1.7.2.

## Technical and verification account

Compatible repair version, incrementing only the patch component. Worktree-only, with no merge, push, tag or deployment. Quick task fields now reuse the existing task-detail Pomodoro row and its wheel picker, and the original project row and connected picker. A Provider carries the application store; only explicit draft callbacks avoid immediate persistence. Standard task details retain their existing saving services. The schedule date button uses the original month/day DatePicker inside the program Overlay/Popover, replacing the custom date modal. Native defaults and ranges are preserved: estimate 0-1000 and 1-480 minutes, with at least one and at most five planned blocks. The selection rectangle has 8px corners. The claim that text sizes matched the requirement was invalid: unscoped rules changed the reference sidebar. Version 1.7.2 rolls those rules back; historical business checks are not typography acceptance. Acceptance covers native draft cancellation, ordinary task edits, date selection, rounded selection and font metrics, alongside the previous schedule/history scenarios.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.7.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
