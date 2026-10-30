# 7.1.1-local.1.7.10 — Release stability and consolidated documentation

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文](../../releases/UPDATE-7.1.1-local.1.7.10.md)

Date: 2026-10-30 (Asia/Shanghai). Author: Lexible.

## Delivered changes and evidence

- About links to illustrated Chinese and English guides. Portable archives include the guides and generated-data screenshots.
- Runtime and acceptance HTTP servers use Node pipeline to destroy source streams when downloads are cancelled. The asynchronous stat callback also checks for a closed response. A real HTTP regression cancels a bundled font after the first chunk: the old implementation leaves its stream open past two seconds; the fix closes it and still serves the app.
- Calendar startup failures save failed requests, page errors, startup DOM, mount state and a screenshot in the uploaded evidence directory. Startup error screens fail immediately; business checks and timeouts remain unchanged.
- Remove standalone reports for versions without Releases or without all required workflows passing and all obsolete report redirect pages. Update links and release history to their retained destinations.

[1.7.4 main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41016504396) timed out on Windows startup without page-state evidence. [1.7.5 main](https://github.com/menggou1/FocusTodo-Local/actions/runs/41017501174) captured net::ERR_NO_BUFFER_SPACE for local-app-ui.js. Neither had a tag or Release. [1.7.6 tag](https://github.com/menggou1/FocusTodo-Local/actions/runs/41018970955) failed Windows Node 24 calendar startup after successful main tests and Pages; publication was blocked. Its failure screenshot was outside the uploaded directory. The controlled regression proves a stream leak and its repair, without claiming one cause for every old timeout. Retries, skipped platforms and relaxed timeouts are not evidence of repair. Open verification stays in [Backlog](../BACKLOG.md).

## Release verification

A formal release requires a commit merged and pushed to main, all six main test jobs, Pages deployment, all six tag test jobs and successful Release publication. Any failure requires a version increment before repair, deleting the failed version's standalone reports and update entry and migrating useful content into its successor. Published tags remain immutable. An existing Release does not make a version formal when a required workflow failed.

Validation covers generated files, syntax, Node tests, the full isolated browser suite, release gates, Pages filtering and extracted ZIP/tar.gz startup and document links. Public evidence: [main tests](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3Amain), [1.7.10 tag publication](https://github.com/menggou1/FocusTodo-Local/actions/workflows/ci.yml?query=branch%3A1.7.10), [Pages](https://github.com/menggou1/FocusTodo-Local/actions/workflows/pages.yml), [Release](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.7.10). This report is committed with the candidate and retained as a formal report only after every gate succeeds and the Release exists.

## Consolidated history without complete release qualification

The following useful changes and evidence came from versions without Releases or without all required workflows passing. They are historical context, not separate formal releases or current test results. Repeated development logs and superseded instructions were removed; Git history retains the original text.

### 7.1.1-patch.1 historical changes

- Recover complete historical focus blocks and retain the remaining partial work after confirmation.
- Persist timer sessions and commit records and progress together without duplicates.
- Fix stale elapsed time after stopping and incorrect task cancellation or switching.
- Validate complete backups, recover interrupted imports, and clean up notifications, audio and subscriptions.

### 7.1.1-local.1.1.0 historical changes

- Read release details from the notification bell.
- Replace rating links with the local GitHub repository link.
- Reset data without a password after five-second confirmation, with a complete safety backup.
- Keep timer stop, task detachment, background recovery and rollback fixes.
- Show both the official base version and the local version.

### 7.1.1-local.1.1.1 historical changes

- Use the selected light or dark appearance for local notifications and dialogs.
- Exclude focus shorter than 25 seconds; valid work can accumulate across short pauses.
- Coordinate export and import buttons and support keyboard interaction.
- Reset to the local user and default system lists, including recovery of missing navigation lists.
- Keep a complete safety backup, five-second confirmation and rollback on failure.

### 7.1.1-local.1.1.2 historical changes

- Handle original focus records safely when rendering task progress.
- Ignore repeated completion clicks while the first save is in progress.

### 7.1.1-local.1.4.1 historical changes

- See a lightweight first screen and real step progress, then enter when the core workspace is ready.
- Reuse Chinese and English catalogs, load other locales asynchronously, and retry long or failed loads.
- Use startup feedback with dark appearance, narrow screens, reduced motion and a no-JavaScript explanation.

### 7.1.1-local.1.6.0 historical changes

- Create tasks by selecting schedule time, with overlap layout and native date, pomodoro and project controls.
- Manage Schedule as a sortable, hideable list and scroll the month view.
- Align schedule typography with the unchanged sidebar.
- Display short focus in seconds and add the due-next-week shortcut.

Historical details: timer records/cursors commit atomically; 120/145-minute recovery uses synthetic anchors with real reloads. Complete backups, import recovery journals, settings rollback, cross-tab refresh and audio locks remain in the existing services. Historical local totals of 68/75/78 checks for 1.1.0/1.1.1/1.1.2 do not establish Release publication; [fixed-commit evidence](https://github.com/menggou1/FocusTodo-Local/blob/259a639859334ffd8202276307865345c4eb8b77/docs/acceptance/results.json) remains available. Notification/audio substitutes do not validate actual OS presentation or sound.

Task completion normalizes record objects to numeric progress before rendering, avoiding toMaxFixed errors, and keeps click locks through asynchronous saves. Startup uses inline feedback, parallel downloads and actual completion steps, waiting for recovery and critical CSS while optional assets load later. [Historical startup measurements](https://github.com/menggou1/FocusTodo-Local/blob/main/docs/acceptance/startup-performance.json) are synthetic local observations, not live speed guarantees.

Schedule supports atomic drag/double-click creation, native controls, overlap columns, start/move/resize/copy, peer refresh, month scrolling and sortable/hidden navigation. Estimates are 0–1000, duration 1–480 minutes, with up to five planned intervals and no writes on cancellation. Valid short records show seconds; invalid zero-duration rows stay stored but hidden. Next week means seven calendar days. Sidebar fixture cfd6449 is unchanged; 18/14/12px typography is schedule-scoped. Version 1.6.0 had a tag, main integration and deployment but no Release, so its separate report is removed. Historical typography evidence stays under docs/acceptance/typography-1.7.2; that directory name is not a formal release claim.

### 7.1.1-local.1.5.0 historical changes

- Apply the bundled English font when ready while retaining individual component fonts.
- Reorder system and custom lists separately by dragging or keyboard; the order is saved.
- Fix the extra scrollbar in list management.
- Improve local network compatibility for reused same-origin requests.

### 7.1.1-local.1.3.0 historical changes

- Create lossless Gzip backups, retain plain JSON exports and import older JSON backups.
- Review record counts and sizes before export, with an explicit option to omit wallpapers.
- Protect concurrent imports, resets and interrupted recovery; automatic safety backups remain complete.

Additional consolidation: 1.5.0 was a metadata correction after 1.4.4, with no CI rerun on the 1.5.0 commit; 1.3.0 main CI was cancelled despite successful tag publication. Their reports are removed under the current all-workflows rule. Candidate 1.7.7 failed local full browser acceptance because an update-history test selected the removed patch.1 title. Version 1.7.10 selects an existing historical entry from release metadata, preserving unread-state and Escape assertions. Settings navigation now uses the actual actionable header control after startup, instead of an unchecked coordinate click. No 1.7.7 tag or Release was created.

## Consolidated historical capacity measurements

Windows 11, Edge 155, i5-11260H, 16 GB RAM, Node 24.16. One run per profile/size. All values below are actual historical measurements, not performance guarantees.

| Profile | Source bytes | Gzip bytes | Snapshot ms | Encode ms | Decode ms | Validate ms | Restore ms | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| task-history | 998512 | 82531 | 39.3 | 24 | 5.3 | 2.7 | 213.6 | restored, fidelity checked |
| task-history | 9984230 | 798741 | 309.6 | 223.9 | 44.1 | 52.8 | 2503.9 | restored, fidelity checked |
| task-history | 49916619 | 3957494 | 1353.5 | 1045.9 | 219.8 | 299.1 | 14672.5 | restored, fidelity checked |
| image-heavy | 1006899 | 726350 | 5.6 | 41.6 | 13.7 | 4.8 | 52.2 | restored, fidelity checked |
| image-heavy | 10043079 | 7521579 | not seeded | 346.8 | 119.9 | 34.7 | 247.3 | quota refusal, rollback checked |
| image-heavy | 50183279 | 37705986 | not seeded | 2183.7 | 398.9 | 124.5 | 973.9 | quota refusal, rollback checked |

The 50 MB task/history sample restored in about 14.7 seconds, with a 3.24-second observed main-thread gap and about 611 MB sampled JS heap. The 50 MB image failure sample observed about 1,040 MB JS heap. These exclude native/Blob/process memory and can miss blocked allocation peaks. Image-heavy 10/50 MB cases could not be seeded into localStorage; their encoding measurements came from generated objects, not successful database exports.


Local candidate 1.7.8 used an unused CSS class for settings navigation; its failed run was stopped. Version 1.7.10 selects the actual header settings image verified in the isolated runtime DOM. Version 1.7.8 had no tag or Release and retains no standalone report.

Local candidate 1.7.9 could not write the occupied update-details.png screenshot; it had no tag or Release. Version 1.7.10 runs full acceptance in an independent FOCUS_ACCEPTANCE_DIR as documented, retaining every business assertion and screenshot step. Successful evidence is copied to an independent acceptance directory.

Final local results: 62 Node checks passed, one platform skip and no failures. Full browser acceptance passed 18 startup, 60 application and 24 calendar cases plus maintenance, lists, audio, profile, forest, achievements and reminders. Three release-gate checks and extracted ZIP/tar.gz startup, document links and mismatched-tag rejection passed. Independent evidence is saved under docs/acceptance/release-1.7.10.
