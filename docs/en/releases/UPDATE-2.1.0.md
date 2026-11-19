# FocusTodo 2.1.0

[Changelog](../CHANGELOG.md) · [Chinese report](../../releases/UPDATE-2.1.0.md)

The cumulative 2.1.0 update is dated 2026-11-19. The work on CI #152 started from remote dev commit `25c537f41380da583dea6524a824d265e7fa0eb5`. The latest stable version was 2.0.2.

## Settings and data

The task completion switch uses the compatibility key `TskCmpSnd`, defaults to on, and continues to share `RtnVol`. Completing a task plays the sound after the write commits. Volume feedback plays once after a committed adjustment. Auditions and active white noise still respond during adjustment. Both alarm menus list None first and preserve the existing selection and default.

Profile avatars restore through the existing JSON/Gzip backup transaction and refresh throughout the workspace. Import and notifications share the application scrollbar. The notification panel appears above the calendar controls, the update button centers its label, and interrupted time uses the shared confirmation dialog.

The task sidebar footer restores the archived 24×24 icons. Due dates retain the archived relative labels and weekdays, with dates before the current local day shown in red. The new wording for creating tasks above other tasks keeps the existing sort behavior.

General settings start with the language menu and new-task order switch. Notifications and feature switches use the same section style, and the desktop notification control is a button on its settings row. Task completion sound is configured under Pomodoro alert sounds. The existing preference and backup compatibility key still apply.

Collect all reflects claimed rewards as soon as collection finishes, keeping the button from flashing during the animation. With external networking enabled and Bing daily wallpaper selected, the app checks the cache at startup and periodically. Stale wallpapers refresh after the local date changes or the cache expires. A failed download keeps the cached image, and an in-flight automatic refresh cannot overwrite a later theme choice.

## Startup and icons

Seven milestones reflect the actual state of scripts, styles, local data, fonts, icons, sounds, and the first workspace render. A missing resource or timeout leaves the retry screen visible. The workspace entry respects reduced motion. The portable app loads from its local server, and browsers with Web Audio play the original WAV embedded in the app, avoiding a separate HTTP request that IDM can intercept. Media-only ports such as Windows WebKit play the same bytes from a packaged URL.

The archived 30×30 icon now serves the browser tab, startup screen, and desktop notifications as `focus-app.ico`.

Added clearer icons.

The Vite development preview serves the startup and browser tab icons at a readable development URL. Builds use a relative asset URL for both icons. On Windows, run `./scripts/preview-standalone.ps1` to start the isolated preview on port 5511. Use `-Port` to select a free port if 5511 is occupied.

## Development verification

The macOS Node 24 browser test assumed that a specific tab would win when two tabs raced for the audio lock. The test now establishes the owner and waits for the peer to enter the native Web Locks queue before verifying exclusive playback and handoff. [Failed job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44247634654/job/134610681204)

The Ubuntu Node 24 job in CI #150 timed out while fetching Firefox and WebKit system dependencies. It now uses an image matching the locked Playwright version, with all three test engines and system dependencies preinstalled. The job allows 30 minutes to accommodate a cold image pull. [Timed-out job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44270097521/job/134684709745)

The container build in CI #151 hit Git’s workspace ownership check. The job verifies the workspace path and checked-out commit before setting that path as `safe.directory` for its Git commands. [Failed job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44290847746/job/134755704275)

In CI #152 the Ubuntu Node 24 job launched Firefox as root with a home directory owned by another user. Both Firefox and WebKit test steps now use the container’s `/root`. [Ubuntu job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44294563193/job/134768486798)

The macOS Node 24 inspector comparison waits for the selected task to appear in both panes before reading the due date and color. It also verifies that both pages use the fixture day and time zone after reload. [macOS job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44294563193/job/134768486830)

The archived Windows Node 24 app stopped at `0 / 19` before the wallpaper backup steps began. Startup failures now capture browser exceptions, console errors, resource status codes, and request failures in the CI log and acceptance artifact. [Windows job](https://github.com/menggou1/FocusTodo-Local/actions/runs/44294563193/job/134768486864)

The cross-platform Chromium step uses a shell that propagates intermediate command failures, so any failed script fails the CI gate.

## Version history

2.0.2 already includes the valid changes from the abandoned 2.0.1 candidate. The formal update lists consolidate those changes under 2.0.2 and retain the [candidate report and evidence](UPDATE-2.0.1.md). The owner confirmed the E09 and V04 manual acceptance items. Remaining technical investigations are tracked in the [backlog](../BACKLOG.md).
