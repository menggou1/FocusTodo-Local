# FocusTodo 2.1.0

[Changelog](../CHANGELOG.md) · [Chinese report](../../releases/UPDATE-2.1.0.md)

The development baseline was remote dev commit `bf480ed81bf12bb5c35184135ab1b35c2982f22c` on 2026-11-18. The latest stable version was 2.0.2.

## Settings and data

The task completion switch uses the compatibility key `TskCmpSnd`, defaults to on, and continues to share `RtnVol`. Completing a task plays the sound after the write commits. Volume feedback plays once after a committed adjustment. Auditions and active white noise still respond during adjustment. Both alarm menus list None first and preserve the existing selection and default.

Profile avatars restore through the existing JSON/Gzip backup transaction and refresh throughout the workspace. Import and notifications share the application scrollbar. The notification panel appears above the calendar controls, the update button centers its label, and interrupted time uses the shared confirmation dialog.

The task sidebar footer restores the archived 24×24 icons. Due dates retain the archived relative labels and weekdays, with dates before the current local day shown in red. The new wording for creating tasks above other tasks keeps the existing sort behavior.

## Startup and icons

Seven milestones reflect the actual state of scripts, styles, local data, fonts, icons, sounds, and the first workspace render. A missing resource or timeout leaves the retry screen visible. The workspace entry respects reduced motion. The portable app loads from its local server, and browsers with Web Audio play the original WAV embedded in the app, avoiding a separate HTTP request that IDM can intercept. Media-only ports such as Windows WebKit play the same bytes from a packaged URL.

The archived 30×30 icon now serves the browser tab, startup screen, and desktop notifications as `focus-app.ico`. Read-only inspection of the official Windows 7.2.2 package found 256×256 ICO and transparent PNG versions and a 300×300 tile. Distribution rights for those package assets could not be confirmed. [Focus To-Do](https://www.focustodo.cn/) · [Microsoft Store application terms](https://www.microsoft.com/en-us/servicesagreement)

The Vite development preview serves the startup and browser tab icons at a readable development URL. Builds use a relative asset URL for both icons.

## Development verification

The macOS Node 24 browser test assumed that a specific tab would win when two tabs raced for the audio lock. The test now establishes the owner and waits for the peer to enter the native Web Locks queue before verifying exclusive playback and handoff. [Failed job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44247634654/job/134610681204)

## Version history

2.0.2 already includes the valid changes from the abandoned 2.0.1 candidate. The formal update lists consolidate those changes under 2.0.2 and retain the [candidate report and evidence](UPDATE-2.0.1.md). The owner confirmed the E09 and V04 manual acceptance items. Remaining technical investigations are tracked in the [backlog](../BACKLOG.md).
