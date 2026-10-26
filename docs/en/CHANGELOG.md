# Changelog

[Documentation](README.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Current application: **7.1.1-local.1.4.1**, author Lexible.

## 7.1.1-local.1.4.1 · 2026-10-26

- See a lightweight first screen and real loading progress, then enter the workspace while images and fonts finish loading.
- Start Chinese and English from the existing catalog, load other languages asynchronously, and retry slow or failed loads.
- Apply bundled Chinese fonts once loaded, prefer western system fonts in English, and retain the official timer fonts.
- Consolidate local data, backup, settings and theme services, remove unused polling and debugging, and preserve profile edits and recovery.

[English report](UPDATE-7.1.1-local.1.4.1.md).

## 7.1.1-local.1.4.0 · 2026-10-25

- Choose Follow system, Simplified Chinese or English in General settings. Other existing languages remain available through Follow system.
- Use English local dialogs, errors, release notes and documentation, with readable fallbacks for missing translations.
- Enable or test desktop notifications explicitly, and clarify the offline scope and group/forest design.

[English report](UPDATE-7.1.1-local.1.4.0.md).

## 7.1.1-local.1.3.2 · 2026-10-25

- Switch to a cached Bing wallpaper immediately and refresh expired images in the background. Closing settings does not cancel the selection.
- Recover interrupted theme changes and roll back failed writes without mixing image and activation settings.
- Centralize open engineering and verification work, removing completed and duplicate entries.

[English report](UPDATE-7.1.1-local.1.3.2.md).

## 7.1.1-local.1.3.1 · 2026-10-24

- Bing downloads and automatic refreshes no longer override a later theme choice.
- Classic backgrounds, checkmarks and borders update together; returning to the previous classic theme works.
- Image uploads respect the latest selection, and deleting an active custom theme restores Leaf.

[English report](UPDATE-7.1.1-local.1.3.1.md).

## 7.1.1-local.1.3.0 · 2026-10-24

- Create lossless Gzip backups, retain plain JSON exports and import older JSON backups.
- Review record counts and sizes before export, with an explicit option to omit wallpapers.
- Protect concurrent imports, resets and interrupted recovery; automatic safety backups remain complete.

[English report](UPDATE-7.1.1-local.1.3.0.md).

## 7.1.1-local.1.2.3 · 2026-10-22

- Updates and reminders share a scroll area without a fixed empty spacer.
- Browser resizing no longer calls extension-only storage APIs.
- Keep headings fixed and support small windows, zoom, mouse and keyboard interaction.
- Consolidate the two historical patch.1 phases and documentation links.

[English report](UPDATE-7.1.1-local.1.2.3.md).

## 7.1.1-local.1.2.1 · 2026-10-22

- Prevent lost focus-record refresh events while another tab is still initializing.
- Include maintenance and historical documents in portable archives and correct their links.
- Keep existing tasks, focus records, settings and the default address.

[English report](UPDATE-7.1.1-local.1.2.1.md).

## 7.1.1-local.1.2.0 · 2026-10-21

- Use a common launcher on Windows, macOS and Linux, with browser opening, custom ports and headless mode.
- Download ZIP or tar.gz packages and run with Node.js; application dependencies do not need installation.
- Keep the same browser, hostname and port to retain existing local data.

[English report](UPDATE-7.1.1-local.1.2.0.md).

## 7.1.1-local.1.1.2 · 2026-10-07

- Handle original focus records safely when rendering task progress.
- Ignore repeated completion clicks while the first save is in progress.

[English report](UPDATE-7.1.1-local.1.1.2.md).

## 7.1.1-local.1.1.1 · 2026-10-04

- Use the selected light or dark appearance for local notifications and dialogs.
- Exclude focus shorter than 25 seconds; valid work can accumulate across short pauses.
- Coordinate export and import buttons and support keyboard interaction.
- Reset to the local user and default system lists, including recovery of missing navigation lists.
- Keep a complete safety backup, five-second confirmation and rollback on failure.

[English report](UPDATE-7.1.1-local.1.1.1.md).

## 7.1.1-local.1.1.0 · 2026-10-03

- Read release details from the notification bell.
- Replace rating links with the local GitHub repository link.
- Reset data without a password after five-second confirmation, with a complete safety backup.
- Keep timer stop, task detachment, background recovery and rollback fixes.
- Show both the official base version and the local version.

[English report](UPDATE-7.1.1-local.1.1.0.md).

## 7.1.1-patch.1 · 2026-10-03

- Recover complete historical focus blocks and retain the remaining partial work after confirmation.
- Persist timer sessions and commit records and progress together without duplicates.
- Fix stale elapsed time after stopping and incorrect task cancellation or switching.
- Validate complete backups, recover interrupted imports, and clean up notifications, audio and subscriptions.

[English report](UPDATE-7.1.1-patch.1.md).

## Repository provenance

The repository is maintained independently. The original upstream 7.1.1 history remains on upstream/7.1.1; main keeps the complete project and the official Pages workflow publishes filtered static assets. Read Maintenance for branch, tag and publishing rules.
