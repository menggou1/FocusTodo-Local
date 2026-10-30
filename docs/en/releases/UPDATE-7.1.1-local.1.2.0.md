# 7.1.1-local.1.2.0 — Cross-platform launcher and portable packages

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [Backlog](../BACKLOG.md)

Date: 2026-10-21. Author: Lexible.

## Delivered behavior

- Use a common launcher on Windows, macOS and Linux, with browser opening, custom ports and headless mode.
- Download ZIP or tar.gz packages and run with Node.js; application dependencies do not need installation.
- Keep the same browser, hostname and port to retain existing local data.

## Technical and verification account

A shared Node launcher supports Windows/macOS/Linux, native browser opening, custom ports and headless use. Windows and POSIX wrappers resolve their own directory, including spaces and Unicode. CI covers Node 22/24; Node 24 adds Chromium and extracted-package checks. A tag can publish only after version matching, main ancestry and all checks. A later macOS initialization race was fixed in 1.2.1; it is not a current 1.2.0 task.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/releases/tag/1.2.0)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/actions/runs/39626022895)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/blob/1.2.0/docs/acceptance/results.json)

[Original Chinese report](../../releases/UPDATE-7.1.1-local.1.2.0.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
