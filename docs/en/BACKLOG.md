# Open engineering, verification and product proposals

[Documentation](README.md) · [Maintenance](MAINTENANCE.md) · [Canonical Chinese list](../BACKLOG.md)

Updated 2026-10-30. This is the English view of the same canonical item IDs, not an independent backlog. Remove completed items and record their evidence in release reports. Do not copy unfinished lists into old reports. V01 was removed after the user confirmed manual acceptance; E05 and E06 were completed in 1.4.0.

## Engineering

| ID | Priority | Open work | Scope |
|---|---|---|---|
| E01 | P1 | Move theme images to IndexedDB Blob/resources | Copy and validate before switching references and removing old data. Preserve migration recovery and older backups; explain any database upgrade/rollback constraints. |
| E02 | P1 | Cross-tab theme-edit ownership | Single-operation recovery does not serialize multiple processes. Design ownership and conflict handling; localStorage has no cross-process atomic compare-and-swap. Import/reset locking does not replace a theme-edit protocol. |
| E03 | P1 | Binary-resource backup format | Evaluate ZIP + JSON + manifest, content deduplication and thumbnail rebuilding while retaining original image bytes. Validate references, integrity, versions and expanded size before replacement. Gzip is already implemented. |
| E04 | P1 | Large-backup responsiveness, memory and broadcasts | Generated 1/10/50 MB measurements exist. Evaluate workers, batched reads/serialization and large recovery broadcasts from observed bottlenecks, preserving snapshot and journal semantics. |
| E08 | P3 | Consolidate remaining legacy network behavior by feature | Identity/storage belongs to the data service; backup UI, preferences and theme UI now belong to their existing feature modules. Network retains its distinct responsibility. Local name/avatar updates now use an explicit data service with real failure reporting. Trace other legacy account/cloud callers and remove proven-dead simulated responses. Further work must reuse the owning feature service, not split files for line count. Preserve same-origin/Bing access and initialization/recovery order.  Reused XHR state and same-origin handling were corrected in 1.5.0; simulated responses still need investigation. |
| E09 | P3 | Restore component sources and a normal build | Recover source, dependencies and configuration component by component. Preserve Redux, events and timer lifecycle; AST integration is not a complete source build. |
| E11 | P2 | Separate browser mini-timer window | Keep the existing in-page floating timer this round. Detect Document Picture-in-Picture and bridge the existing timer state/commands; fall back when unavailable. Do not promise native always-on-top behavior from a normal popup. |

## Outstanding real-environment verification

Do not repeat completed automation or enlarge every release gate. Use isolated data. A stub or simulated clock is not complete real-environment evidence.

| ID | Priority | Scope | Missing evidence |
|---|---|---|---|
| V02 | P2 | Firefox/Safari and capability fallback | Complete startup, timer, recovery, backup and theme coverage on those engines. Existing limited no-BroadcastChannel/no-Web-Locks/no-compression tests are not full engine acceptance. |
| V03 | P2 | Reports, history and calendar | Isolated calendar creation, persistence, backup restore, peer refresh and overlap automation exist. Still verify known real spans, midnight/DST/timezones, chart values and task/subtask attribution. Follow the procedure below. Groups and online rankings stay excluded. |
| V04 | P2 | Real notifications and audio | Actual permission states, operating-system display, every sound/white-noise track, autoplay restrictions, visible multi-window playback and owner termination. Stub calls are not physical display/listening evidence. |
| V05 | P2 | Bing failures and cross-day refresh | Real source failure, timeout, redirect boundaries and expired/cross-day cache updates. |
| V06 | P2 | Manual backup and desktop-launch experience | Blocked/cancelled downloads, human confirmation of saved files and file-picker restore; Windows double-click, visible default browser, Python fallback and failure messages. Automated saved-file restore and cross-platform launch already exist. |
| V08 | P2 | Attribute historical Windows startup failures | Version 1.7.11 fixes a server stream leak with a controlled cancelled-font regression and adds uploaded calendar failure diagnostics. Missing evidence prevents exact attribution of the old 1.7.4/1.7.6 timeouts. If reproduced, use failed requests, startup DOM and screenshots; repeated passes do not establish their cause. |
| V07 | P2 | Long-lived databases and very large recovery | Isolated evidence from long-lived data, many recovered records and broadcasts. Generated capacity measurements already exist; never commit private backups or images. |

## Other proposals

- A settings control for the interruption threshold, currently fixed at five minutes.
- Release-note archival and network update checks; current metadata is static and the notification list already scrolls.

## Offline feature design proposal

Groups and online rankings remain excluded.

**Groups and online rankings are permanently excluded.** Do not restore group creation/joining, members, invitations, chat or server ranking. Group, GroupUser and Message tables remain only for backup compatibility; hiding their UI must not erase historical backup contents.

### E11 implementation

Add a user-gesture entry in `local-timer-ui.js`. Where Document Picture-in-Picture exists, render current state and bridge start/pause/stop to the existing adapter. Never create a second writing tick loop, database or session. Dispose subscriptions/styles/references on closure. Fall back to the current in-page floating timer. Verify opening/closing, rest transitions, recovery, multi-tab ownership and cleanup on Chromium, then Firefox/Safari fallback. A window.open alternative additionally needs blocked-popup and same-origin disconnect handling; it cannot promise native always-on-top or window movement rights.

### V03 procedure

Use isolated known 23:50–00:20 spans, pauses and different task/subtask associations. Compare calendar, history and daily/weekly reports before and after backup restore, including IDs, seconds, attribution and chart values. Cover Asia/Shanghai and America/New_York DST transition days. If needed, correct day boundaries in createCalendarDayEvent/local-calendar.js and report splitting without rewriting historical timestamps. Synthetic clocks and transaction fault tests do not replace this real-environment evidence.

## Maintenance rule

Add new open work, unfinished verification or future plans only to the canonical backlog and keep this translation aligned. Remove completed items after evidence exists, writing results into the corresponding release report. Preserve actual historical failures and measurements, but do not turn a past candidate failure into a current defect or repeat successful checks instead of collecting missing real-environment evidence.
