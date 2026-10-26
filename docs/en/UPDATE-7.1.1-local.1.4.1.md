# 7.1.1-local.1.4.1 — Progressive startup and loading feedback

[Changelog](CHANGELOG.md) · [Maintenance](MAINTENANCE.md) · [Backlog](BACKLOG.md)

Date: 2026-10-26. Author: Lexible.

## Delivered behavior

- See a lightweight first screen and real step progress, then enter when the core workspace is ready.
- Reuse Chinese and English catalogs, load other locales asynchronously, and retry long or failed loads.
- Use startup feedback with dark appearance, narrow screens, reduced motion and a no-JavaScript explanation.

## Technical and verification account

This single version record covers the previous startup work: an inlined first screen, real resource/mount progress, parallel downloads with ordered scripts, asynchronous language loading and retry feedback. Core readiness does not wait for optional images and fonts. The original isolated cold-start evidence retains its 1.4.1 label. Typography policy and feature consolidation are recorded in 1.4.3 rather than duplicated here.

## Local cold-start comparison

| Revision | First contentful paint (ms) | Workspace DOM/CSS ready (ms) |
|---|---:|---:|
| baseline | 17828 | 17759 |
| current | 332 | 15154 |

Generated empty browser data and the project subpath were used. These are local synthetic-network observations, not a live Pages speed guarantee.

## Evidence

The release behavior and commands are recorded in the repository history.

[Original Chinese report](../UPDATE-7.1.1-local.1.4.1.md). This English account summarizes the historical implementation and evidence; current instructions are in Maintenance, and unfinished work is maintained only in Backlog.
