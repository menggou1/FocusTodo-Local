# Changelog

[Documentation](README.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Current application: **7.1.1-local.1.9.3**, author Lexible.

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
