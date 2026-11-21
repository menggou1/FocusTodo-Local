# FocusTodo 2.1.3 candidate

[Changelog](../CHANGELOG.md) · [中文](../../releases/UPDATE-2.1.3.md)

Development preparation took place on 2026-11-21 in Asia/Shanghai. This report covers changes integrated into `dev` after the 2.1.2 release. The author is Lexible.

## Schedule

- The task pane and timeline resize together as the pane opens and closes. One button moves between the toolbar and the pane's close position as its plus rotates into a cross. Repeated clicks reverse the motion from the current position. Reduced motion shows the final state immediately.
- Scheduled cards use the list accent and the app's rounded corners, fonts, and light and dark colors. Labels respond to the card's actual width and height, prioritizing the name and showing start and end times when space permits. Tooltips and details provide the full information. The week view uses the same column layout for overlapping intervals.
- Moving a scheduled card keeps it above overlapping items, shows live start and end times, and preserves its duration. The bottom resize handle keeps its appearance and uses the existing minute increments and duration limits. The preview stays visible after release until the transaction result reaches the snapshot. On a write failure or expected-value conflict, the card animates from its current position and size back to the saved values. The error notice floats above the page.
- Dragging from the task pane shows the task name, duration of one scheduled block, and placement status. Over a valid slot, the preview updates its prospective start time. Tasks with multiple estimated pomodoros also show the total estimated duration. Scrolling, zoom, and cross-midnight placement use the same coordinate mapping and minute snapping, and the committed plan uses the previewed range.

## Workspace and timer

- An ordinary task shows completion immediately and keeps its row for about 250 milliseconds. A repeating task first rotates the completion icon, shows its completed state, and leaves its original position after about 500 milliseconds. Completion and recurrence transactions commit during the operation. Other views read the committed records.
- When tasks or custom lists are dragged, the active row stays on top and the others make room smoothly. Release continues from the painted position, and failed writes return to the saved order. System-list arrow-key sorting processes repeated and reversed input in sequence. The timer's right-side widget editor shares the transition and saves its layout on confirmation. Consecutive WebKit reorders use the transforms that are actually applied.
- The completed-task chart shows task categories first, grouped by priority and task order, followed by custom lists in their saved order. Completion counts and assignments come from the committed records.
- A folder's new-task picker shows Tasks and visible direct lists. The creation transaction checks the chosen list again and falls back to Tasks if the list moved, was hidden, or was removed. The export dialog places the shared scrollbar inside symmetric rounded corners and supports wheel and keyboard scrolling.

## Local security, preview, and CI

- The CSP for production and isolated builds allows inline startup code and load handlers with matching hashes. The Node and Python launchers prevent framing and check the runtime manifest, request targets, and serving boundaries.
- Exports and pre-import safety copies omit external network consent. Import preserves themes and cached wallpapers, and users can enable Bing networking again in Settings. Recovery of an older journal with missing target settings restores the original business data and local consent.
- HMR preview uses the React development runtime, fixing the `_jsxDEV` startup error. Browser acceptance uses an isolated temporary dependency cache. The legacy repeated achievement restore test uses a same-origin data page and then reopens the original UI to check rewards, avoiding a race between UI polling and the maintenance lock.
- CI pins official Action commits and the Playwright image OCI digest. Linux checks the image version and digest in Bash. Artifact reuse checks download and extraction size bounds. First publication checks the version tag, checked-out commit, and matching remote release branch HEAD. Maintenance calls for synchronizing `main` and `dev` and verifying Pages after publication.

## Verification

- Dev CI #173 passed for feature commit `7a32c4a3f4853905eefab55911c45cf7fbb4cccf`. All six Windows, macOS, and Ubuntu jobs on Node 22 and 24 succeeded, along with preflight and the independent Verify CI evidence job. Node 24 verified Chromium and the same portable archives. Ubuntu also ran Firefox and WebKit. [CI #173](https://github.com/menggou1/FocusTodo-Local/actions/runs/44891831289)
- The local calendar suite passed eight cases each on Chromium, Firefox, and WebKit. Frame samples checked pane reversal, the single glyph's translation and rotation, drag layering, geometry while writes were pending, and rollback after write failure and concurrent edits. Synthetic fixtures covered Chinese and English, light and dark mode, narrow and overlapping cards, scrolling, zoom, and cross-midnight placement. Ten legacy calendar comparison groups also passed.
- Local checks included type checking, builds, unit tests, service contracts, the production upgrade, portable ZIP and tar.gz startup, the Python fallback, and Pages content assembled from committed sources. The 2.1.3 metadata and documentation follow the commit verified by CI #173. The metadata commit's remote CI remains unverified.

The database schema is v3, the backup format is 2, and the compatibility preference remains `Version='6.5'`. Open verification is tracked in the [Backlog](../../BACKLOG.md).
