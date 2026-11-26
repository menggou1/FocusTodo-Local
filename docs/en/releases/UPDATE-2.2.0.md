# FocusTodo 2.2.0

[Changelog](../CHANGELOG.md) · [中文](../../releases/UPDATE-2.2.0.md)

Prepared on 2026-11-26 (Asia/Shanghai) by Lexible. This release focuses on workspace interactions and search.

## Workspace

- The task composer uses the 1.9.4 text colors in both themes. The plus button and Enter submit through the same handler for tasks and subtasks.
- The composer, date picker, and saved task use the same stored default due date. Confirming Someday writes deadline `0`. A synthetic legacy backup with the 2026-09-29 default retains that setting and its historical task dates. The inspector highlights the chosen date shortcut, with the third shortcut labeled Next 7 Days.
- Group headings and the completed section move with task rows using the existing timing, easing, and path. When a successful sidebar drop takes a task out of the current view, its preview exits toward the target. Cancelled and failed drops return to the list.
- Lists, tags, dates, and priorities show eligible sidebar drop targets. A folder grouped by list allows reordering within each list. Other lists are dimmed and show guidance to drop onto the sidebar to move a task. Date aggregates dim every task and reject internal reordering.
- The total, weekly, and daily report cards show hours and minutes, with each title and value switching to pomodoro counts on hover. Deleting from the inspector and the task menu uses the same confirmation, recurrence options, and handling for tasks, subtasks, and records.

## Search

The workspace indexes active subtasks by parent and caches normalized queries until the next business snapshot. Search covers task names, notes, tags, and subtasks, including completed tasks and matches without a list. Results follow list order and task order within each group. The composer, sort menu, and summary cards are hidden in the results view.

Search commits after a 300 ms debounce or immediately on Enter. Input method composition preserves uncommitted text. Notifications and other navigation cancel pending search. Editing a term keeps matching task details open. Escape returns to the originating view even immediately after clearing the field.

### Search service timing

Windows, Node 24.16.0, using loaded synthetic snapshots with two subtasks per task. The table shows the median of seven distinct miss queries after warm-up in milliseconds. Timing covers service calls. Other local validation was running during the measurement.

| Tasks | Subtasks | 2.1.5 | 2.2.0 |
| ---: | ---: | ---: | ---: |
| 1,000 | 2,000 | 111.09 | 0.20 |
| 2,000 | 4,000 | 614.72 | 0.73 |
| 4,000 | 8,000 | 2,475.29 | 1.15 |
| 8,000 | 16,000 | 12,174.67 | 1.73 |

The first query over 8,000 tasks took 30.90 ms including index creation. The median for repeated queries was below 0.01 ms. [Reproduction command](../TESTING.md)

## Verification

- The recovered workspace patch matched the ZIP member CRCs and Git blob hashes before and after application for all 32 files on the 2.1.5 baseline `34826d6`.
- Windows Node 22 and 24 each passed 91 applicable unit tests and 88 service contracts. Reports, the folder composer, inspector dialogs, and both languages and themes passed 1.9.4 comparisons. The production same-origin upgrade preserved task IDs, settings, backup download, and confirmed restore.
- On Windows, Chromium, Firefox, and WebKit each passed 36 workspace and 20 domain cases. The three engines passed 56 startup and 31 browser service checks plus settings regressions. The final local WebKit run waited for the drag state to be committed and kept the original assertions and time limit.
- Production and isolated builds, extract-and-start checks for ZIP and tar.gz, Python fallback startup, the Pages source check, and release evidence rejection cases passed.
- Development commit `5819a443ea449d5075f4d23f2e99fd99f2375cf8` passed the six Windows, macOS, and Linux jobs with Node 22/24 and the independent evidence gate. Chromium ran the production and archive checks on all three platforms, and Linux also ran Firefox and WebKit. [Development CI](https://github.com/menggou1/FocusTodo-Local/actions/runs/45768749531)
- The Python fallback tests now record process readiness and HTTP request phases for future incidents like the historical Windows timeout in CI #189. Ongoing verification is tracked in the [Backlog](../../BACKLOG.md).
