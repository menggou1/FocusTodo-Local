# Changelog

[Documentation](README.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Current application: **2.1.5**, author Lexible.

## 2.1.5 · 2026-11-23

- Organize each release around one main theme and use semantic versioning. Record the theme, scope, and acceptance criteria for the current batch and summarize its changes in bilingual release reports.
- Reuse the original CI matrix and artifacts for the exact commit according to ref identity. Preflight and the independent gate still check version, build, provenance, and digests.
- Restore two-column settings rows in About for the version, author, upstream project, licenses, local data, and official channels. Content wraps and scrolls in narrow windows.
- Restore the original GitHub repository icon. The six platform icons share its hover and keyboard focus feedback and open the corresponding official channels.
- Add the official website and a note supporting the official app below the downloads, with clear attribution for the local edition.

[English report](releases/UPDATE-2.1.5.md).

## 2.1.4 · 2026-11-22

- Backup inspection and restore share goal history validation. Both reject corrupt entries and non-text names while preserving older records with omitted names and compatibility fields.
- Completing or deleting a task rolls back task, subtask, and timer writes if detaching the timer first finds an interruption awaiting confirmation. The action can be retried after confirmation.
- Daily focus goals update by local calendar date. Editing the duration of a schedule or focus record during the daylight saving fall-back preserves its original start instant.
- Merge reminder acknowledgements across tabs. A system notification failure preserves the unread reminder in the app and leaves subsequent reminders scheduled.
- Restore the native mini timer's background brightness, opening fade, and window buttons. Timer controls stay centered when resized.
- Limit settings dropdown clicks to the visible controls and rename the wallpaper section in Appearance to Background.
- Restore the 150 ms linear slide of the timer sidebar's 330 px cards and the 180 ms ease-out reorder transition along both axes after dropping a timer widget.
- Clarify the version, upstream project, and licensing in About. Update details scroll the entries while keeping the title, app tile, and confirmation area fixed.
- In focus duration charts, sort tasks by priority and task order, followed by custom lists in saved order. Align short segment boundaries to device pixels.
- Restore title and content spacing in the import and export windows. Scrolling focus records moves the corresponding scrollbar, and saving an edit updates chart segments in place.

[English report](releases/UPDATE-2.1.4.md).

## 2.1.3 · 2026-11-21

- The calendar task pane and timeline resize together. One plus moves and rotates into a cross, reverses mid-animation on repeated clicks, and respects reduced motion.
- Scheduled cards use list colors and shared app styling. Their actual size determines when to show the name and start and end times. Tooltips and details show the full information.
- A moved plan stays above other cards and shows live start and end times while preserving its duration. Moves and resizes with the existing handle continue from the preview to the saved result, with smooth rollback after a write failure or concurrent edit.
- Dragging from the task pane shows the name, duration, placement status, and live prospective start time. The saved range follows the preview across scrolling, zoom, and midnight.
- Restore completion feedback for ordinary and repeating tasks. Drag and arrow-key reordering for tasks, custom lists, system lists, and timer widgets continue from painted positions, with failed writes returning to the saved order.
- Order task categories and custom lists separately in the completed-task chart. Validate visible direct lists in a folder's new-task picker. Use the shared scrollbar inside rounded export dialogs.
- Check inline startup code hashes in production and isolated previews. The local Node and Python launchers prevent framing and validate the request scope and runtime manifest.
- Backups and pre-import safety copies omit external networking consent. Import preserves themes and cached wallpapers. Restore original data and local consent when a settings journal lacks its target.
- Fix the HMR React development runtime and Linux browser image validation. CI pins Actions and the Playwright image and verifies artifact size limits and first-publication branch provenance. The legacy achievement restore test avoids racing UI polling.

[English report](releases/UPDATE-2.1.3.md).

## 2.1.2 · 2026-11-20

- Show folder tasks grouped by visible direct lists. Restore list and due-date controls by view, the list picker icon dimensions, and outside-click dismissal.
- Use original application icon assets for high-DPI displays. Add a tile to data deletion and update details. Keep the shared draggable scrollbar inside the rounded import preview.
- Dismiss notifications on outside clicks while allowing the clicked action to proceed. Keep the mini timer compact and on the same timing session as the main window.
- Open Windows previews in a disposable Edge session and offer a static fallback. Copy startup and rendering diagnostics, retain isolated storage, and restore the HMR refresh shortcut.
- Restore valid embedded avatars after import and bundle the completion sound to avoid download interception. Fix Python fallback startup latency and a clock race in report animation tests.
- Use one release metadata source for HMR startup and keep preview data. Check the tag early in CI and preserve exact-commit dev evidence when a newer failure is proven to be a tag version mismatch.

[English report](releases/UPDATE-2.1.2.md).

The abandoned 2.1.1 candidate had a mismatched tag. Its development changes are included in 2.1.2. See the [candidate record](releases/UPDATE-2.1.1.md).

## 2.1.0 · 2026-11-19

- Toggle task completion sounds under Alert sounds and keep the shared volume. Volume feedback plays after adjustment, and both alarm lists put None first.
- Startup shows readiness progress for required assets and local initialization. The portable browser icon loads offline through a relative URL. The Vite development preview loads the startup icon correctly.
- Refresh the profile avatar after import, share scrollbars across import and notifications, fix notifications over the calendar, center the update confirmation, and use the standard interruption dialog.
- Restore the task sidebar’s 24×24 footer icons, weekday labels and red overdue dates, and clarify the setting for adding new tasks above other tasks.
- Added clearer icons.
- General settings group language, new-task order, notifications, and feature switches. Task completion sound is configured under Pomodoro alert sounds.
- Keep Collect all stable during sunlight collection and automatically refresh expired Bing daily wallpapers when selected and external networking is enabled.

[English report](releases/UPDATE-2.1.0.md).

## 2.0.2 · 2026-11-17

- Share default avatars and invalid-image fallbacks; use the standard update dialog with an OK button.
- Fix settings and theme feedback, dropdown toggling and selected marks, and preload theme images.
- Restore ringtone option previews and volume feedback, improve slider precision and share custom scrollbars.
- Use the current version in the Simplified Chinese title and preserve settings when uploads or imports are cancelled.
- Synchronize visual comparisons with newly requested dialog fonts without relaxing pixel assertions; reuse verified exact-commit CI and original tested archives.

[English report](releases/UPDATE-2.0.2.md).

The abandoned 2.0.1 candidate had no tag or GitHub Release. Its valid changes are included in 2.0.2. See the [candidate report and evidence](releases/UPDATE-2.0.1.md).

## 2.0.0 · 2026-11-17

- Build from complete React/TypeScript sources with local tasks, timer, calendar, forest and backups.
- Correct initial report layout, completed cards, active-task icons and the forest feature switch.
- Unify dialogs and version metadata, remove the legacy runtime and obsolete tools, and document the production architecture in both languages.

[English report](releases/UPDATE-2.0.0.md).

## 7.1.1-local.1.9.4 · 2026-11-09

- Correct documentation errors in the previous version concerning the long-lived development branch and archived version.
- Publish a verified version tag directly as a stable Release and mark it Latest.

[English report](releases/UPDATE-7.1.1-local.1.9.4.md).

## 7.1.1-local.1.9.3 · 2026-11-07

- Preserve the expanded timer collapse control and keep the mini-window entry on the floating bar.
- Use feature/2.0.0-versioning for ongoing development; both maintenance guides forbid reusing any pushed version tag.

[English report](releases/UPDATE-7.1.1-local.1.9.3.md).

## 7.1.1-local.1.9.2 · 2026-11-07

- Restore the expanded timer collapse control to its original position, icon and behavior; keep the mini-window entry on the floating bar.
- Remove the invented development branch naming rule and require fresh patch-version tags for failed candidates.

[English report](releases/UPDATE-7.1.1-local.1.9.2.md).

## 7.1.1-local.1.9.1 · 2026-11-07

- Reuse the official Windows 7.2.2 compact timer, circular dial and icon controls.
- Move existing corner controls to the upper right and add the official mini-window button on the upper left.
- Only the dedicated upper-left button requests a mini window; expanding, collapsing and double-clicking stay in-page.

[English report](releases/UPDATE-7.1.1-local.1.9.1.md).

## 7.1.1-local.1.9.0 · 2026-11-07

- Add an external networking (experimental) switch, off by default, using the existing bottom toast when selecting Bing daily while disabled.
- Reject wallpaper redirects, refresh across days, cancel requests and restore saved images offline.
- Protect theme changes with the existing maintenance transaction lock and detect cross-tab conflicts, retaining backup compatibility.
- Open a mini timer on supported browsers using the existing timer commands, with an in-page fallback.
- Mark unread release updates with the shared badge and keep the Restore default order button visually stable.

[English report](releases/UPDATE-7.1.1-local.1.9.0.md).

## 7.1.1-local.1.8.3 · 2026-11-07

- Validate timer backups before replacing existing records.
- Detect cross-tab schedule conflicts and prevent stale edits from restoring deleted plans.
- Fix cancelled network requests, large reminder and reward collections, break recovery display and the Python server.
- Prevent sunlight from flashing back after collection animations while preserving retries.
- Improve reminder date padding, line spacing and long-title wrapping.

[English report](releases/UPDATE-7.1.1-local.1.8.3.md).

## 7.1.1-local.1.8.2 · 2026-11-05

- Refresh the forest badge as sunlight matures, expires or changes, without opening the forest.
- Collect available sunlight with a hand button sharing the achievement and guide button style.
- Audit all styles and reuse button, switch, pomodoro, date and dropdown controls, matching the language menu to other settings.
- Adopt independent three-part application versions starting with 2.0.0 and provide a practical implementation plan; 1.8.2 retains the current format.
- Validate all timer snapshot break settings and automation flags before import, rejecting invalid configurations.
- Reject request paths containing NUL bytes without terminating the local server.
- Show Today correctly in the English schedule day header.

[English report](releases/UPDATE-7.1.1-local.1.8.2.md).

## 7.1.1-local.1.7.12 · 2026-11-04

- Restore timer backups after a system clock rollback while retaining completed focus time.
- Keep an interrupted break paused when continuation is declined, and resume its remaining rest time.
- Validate local server access and wallpaper addresses, and fix calendar acceptance across months.

[English report](releases/UPDATE-7.1.1-local.1.7.12.md).

## 7.1.1-local.1.7.11 · 2026-10-30

- Open illustrated Chinese and English guides from About.
- Close streams after cancelled downloads and improve Windows release acceptance resources and failure diagnostics.
- Apply formal release documentation rules prospectively, preserving existing historical records.

[English report](releases/UPDATE-7.1.1-local.1.7.11.md).

## 7.1.1-local.1.7.3 · 2026-10-30

- Restore the original Focus forest, sunlight collection and detailed guide, with local storage.
- Earn bronze, silver and gold local achievements with immediate sunlight rewards.
- Remove the daily collection limit and fix sunlight collection and position refresh.
- Fix the browser tab icon and make the achievements entry a prominent circular button.
- Animate sunlight along the original flight path, retry failed collections and respect reduced motion.
- Show task reminders before release history and clear read or completed reminder badges while retaining release notifications.
- Request optional browser storage persistence in the background without blocking startup.

[English report](releases/UPDATE-7.1.1-local.1.7.3.md).

## 7.1.1-local.1.6.1 · 2026-10-29

- Show an inline message when a schedule task has no name.
- Adapt bottom notices to light and dark themes and fade them out automatically.

[English report](releases/UPDATE-7.1.1-local.1.6.1.md).

## 7.1.1-local.1.6.0 · 2026-10-29

- Create tasks by selecting schedule time, with overlap layout and native date, pomodoro and project controls.
- Manage Schedule as a sortable, hideable list and scroll the month view.
- Align schedule typography with the unchanged sidebar.
- Display short focus in seconds and add the due-next-week shortcut.

[English report](releases/UPDATE-7.1.1-local.1.6.0.md).

## 7.1.1-local.1.5.4 · 2026-10-28

- Use in-app dragging for system lists without browser text-search gestures, keeping the moved row above other rows.
- Remove custom-list ordering from settings; continue reordering custom lists in the main view.
- Restore the default system list order while preserving hidden states and custom-list data.
- Remove the unused NAME browser cookie and read usernames from local storage.

[English report](releases/UPDATE-7.1.1-local.1.5.4.md).

## 7.1.1-local.1.5.2 · 2026-10-28

- Add visible three-bar drag handles, reorder animation and insertion feedback; dim lists in the unavailable group while dragging.
- Improve background-audio handoff between windows; explain the fallback without Web Locks while retaining previews and completion sounds.
- Save local names and avatars through the data service and report failed writes.

[English report](releases/UPDATE-7.1.1-local.1.5.2.md).

## 7.1.1-local.1.5.0 · 2026-10-27

- Apply the bundled English font when ready while retaining individual component fonts.
- Reorder system and custom lists separately by dragging or keyboard; the order is saved.
- Fix the extra scrollbar in list management.
- Improve local network compatibility for reused same-origin requests.

[English report](releases/UPDATE-7.1.1-local.1.5.0.md).

## 7.1.1-local.1.4.3 · 2026-10-26

- Apply bundled Chinese fonts when ready, prefer western system fonts in English, and retain official timer fonts.
- Consolidate data, backup, settings and theme services, removing unused polling and debug controls.
- Keep progressive startup and real progress, show the workspace when ready, and retry failed loads.
- Improve cross-tab verification and provide portable packages with SHA256 verification.

[English report](releases/UPDATE-7.1.1-local.1.4.3.md).

## 7.1.1-local.1.4.1 · 2026-10-26

- See a lightweight first screen and real step progress, then enter when the core workspace is ready.
- Reuse Chinese and English catalogs, load other locales asynchronously, and retry long or failed loads.
- Use startup feedback with dark appearance, narrow screens, reduced motion and a no-JavaScript explanation.

[English report](releases/UPDATE-7.1.1-local.1.4.1.md).

## 7.1.1-local.1.4.0 · 2026-10-25

- Choose Follow system, Simplified Chinese or English in General settings. Other existing languages remain available through Follow system.
- Use English local dialogs, errors, release notes and documentation, with readable fallbacks for missing translations.
- Enable or test desktop notifications explicitly, and clarify the offline scope and group/forest design.

[English report](releases/UPDATE-7.1.1-local.1.4.0.md).

## 7.1.1-local.1.3.2 · 2026-10-25

- Switch to a cached Bing wallpaper immediately and refresh expired images in the background. Closing settings does not cancel the selection.
- Recover interrupted theme changes and roll back failed writes without mixing image and activation settings.
- Centralize open engineering and verification work, removing completed and duplicate entries.

[English report](releases/UPDATE-7.1.1-local.1.3.2.md).

## 7.1.1-local.1.3.1 · 2026-10-24

- Bing downloads and automatic refreshes no longer override a later theme choice.
- Classic backgrounds, checkmarks and borders update together; returning to the previous classic theme works.
- Image uploads respect the latest selection, and deleting an active custom theme restores Leaf.

[English report](releases/UPDATE-7.1.1-local.1.3.1.md).

## 7.1.1-local.1.3.0 · 2026-10-24

- Create lossless Gzip backups, retain plain JSON exports and import older JSON backups.
- Review record counts and sizes before export, with an explicit option to omit wallpapers.
- Protect concurrent imports, resets and interrupted recovery; automatic safety backups remain complete.

[English report](releases/UPDATE-7.1.1-local.1.3.0.md).

## 7.1.1-local.1.2.3 · 2026-10-22

- Updates and reminders share a scroll area without a fixed empty spacer.
- Browser resizing no longer calls extension-only storage APIs.
- Keep headings fixed and support small windows, zoom, mouse and keyboard interaction.
- Consolidate the two historical patch.1 phases and documentation links.

[English report](releases/UPDATE-7.1.1-local.1.2.3.md).

## 7.1.1-local.1.2.1 · 2026-10-22

- Prevent lost focus-record refresh events while another tab is still initializing.
- Include maintenance and historical documents in portable archives and correct their links.
- Keep existing tasks, focus records, settings and the default address.

[English report](releases/UPDATE-7.1.1-local.1.2.1.md).

## 7.1.1-local.1.2.0 · 2026-10-21

- Use a common launcher on Windows, macOS and Linux, with browser opening, custom ports and headless mode.
- Download ZIP or tar.gz packages and run with Node.js; application dependencies do not need installation.
- Keep the same browser, hostname and port to retain existing local data.

[English report](releases/UPDATE-7.1.1-local.1.2.0.md).

## 7.1.1-local.1.1.2 · 2026-10-07

- Handle original focus records safely when rendering task progress.
- Ignore repeated completion clicks while the first save is in progress.

[English report](releases/UPDATE-7.1.1-local.1.1.2.md).

## 7.1.1-local.1.1.1 · 2026-10-04

- Use the selected light or dark appearance for local notifications and dialogs.
- Exclude focus shorter than 25 seconds; valid work can accumulate across short pauses.
- Coordinate export and import buttons and support keyboard interaction.
- Reset to the local user and default system lists, including recovery of missing navigation lists.
- Keep a complete safety backup, five-second confirmation and rollback on failure.

[English report](releases/UPDATE-7.1.1-local.1.1.1.md).

## 7.1.1-local.1.1.0 · 2026-10-03

- Read release details from the notification bell.
- Replace rating links with the local GitHub repository link.
- Reset data without a password after five-second confirmation, with a complete safety backup.
- Keep timer stop, task detachment, background recovery and rollback fixes.
- Show both the official base version and the local version.

[English report](releases/UPDATE-7.1.1-local.1.1.0.md).

## 7.1.1-patch.1 · 2026-10-03

- Recover complete historical focus blocks and retain the remaining partial work after confirmation.
- Persist timer sessions and commit records and progress together without duplicates.
- Fix stale elapsed time after stopping and incorrect task cancellation or switching.
- Validate complete backups, recover interrupted imports, and clean up notifications, audio and subscriptions.

[English report](releases/UPDATE-7.1.1-patch.1.md).

## Repository provenance

The repository is maintained independently. The original upstream 7.1.1 history remains on upstream/7.1.1; main keeps the complete project and the official Pages workflow publishes filtered static assets. Read Maintenance for branch, tag and publishing rules.
