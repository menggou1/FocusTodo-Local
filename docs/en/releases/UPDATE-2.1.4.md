# FocusTodo 2.1.4

[Changelog](../CHANGELOG.md) · [中文](../../releases/UPDATE-2.1.4.md)

Prepared on 2026-11-22 in Asia/Shanghai. Lexible is the author. Version 2.1.4 is a patch release following 2.1.3.

## Backups, timer transactions, and reminders

- Backup inspection and restore share goal history validation. Corrupt goals and non-text names in legacy JSON and v2 Gzip are rejected before writes or safety backup creation. Older entries with omitted names still restore, remain searchable, and retain extension fields.
- Completing or deleting a task rolls back its task, subtask, and timer writes if detaching the timer first detects an interruption awaiting confirmation. The service contract test retries after confirming the interruption and verifies that only the confirmed 60 seconds are recorded.
- Daily focus goals update by local calendar date. When a schedule or focus record starts during the second occurrence of a local time on the New York fall-back day, changing its duration preserves the original start instant. The calendar saves the selected local date and preserves the original plan when released outside a valid drop area.
- Two tabs merge reminder acknowledgements under a shared storage lock. A system notification constructor failure keeps the in-app reminder unread and leaves later reminders scheduled. Each page attempts the system notification for a given due reminder once.

## Timer and settings

- The native mini timer restores 1.9.4's background brightness, opening fade, and window buttons on both sides. Controls stay centered when resized and share the main window's timer session. Native-window comparisons covered light and dark modes, 147×58 and 232×58 sizes, resizing, focus, pause, breaks, and reopening.
- Eight settings dropdown buttons respond within their visible controls. Interaction tests cover adjacent text, blank space, focus, keyboard input, and touch selection. The wallpaper section in Appearance is named Background and keeps its existing settings and selection behavior.
- The timer sidebar's 330 px cards slide with its 150 ms linear transition. On release, a reordered widget moves from the visible preview position along both axes with a 180 ms `ease-out` transition. The active widget stays above its peers, which make room smoothly. Confirmation saves the layout. The motion comparison covers mid-transition reversal, diagonal drops, rollback on a drop outside the editor, and scroll bounds.
- About shows the local version, author, upstream project, offline storage, repository, and licensing. Help and feedback links were removed, and the official download link appears last and points to the Focus To-Do download section. In update details, the app tile, title, and confirmation area stay fixed while entries use the shared scrollbar. The read-state rules for historical and latest updates remain in effect.

## Reports and legacy comparisons

- Focus duration charts show tasks by priority and task order, followed by custom lists in saved order. Day, week, month, and year use the same projection and preserve aggregate seconds. Short segments share device-pixel boundaries. Windows Chromium verified the exact color of a 90-second green segment at DPR 1 and 2.
- The vertical offset in the white noise settings comparison with 1.9.4 matches the task completion sound row moved into Timer settings. The buttons, icons, and volume slider aligned when the white noise section was brought into view. Import and export restore the total space between the fixed title and scrollable body, resolving all three measured geometry differences in the English dark import preview.
- The focus records scrollbar follows its viewport and stays clipped inside the rounded corners. A synthetic set of 2,920 records covered wheel input, keyboard input, scrollbar dragging, and handoff between inner and outer scrolling. Scrolling caused no Canvas resize. Saving an existing record redraws the segments while keeping reveal progress at 1.

## Verification

- Dev commit `d1da507e1914784e286f2e40e4c8d7f8ba1c0744`, the base for release preparation, passed preflight, all six Windows/macOS/Linux jobs on Node 22 and 24, and the independent CI evidence gate. [CI #181](https://github.com/menggou1/FocusTodo-Local/actions/runs/45018789979)
- The local isolated 2.1.4 build matched the timer sidebar and widget motion from `58853d2` in Chromium, Firefox, and WebKit. Two viewport width and DPR combinations checked motion paths, drag layering, peers moving out of the way, release, and persistence. The comparison detected the clipped sidebar motion and horizontal widget jump in `67ddc15`.
- The production entry point read synthetic 1.9.4 data at a temporary same-origin address. The test checked existing task IDs, settings, and subpath resources, then verified the About version, downloaded backup, and confirmed restore. Service contracts exercised backup rejection, timer interruption rollback, and concurrent reminders.

Database schema v3, backup exportVersion 2, and the legacy `Version='6.5'` preference remain in use. See [Backlog](../../BACKLOG.md) for outstanding verification.
