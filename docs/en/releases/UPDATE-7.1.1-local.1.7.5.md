# 7.1.1-local.1.7.5 — Guide, documentation and acceptance diagnostics

[Changelog](../CHANGELOG.md) · [Maintenance](../MAINTENANCE.md) · [中文报告](../../releases/UPDATE-7.1.1-local.1.7.5.md)

Date: 2026-10-30. Author: Lexible.

## Delivered behavior

- Continue the illustrated bilingual guide, About link, README cleanup and historical report organization from the [1.7.4 candidate](UPDATE-7.1.1-local.1.7.4.md).
- Capture bounded page state, requests, failures, page errors and a screenshot on startup acceptance failure without retries or longer assertion waits.

## Verification and release

The 1.7.4 main Windows Node 24 startup assertion timed out waiting for the status element; five other jobs and Pages succeeded. The cause is unknown because page state was not captured, and no 1.7.4 tag was created. New diagnostics preserve evidence if it happens again; see this version's GitHub Actions for cross-platform test and release results.

Local generation and syntax checks passed, as did 60 Node tests (one platform skip), 17 startup scenarios and the filtered Chinese/English About checks. A deliberately injected failure verified that state, requests and a screenshot are captured before the held requests are released.
