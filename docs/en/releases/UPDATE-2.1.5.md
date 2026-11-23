# FocusTodo 2.1.5

[Changelog](../CHANGELOG.md) · [中文](../../releases/UPDATE-2.1.5.md)

Prepared on 2026-11-23 (Asia/Shanghai) by Lexible. This patch covers About settings and the release workflow.

## About settings

About uses the 1.9.4 label and content columns and standard settings rows. Separate rows show the version, author, upstream project, MIT and third-party notices, and local data information. Content wraps and scrolls in narrow windows.

The original 24×24 GitHub icon returns alongside the author. All six official download icons use the same background highlight and visible keyboard focus. The download row uses a plain settings label, with links on the platform icons. It is followed by the official website at www.focustodo.cn and a note thanking the original developers and encouraging support through official channels.

## Development and publishing

The bilingual maintenance guides describe themed releases and semantic versioning. The current batch uses a reusable template, with unfinished work maintained in [Backlog](../../BACKLOG.md).

Release CI selects original full matrix results and unexpired artifacts for the exact SHA based on ref identity. Preflight compares every archive file with the current build and smoke-tests extracted packages. The independent gate checks the evidence again. Release publication and Pages deployment run their own version, provenance, and artifact checks. Unverifiable evidence triggers the full matrix. Preflight and the independent gate record the original SHA, run number, and artifact digest in the Actions summaries.

[Maintenance](../MAINTENANCE.md) · [Testing](../TESTING.md)
