# 7.1.1-local.1.7.0 — Schedule layout, scrolling month view and short-focus fixes

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-28. Author: Lexible.

## Delivered behavior

- Use the official-style schedule timeline, task sidebar and compact quick task dialog.
- Reorder and hide Schedule in list management with saved preferences.
- Scroll the month view, see planned/completed records and open a selected day.
- Display sub-minute focus in seconds rather than a misleading zero-minute history entry.

## Technical and verification account

Local worktree only, without merge, push, tag or deployment. The schedule follows the supplied official UI: Today/navigation/date controls, task sidebar, compact quick task controls, 124px hours, solid completed blocks and circular focus buttons. Schedule is now classified with managed system lists, preserving order and hidden state through the existing transactions. The month grid scrolls internally and loads real planned/completed records over its visible range; selecting a date or event opens the day/details. Week records use the same range loader. A valid 25-29 second focus record was previously rounded to zero minutes. Sub-minute history now shows seconds, while invalid nonpositive rows remain stored but are not rendered. Real-browser checks cover 27 seconds followed by pause and repeated stop in both modes, with one record and no phantom Task. Existing offline data, timer and backup boundaries remain unchanged.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.7.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
