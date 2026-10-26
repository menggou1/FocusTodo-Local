# 7.1.1-local.1.4.1 — Progressive startup, language fonts and local compatibility

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-26. Author: Lexible.

## Delivered behavior

- See a lightweight first screen and real loading progress, then enter the workspace while images and fonts finish loading.
- Start Chinese and English from the existing catalog, load other languages asynchronously, and retry slow or failed loads.
- Apply bundled Chinese fonts once loaded, prefer western system fonts in English, and retain the official timer fonts.
- Consolidate local data, backup, settings and theme services, remove unused polling and debugging, and preserve profile edits and recovery.

## Technical and verification account

HTML includes a first screen and real progress before external assets. Two async stylesheets and thirteen ordered deferred scripts report fifteen resource completions plus application mounting. Required CSS and existing data recovery precede the workspace; images and fonts do not block it. Chinese uses bundled Noto Sans SC with automatic font swap; English prioritizes western system fonts without downloading bundled CJK fonts. Local dialogs share the same font variable, and timer font declarations match archived official 7.1.1. Identity/storage now belongs to the data service, backup UI to the existing backup module, preferences to settings, and theme UI to the existing theme storage/recovery module. Network remains an independent responsibility; patch.js installs feature services in order. Repeated installation preserves API identities and recovery ordering. The unused global-jQuery polling branch and manual username debug helper were removed after tracing the module export and live profile edits. Cold-start results below compare a single isolated run per revision against 89274a1 using 150 ms synthetic latency and 200 KiB/s, aborting optional images and fonts equally. This is local evidence, not a live Pages guarantee. Pages publishes a filtered artifact from main using the official Actions workflow.

## Local cold-start comparison

| Revision | First contentful paint (ms) | Workspace DOM/CSS ready (ms) |
|---|---:|---:|
| baseline | 17828 | 17759 |
| current | 332 | 15154 |

Generated empty browser data and the project subpath were used. These are local synthetic-network observations, not a live Pages speed guarantee.

## Evidence

- [Public evidence 1](https://github.com/menggou1/FocusTodo-Local/blob/main/.github/workflows/pages.yml)
- [Public evidence 2](https://github.com/menggou1/FocusTodo-Local/commit/562c6e6aa187686e7fea677fd9ecc39891bd5321)
- [Public evidence 3](https://github.com/menggou1/FocusTodo-Local/actions/runs/40315087314)
- [Public evidence 4](https://github.com/menggou1/FocusTodo-Local/actions/runs/40315087312)

[Original Chinese report](../UPDATE-7.1.1-local.1.4.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
