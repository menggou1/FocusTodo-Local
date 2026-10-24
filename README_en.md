# FocusTodo

FocusTodo - Local Development Version · [中文版](README.md)

## About

This local version of [FocusTodo](https://focustodo.cn) is maintained from [lamngockhuong/focustodo](https://github.com/lamngockhuong/focustodo) version 7.1.1 as a standalone repository. The untouched upstream version is preserved on `upstream/7.1.1`; see the [maintenance guide](docs/MAINTENANCE.md#7-源码来源与原版归档) for provenance and branch roles.

> **Disclaimer**: This project is for personal learning and research purposes only. Please support the official [FocusTodo](https://focustodo.cn) software.

## Requirements

### Option 1: Node.js (Recommended)
- Node.js 22+; CI covers Node.js 22/24 on Windows, macOS and Linux
- Run `node scripts/start.cjs` or `npm start`; no npm dependency installation required
- Binds to `127.0.0.1:5500`, disables caching, and supports audio byte ranges

### Option 2: Python
- Python 3.7+ (manual fallback)
- No dependencies required

Use a local HTTP server and keep your existing hostname and port. Browser data is scoped to the origin; direct file access is outside the validated workflow.

## Quick Start

Use the [online GitHub Pages app](https://menggou1.github.io/FocusTodo-Local/). The online site and local loopback address have separate browser storage; use backup export/import to move your data.

Download and extract either portable archive from [Releases](https://github.com/menggou1/FocusTodo-Local/releases), then install Node.js 22+. The ZIP and tar.gz contain the same application and work on all three systems. Runtimes are not bundled. SHA256 checksums accompany each release.

All systems: `node scripts/start.cjs` or `npm start`. The default browser opens after the server starts. Use `node scripts/start.cjs --no-browser --port 5511` for headless use or a different port; with npm, use `npm start -- --no-browser --port 5511`.

### Windows
Double-click `启动.bat` or run PowerShell `.\start.ps1`

Open `http://127.0.0.1:5500/index.html`. Use `-NoBrowser` to suppress automatic browser opening and `-Port 5511` to select another port. Changing the port creates a different storage origin.

### macOS / Linux
```bash
sh start.sh
# Optional: sh start.sh --no-browser --port 5511
# or
python3 -m http.server 5500 --bind 127.0.0.1
```

### Access
```
http://127.0.0.1:5500/index.html
```

## Features

- 🍅 Pomodoro timer (25/5/15 min adjustable)
- ✅ Task management (projects, subtasks, deadlines, reminders)
- 📅 Calendar view
- 📊 Focus time reports
- 🎨 Custom themes (Bing daily wallpaper + local upload)
- 💾 Lossless Gzip / JSON backups, legacy imports, size analysis and optional wallpapers
- 🌲 Focus forest (sunlight rewards)
- 🌐 32 languages supported

## Tech Stack

- React 16.14.0 + Redux
- jQuery + Moment.js + Bootstrap Datepicker
- IndexedDB (PomodoroDB6) + localStorage
- Pure static files, no backend required

## File Structure

```
FocusTodo/
├── index.html          # Entry point
├── patch.js            # Local patch
├── main.css            # Styles
├── js/main.js          # Main application
├── i18n/               # Internationalization
├── img/                # Images
├── audio/              # Audio files
└── font/               # Fonts
```

## Data Storage

- **IndexedDB**: Tasks, pomodoro records, schedules, etc.
- **localStorage**: Settings, user credentials, themes, etc.

Timer sessions use the `TimerSession` store in `PomodoroDB6` v3. Long interruptions require confirmation. Stopping saves valid work and resets elapsed time; removing a timing task preserves the task in the list.

Settings → Account exports a complete `.json.gz` backup by default, with plain JSON and wallpaper omission available. Imports identify JSON/Gzip by content, retain v1/v2 compatibility, and show the backup scope before replacement. Omitting wallpapers restores the built-in Leaf theme. Automatic pre-import/reset JSON backups always include all data. Without compression support, exports fall back to JSON; Gzip imports require decompression support. Encoded and decoded backups are limited to 128 MB. Older app versions cannot directly import Gzip. Images still use localStorage and remain subject to browser quota. Starting a download does not prove the file was permanently saved.

## Documentation

The detailed maintenance documents are in Chinese.

| Goal | Start here |
|---|---|
| Changes, release evidence and historical reports | [Changelog](CHANGELOG.md) |
| Development, tests, known issues and version/release procedure | [Maintenance guide](docs/MAINTENANCE.md) |
| Module, database and legacy bundle boundaries | [Architecture](ARCHITECTURE.md) |

Current application: `7.1.1-local.1.3.0`, author Lexible. Development starts with `npm ci`; setup and checks are documented in the maintenance guide. The legacy React bundle is patched and cannot be fully rebuilt by the historical upgrade scripts.

Version 1.2.1 fixes a cross-tab initialization race exposed by intermittent macOS acceptance failures. Remaining desktop notification/audio/sleep verification limits are recorded in the maintenance guide and linked release reports.

## License

For personal use only. Please support the official software.
