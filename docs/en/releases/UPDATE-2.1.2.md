# FocusTodo 2.1.2

[Changelog](../CHANGELOG.md) · [中文](../../releases/UPDATE-2.1.2.md)

Development preparation is dated November 20, 2026, in Asia/Shanghai. Version 2.1.2 inherits the 2.1.1 development changes. Preparation takes place on dev.

## Workspace and timer

- Folders show active and completed tasks from visible direct lists. List order and task grouping follow the view settings. Tasks retain their project IDs. The comparison uses archive commit b0ee5e26c133ea273e1634fa52b8a107e1649a69.
- Date-based system lists show the list picker. Ordinary lists and Tasks show the due-date picker. Folders, tags, All and priority lists show the list picker followed by the due-date picker. Selecting a list dismisses the shared popup, and outside clicks dismiss it while still reaching their target. The due-date picker uses the existing preference key.
- Outside clicks and Escape dismiss notifications. Reminder actions, update read state and bell toggling retain their behavior.
- The native mini timer requests 147×58 or 232×58 CSS pixels, including when reopening. The browser controls its frame and manual resize. The app centers a compact timer and covers extra space with the same wallpaper. The mini timer and main window use the same timing service and session. [Chrome Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)

## Icons and dialogs

- Browser tabs and system notifications use an ICO with original 16, 32, 48 and 256 pixel frames. The startup and startup-error tiles stay at 30×30 CSS pixels and select from original 30, 48 and 120 pixel images.

| Dialog purpose | Application tile |
| --- | --- |
| Delete local data and update details | Add a 44×44 CSS pixel tile at the upper left with the existing fonts, buttons, dismissal and workflows. |
| Stop timer, recover interrupted time, delete tasks or subtasks, list operations, other brief confirmations and rendering errors | Use the tile already provided by the shared confirmation shell. |
| Backup import and export, settings, list and task editors, focus records, timer modes, white noise and widget configuration | Retain their existing functional layout. The import preview places the shared scrollbar beside the inner scrolling form, with clipping and rounded corners on the outer window. |

## Changes accumulated after 2.1.0

- Windows preview `-Open` uses a temporary Edge session. `-Static` builds and serves the same application when HMR is unavailable. HMR terminal shortcuts are available again, including `f` to refresh connected pages. [Preview commands](../MAINTENANCE.md)
- Startup errors show the failed stage, remaining stages and available causes. Rendering failures also offer copyable details. Both surfaces allow manual selection and follow the application theme.
- Preview startup tolerates older settings and databases on the same origin while still checking server proof, the preview database version and the separate namespace.
- The completion sound is embedded in the application script so download managers cannot intercept a separate media request. Workspace, account and forest views recover valid imported Base64 avatars with whitespace or casing differences, shorthand JPEG and WebP. Invalid images keep the default avatar fallback.
- The Python fallback starts listening after binding the numeric loopback address and avoids startup delay from reverse DNS. Its regression rejects reverse lookup and retains Host, GET/HEAD and cache checks. The report animation test prepares the virtual clock before navigation and retains all eight comparison cases and their original frame and pixel assertions. [CI #161](https://github.com/menggou1/FocusTodo-Local/actions/runs/44524165036) · [Fix commit](https://github.com/menggou1/FocusTodo-Local/commit/5d076b77ef1f9e17493fc4a74708ab5dd96657a9)

## Preview and CI

- HMR startup HTML and the application read `release.json`. Production and isolated static builds reject stale generated version metadata. The existing database and settings compatibility rules still apply.
- Dev run #162 passed all six matrix jobs for `5d076b7`. The later tag run #163 failed on the 2.1.1 versus 2.1.0 version mismatch, so main run #164 ran the matrix again. Preflight now checks tags first. Dev evidence remains eligible when the separate check proves that a mismatched tag caused the failure. The matrix, artifact identity, byte comparison, build, and publication gates still apply. [Dev #162](https://github.com/menggou1/FocusTodo-Local/actions/runs/44536915837) · [Tag #163](https://github.com/menggou1/FocusTodo-Local/actions/runs/44731267752) · [Main #164](https://github.com/menggou1/FocusTodo-Local/actions/runs/44731361287)

Persistence continues to use database schema v3, backup format 2 and compatibility setting version 6.5. Open verification is tracked in the [Backlog](../../BACKLOG.md).
