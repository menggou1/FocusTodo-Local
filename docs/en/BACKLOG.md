# Open engineering, verification and product proposals

[Documentation](README.md) · [Maintenance](MAINTENANCE.md) · [Canonical Chinese list](../BACKLOG.md)

Updated 2026-10-28. This is the English view of the same canonical item IDs, not an independent backlog. Remove completed items and record their evidence in release reports. Do not copy unfinished lists into old reports. V01 was removed after the user confirmed manual acceptance; E05 and E06 were completed in 1.4.0.

## Engineering

| ID | Priority | Open work | Scope |
|---|---|---|---|
| E01 | P1 | Move theme images to IndexedDB Blob/resources | Copy and validate before switching references and removing old data. Preserve migration recovery and older backups; explain any database upgrade/rollback constraints. |
| E02 | P1 | Cross-tab theme-edit ownership | Single-operation recovery does not serialize multiple processes. Design ownership and conflict handling; localStorage has no cross-process atomic compare-and-swap. Import/reset locking does not replace a theme-edit protocol. |
| E03 | P1 | Binary-resource backup format | Evaluate ZIP + JSON + manifest, content deduplication and thumbnail rebuilding while retaining original image bytes. Validate references, integrity, versions and expanded size before replacement. Gzip is already implemented. |
| E04 | P1 | Large-backup responsiveness, memory and broadcasts | Generated 1/10/50 MB measurements exist. Evaluate workers, batched reads/serialization and large recovery broadcasts from observed bottlenecks, preserving snapshot and journal semantics. |
| E08 | P3 | Consolidate remaining legacy network behavior by feature | Identity/storage belongs to the data service; backup UI, preferences and theme UI now belong to their existing feature modules. Network retains its distinct responsibility. Local name/avatar updates now use an explicit data service with real failure reporting. Trace other legacy account/cloud callers and remove proven-dead simulated responses. Further work must reuse the owning feature service, not split files for line count. Preserve same-origin/Bing access and initialization/recovery order.  Reused XHR state and same-origin handling were corrected in 1.5.0; simulated responses still need investigation. |
| E09 | P3 | Restore component sources and a normal build | Recover source, dependencies and configuration component by component. Preserve Redux, events and timer lifecycle; AST integration is not a complete source build. |

## Outstanding real-environment verification

Do not repeat completed automation or enlarge every release gate. Use isolated data. A stub or simulated clock is not complete real-environment evidence.

| ID | Priority | Scope | Missing evidence |
|---|---|---|---|
| V02 | P2 | Firefox/Safari and capability fallback | Complete startup, timer, recovery, backup and theme coverage on those engines. Existing limited no-BroadcastChannel/no-Web-Locks/no-compression tests are not full engine acceptance. |
| V03 | P2 | Reports, history and calendar | Known real focus spans across midnight/timezones and task/subtask attribution. Groups, online rankings and the old forest are outside the current local product. |
| V04 | P2 | Real notifications and audio | Actual permission states, operating-system display, every sound/white-noise track, autoplay restrictions, visible multi-window playback and owner termination. Stub calls are not physical display/listening evidence. |
| V05 | P2 | Bing failures and cross-day refresh | Real source failure, timeout, redirect boundaries and expired/cross-day cache updates. |
| V06 | P2 | Manual backup and desktop-launch experience | Blocked/cancelled downloads, human confirmation of saved files and file-picker restore; Windows double-click, visible default browser, Python fallback and failure messages. Automated saved-file restore and cross-platform launch already exist. |
| V07 | P2 | Long-lived databases and very large recovery | Isolated evidence from long-lived data, many recovered records and broadcasts. Generated capacity measurements already exist; never commit private backups or images. |

## Other proposals

- A settings control for the interruption threshold, currently fixed at five minutes.
- Release-note archival and network update checks; current metadata is static and the notification list already scrolls.

## Offline feature design proposal

This is a product proposal, not a restored entry point.

**Groups and online rankings are permanently excluded.** Do not restore group creation/joining, members, invitations, chat or server ranking. Group, GroupUser and Message tables remain only for backup compatibility; hiding their UI must not erase historical backup contents.

**Recommended forest replacement: optional Personal growth.** Tasks, timer and reports remain the primary navigation. If an incentive view is wanted, add a separately enabled Personal growth page in General settings, off by default. Do not simply expose the old server-backed forest.

- Derive growth only from saved valid focus seconds. A suggested rule is one tree per 60 accumulated minutes, including valid partial spans of at least 25 seconds. Do not reward a count of Pomodoros whose configured lengths vary.
- Exclude breaks, rejected interruptions and confirmation waiting. Allocate cross-day displays by actual spans and local calendar days; task/subtask attribution is a local filter.
- Compute the view from existing records rather than a separate spendable sunlight balance. Import, delete and rollback recalculate the view, preventing duplicate launch/import/recovery rewards.
- Show total focus, recent calendar-day trends and personal milestones; no server sunlight, global rankings or friend comparisons. Disabling the view never changes tasks or history.
- Start with a read-only derived view, without networking or a database upgrade. Implementing it and choosing the proposed 60-minute rule require a subsequent product decision.

## Maintenance rule

Add new open work, unfinished verification or future plans only to the canonical backlog and keep this translation aligned. Remove completed items after evidence exists, writing results into the corresponding release report. Preserve actual historical failures and measurements, but do not turn a past candidate failure into a current defect or repeat successful checks instead of collecting missing real-environment evidence.
