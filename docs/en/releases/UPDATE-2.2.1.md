# FocusTodo 2.2.1

[Changelog](../CHANGELOG.md) · [中文](../../releases/UPDATE-2.2.1.md)

Released on 2026-11-28 (Asia/Shanghai) by Lexible. This patch freezes calendar repairs and inherits the shipped 2.2.0 features.

## Seven original requirements

1. Keep the calendar toggle clear of card, task pane, and linked-task text, preserving wrapped titles and real drag targets at 375px.
2. Confirm deletion of both schedules and focus records. Records remain unchanged before confirmation and after cancellation; confirmation removes only the selected record.
3. Dismiss either pane from non-interactive blank space inside or outside the timetable, preserving the existing 220ms pane transition and inspector exit.
4. Preserve descenders in Someday input and both left overhangs and descenders in calendar drafts and saved cards, retaining font size, spacing, and time-row placement.
5. Arrange task rows from the top with 12px gaps. Short lists retain blank space below; long lists use the shared scrollbar and expose the final row.
6. Use the shared day/week/month selector with real mouse and keyboard view changes.
7. Label the return button Back to Today / 回到今天, while retaining Today / 今天 in headings and the pane.

## Final observed acceptance

The frozen remote dev base is `c96aebee718adce1cdec5b4ff564cd99086fee86`. The [third-round report](https://github.com/menggou1/FocusTodo-Local/blob/c96aebee718adce1cdec5b4ff564cd99086fee86/docs/acceptance/calendar-third-round-2026-11-27.md) records reproduction before repairs, real operations, screenshots, frames, and pixels; its `e87c02b` is the pre-repair baseline. This report supersedes earlier incomplete claims for outside task-pane dismissal and saved-card glyph clipping.

On Windows, Chromium, Firefox, and WebKit each passed 21 focused cases. All 24 draft/saved-card comparisons across both languages and themes had zero clipping differences. IndexedDB checks verified both deletion flows. All four inside/outside dismissal paths and actual narrow-window drag writes passed. [Dev CI #204](https://github.com/menggou1/FocusTodo-Local/actions/runs/45958591094) actually completed the six Windows/macOS/Linux × Node 22/24 jobs, Node 24 archive and Chromium checks on all three platforms, Linux Firefox/WebKit, and independent Verify CI evidence for the frozen base.

Version metadata, generated indexes, and documentation form a separate release commit. The 2.2.1 tag must identify the fully verified remote release/2.2.1 HEAD. Tag, main, and post-release dev must validate original six-job evidence and artifact digests for that exact SHA; #204 cannot certify a different SHA. Actions summaries and logs retain first-publication provenance and original run/artifact IDs and SHA-256.

[Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/2.2.1) · [Release branch CI](https://github.com/menggou1/FocusTodo-Local/actions?query=branch%3Arelease%2F2.2.1) · [Tag CI](https://github.com/menggou1/FocusTodo-Local/actions?query=branch%3A2.2.1)

Real Safari, user-device checks, and ongoing evidence boundaries remain solely in the [Backlog](../../BACKLOG.md). Automated results do not replace those manual observations.
