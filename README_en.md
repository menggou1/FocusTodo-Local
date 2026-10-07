# FocusTodo

FocusTodo - Local Development Version

## About

This project is a local development version of [FocusTodo](https://focustodo.cn), modified from [lamngockhuong/FocusTodo](https://github.com/lamngockhuong/FocusTodo) for easier local development and debugging.

> **Disclaimer**: This project is for personal learning and research purposes only. Please support the official [FocusTodo](https://focustodo.cn) software.

## Requirements

### Option 1: Node.js (Recommended)
- Node.js 18+; validated with Node.js 24
- Run `node scripts/server.cjs`; no global npm/http-server installation required
- Binds to `127.0.0.1:5500`, disables caching, and supports audio byte ranges

### Option 2: Python
- Python 3.6+
- No dependencies required

Use a local HTTP server and keep your existing hostname and port. Browser data is scoped to the origin; direct file access is outside the validated workflow.

## Quick Start

### Windows
Double-click `启动.bat` or run PowerShell `.\start.ps1`

Open `http://127.0.0.1:5500/index.html`. Use `-NoBrowser` to suppress automatic browser opening and `-Port 5511` to select another port. Changing the port creates a different storage origin.

### macOS / Linux
```bash
node scripts/server.cjs
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
- 💾 Data export/import backup
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

## Validation

```powershell
npm test
node tests/browser-acceptance.cjs
node scripts/check-syntax.cjs
```

Browser acceptance requires Playwright and Chromium/Edge. Current version: `7.1.1-local.1.1.2`, author Lexible; the official base stays 7.1.1. This release fixes the blank page during task completion and guards repeated clicks. Updates appear in the top-right notification bell with a details dialog. About provides a GitHub icon hyperlink from the configured Git remote. Local data deletion requires no password and waits five seconds before confirmation, then requests a full backup download before reset.

Notifications, local dialogs and backup buttons follow the appearance theme. Focus shorter than 25 seconds is excluded from history; short pauses preserve active spans for resumed work. Reset restores the local user and default system lists, and startup repairs missing system lists. User-facing update details contain brief release notes only; maintenance Markdown reports remain in the repository. For future changes, read the [maintenance guide (Chinese)](docs/MAINTENANCE.md) for module responsibilities, dependencies, browser test setup and commit checks. The supplied legacy React bundle is already patched and cannot be fully rebuilt by the historical upgrade scripts.

All 75 automated cases passed: 25 timer, 7 server, 3 release consistency and 40 browser cases. Theme image migration, maintenance concurrency without Web Locks, real sleep/long process termination, and full chart/reward regression remain pending. Edit `release.json` and run `npm run build:release` to sync release metadata, title and asset cache tags; this does not rebuild the legacy bundle.

## Documentation

- [Architecture](./ARCHITECTURE.md) - Detailed technical architecture
- [Maintenance guide (Chinese)](docs/MAINTENANCE.md)
- [Current update and acceptance report (Chinese)](docs/UPDATE-7.1.1-local.1.1.2.md)
- [Versioning policy (Chinese)](docs/VERSIONING.md)
- [Stage 2 progress and acceptance report (Chinese)](docs/PROGRESS-2026-10-03-stage-2.md)
- [中文版](./README.md)

## License

For personal use only. Please support the official software.
