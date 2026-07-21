# FocusTodo

FocusTodo - Local Development Version

## About

This project is a local development version of [FocusTodo](https://focustodo.cn), modified from [lamngockhuong/FocusTodo](https://github.com/lamngockhuong/FocusTodo) for easier local development and debugging.

> **Disclaimer**: This project is for personal learning and research purposes only. Please support the official [FocusTodo](https://focustodo.cn) software.

## Requirements

### Option 1: Python (Recommended)
- Python 3.6+
- No dependencies required

### Option 2: Node.js
- Node.js 14+
- Optional: `npm install -g http-server`

### Option 3: Direct Browser
- Open `index.html` directly (some browser features may be limited)

## Quick Start

### Windows
Double-click `启动.bat` or run PowerShell `.\start.ps1`

### macOS / Linux
```bash
python3 -m http.server 8080
# or
npx http-server -p 8080
```

### Access
```
http://localhost:8080
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

## Documentation

- [Architecture](./ARCHITECTURE.md) - Detailed technical architecture
- [中文版](./README.md)

## License

For personal use only. Please support the official software.