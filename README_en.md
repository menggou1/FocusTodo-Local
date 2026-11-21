# FocusTodo

Local browser focus and task app · **2.1.0** · **Lexible** · [中文](README.md)

The development branch is preparing 2.1.2. [2.1.2 update report](docs/en/releases/UPDATE-2.1.2.md)

The application builds from complete React, TypeScript and Vite sources. Tasks, focus history and preferences stay in the browser; no account server is required. It derives from [Lâm Ngọc Khương's FocusTodo 7.1.1](https://github.com/lamngockhuong/focustodo). Original source and history remain on `upstream/7.1.1`.

`dev` integrates daily work. On first publication, the version tag points to the verified head of remote `release/x.x.x`. After publication, synchronize that commit to `main` and `dev`. Pages deploys only from `main`. See [Maintenance](docs/en/MAINTENANCE.md) for the complete process.

## Install and run

Download a portable ZIP or tar.gz from [Releases](https://github.com/menggou1/FocusTodo-Local/releases) and verify it with SHA256SUMS.txt from the same release. This guide describes FocusTodo 2.1.0.

Extract ZIP or tar.gz, install Node.js 22.12+, and run `node scripts/start.cjs` or `npm start`. Portable packages need no npm dependencies. Windows: `启动.bat`; macOS/Linux: `sh start.sh`. The launcher opens `http://127.0.0.1:5500/index.html`. Use `--no-browser` for headless environments or `--port 5511` for another origin. Python 3.7+ can run `python scripts/serve-static.py`. Packages contain checksums, but no language runtime.

Source checkouts must build first:

```sh
npm ci
npm run build:release
npm run build
npm start
```


[GitHub Pages](https://menggou1.github.io/FocusTodo-Local/) deploys only from successful `main` workflows. Its storage is separate from loopback; transfer data with backups. Opening HTML directly is unsupported.

Development uses `npm run dev` on port 5511 with isolated storage. Historical UI comparisons use the separate archive/1.9.4 checkout; see [Testing](docs/en/TESTING.md). Tests must never connect to stable port 5500.

## Features

- Projects, folders, tags, subtasks, priorities, recurrence, deadlines and reminders.
- Countdown/countup, pause/resume, breaks, white noise, widgets and browser-dependent mini windows.
- Day/week/month schedules, quick creation, drag edits, manual records, completed history and reports.
- Local forest sunlight and achievements; the feature switch controls its header entry.
- Light/dark appearance, bundled/uploaded wallpapers and opt-in Bing sources.
- JSON/Gzip backups, legacy import, size inspection, wallpaper scope and explicit safety-backup confirmation.
- System language, Simplified Chinese and English; existing system-language catalogs fall back to English.

Groups, cloud sync and server rankings are excluded. System notifications, sound, downloads and Document PiP depend on browser/system support. Reduced motion disables relevant transitions.

## Data and upgrades

Production retains `PomodoroDB6` v3 and legacy setting keys. The application uses independent version `2.1.0`; source version 7.1.1, schema, backup format and legacy `Version='6.5'` remain separate. Keep the browser, hostname and port to retain the same origin. Another origin needs backup import. Development previews use `FocusTodoStandalone.PomodoroDB6` and `FocusTodoStandalone.data.*`.

Export a complete backup before upgrading. Import accepts legacy JSON and content-detected Gzip, with 128 MB file/decoded limits. Export falls back to JSON without compression support; older apps need decompressed JSON. Wallpaper data remains in localStorage and is quota-limited. Replacement/reset downloads a complete safety backup and requires confirmation that it is saved/readable. Cancel preserves data. Clearing site storage deletes local content.

TimerSession persists the timer. Execution gaps over five minutes require review; stopping saves eligible focus segments of at least 25 seconds. Close all app windows before rollback and keep a complete backup. Never delete databases to bypass compatibility checks.

## Documentation

[Guide](docs/en/GUIDE.md) · [Maintenance](docs/en/MAINTENANCE.md) · [Architecture](docs/en/ARCHITECTURE.md) · [Testing](docs/en/TESTING.md) · [Changelog](docs/en/CHANGELOG.md) · [Backlog](docs/BACKLOG.md)

## License

[MIT](LICENSE), retaining the Lâm Ngọc Khương and Lexible copyright notices. See [third-party notices](THIRD-PARTY-NOTICES.txt) and the complete licenses shipped in `licenses/`.
