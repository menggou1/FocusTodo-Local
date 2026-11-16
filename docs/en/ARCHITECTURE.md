# React standalone architecture

[Maintenance](MAINTENANCE.md) · [Testing](TESTING.md) · [中文](../ARCHITECTURE.md)

## Entry and distribution

FocusTodo 2.0.0 builds from complete React/TypeScript sources under standalone/ with Vite. app/main.tsx waits for required styles, constructs explicit browser capabilities/services, then mounts ErrorBoundary and App. Production never loads the legacy bundle, patch.js, Redux or FocusLocal globals. Legacy src/ and revise tools remain only for compatibility/differential/UI-oracle tests.

features/workspace owns business views and shared dialogs; domain owns pure timer/recurrence/calendar/report/version rules; services owns data, settings, transactions, timers, audio, wallpaper, network, forest and backups. shared owns generated catalogs and types; public owns upstream assets. Scripts own generation, builds, startup, packaging and deployment gates.

Production outputs dist/app/site, isolated preview dist/standalone/site. Relative resource URLs support project subpaths. Explicit manifests constrain distributed/served files; maps and Vite metadata stay in private debug folders. A source/resource/config/lock digest rejects stale packages. Pages also verifies committed inputs.

## Data and lifecycle

Production explicitly selects PomodoroDB6 v3 and legacy unprefixed preferences. Preview uses FocusTodoStandalone.PomodoroDB6 and FocusTodoStandalone.data.*, rejecting unrelated data before service creation. Production does not require preview attestation or indexedDB.databases and can run on Pages. Data services still default to rejecting the legacy database unless the production adapter supplies matching explicit capabilities.

Project, Task, Subtask, Pomodoro and Schedule hold business data; Group/GroupUser/Message preserve backup compatibility only; TimerSession holds the timer and LocalMeta holds protocol/recovery state. Group uses groupId, Message messageId, others id. Group indexes include membersNum. Locks use a separate database. App version 2.0.0 does not change schema v3, backup exportVersion 2 or legacy Version='6.5'.

Startup recovers import/theme journals before preferences, timer and business snapshots. Maintenance ownership, protocol checks and expected fields protect concurrent writes. Restore/reset wait for a complete safety-backup confirmation, preserve DB/settings consistency through journals and fail closed when recovery cannot complete. Legacy JSON/Gzip validate format, references, capacity and fields while preserving unknown compatible data.

The service timer is the single persisted truth: eligible focus segments require 25 seconds; gaps over five minutes require review. Native PiP portals reuse commands/session, not another DB writer. Automatic background audio requires Web Locks ownership; without it, explicit audition/effects remain available.

## UI

App owns workspace navigation/selection; Timer remains mounted outside navigation. Native top-layer dialogs preserve the workspace below them. ConfirmDialog unifies stop/delete/safety confirmation; Dialog owns titles, errors, focus return and close motion. Dedicated selectors retain draft/confirm semantics; portals avoid inspector/scroll clipping.

Report rows calculate their full CSS height during render. A layout effect synchronizes bitmap dimensions and axes before first paint, followed by bottom-up record reveal. Fonts/resize repaint rather than hiding delayed layout. Completed history groups tasks and records by completion/end day with legacy card backgrounds, dates and neutral done icons. Running work shows the stopwatch; pause/stop/completion restore appropriate icons. The forest header subscribes to committed forestEnabled preferences.

## Service contracts

ApplicationServices in standalone/services/core.d.mts is authoritative. createCoreServices composes services; createBrowserServices injects native capabilities. Components receive neither repository transactions nor legacy globals. Changes update implementation, types and differential evidence together.

| Service | UI contract |
|---|---|
| Timer / startForTask | Committed immutable snapshots, subscriptions, commands and views. Task/subtask startup rechecks associations inside the write transaction. Service scheduling owns ticks; components display projections. Repeated unchanged refresh retains snapshot identity. |
| Business | Discriminated commands atomically manage projects/folders/tasks/recurrence/subtasks/schedules/manual records. Expected fields are compared in the same transaction; stale edits reject. Queries/search/history/progress/reports use committed snapshots and preserve IDs/unknown fields. |
| Calendar | Events retain real timestamps/source records. Pure interval layout and local-calendar deadlines; task/plan quick-create is atomic, plan edits compare originals. The UI owns day/week/month projection without rewriting historical timestamps. |
| Preferences / language | Single-key commits share maintenance ownership and publish after storage succeeds. Preserve legacy defaults/clamps. Explicit auto/zh-CN/en and existing system catalogs/fallback; never translate user content. Profile commands validate local names/avatars. Unknown settings survive complete backups. |
| Themes / wallpaper | Journal-backed theme read/commit; image add/select/classic/remove/Bing commands. External networking defaults off. Cancellation guards are rechecked after acquiring storage ownership. Preserve distinct legacy custom/Bing thumbnail order. |
| Network | Explicit same-origin/exact Bing client; redirects, credentials/referrer, sizes, timeout and cancellation are constrained. The UI does not bypass it for wallpaper/cloud traffic. No simulated cloud success. |
| Audio / notifications / reminders | Automatic background audio requires native ownership locks; unavailable/failed ownership disables it while effects/audition remain. Permission requests require explicit user action. Reminders persist task/reminder-date read keys and own scheduling. Native resources are injected. |
| Forest | Balance and reward markers commit as one value under maintenance ownership. Duplicate collection and achievement rewards are idempotent. Animation never owns persistence. |
| Backup | Export returns bytes/format/MIME/size/scope for the download UI. Restore/reset first await the backup sink, then preserve row/settings consistency through journals and refresh services. `backup:false` is for explicit isolated fixture loading; product confirmation uses defaults. |
| Release | Metadata comes from release.json; old/independent versions, schema and backup versions remain distinct. Mark read only after opening the current latest entry; history does not clear its badge. |

Composition lifecycle uses refresh/suspend/resume/dispose. Non-cached departure releases connections, transactions, broadcasts, schedulers, listeners and media; cached restoration pauses/resumes without destroying React/data. Component cleanup removes only its own subscriptions.

Domain failures include validation/conflict/network-blocked/timeout/cancelled/incompatible-client/disposed. IndexedDB may retain ConstraintError/VersionError/AbortError; recovery retains rolledBack/recoveryRequired. Failed writes do not publish uncommitted state; observer failures cannot reverse a committed command. Recovery/protocol/schema failure stops writes and preserves storage, never resets it as a repair.


## Additional business contracts

Frozen v1 commands/behavior remain valid. These additions supply the complete UI without direct component writes, partial sequential ordering commits or fabricated rewards/goals. DB v3, backup exportVersion 2, namespaces and client protocol 1 are unchanged.

| Entry/adapter | Contract |
|---|---|
| business.batch(commands) | 1–2000 updateTask/updateSubtask/updateProject/removeProject commands share v1 validation, associations and expected checks. One transaction commits all; any failure/conflict rolls everything back. Later commands see prior writes in the batch. Publish only after success and preserve unknown fields. Used for ordering and multi-select list management, not arbitrary repository access. |
| settings.goals() / setGoal(minutes) | Legacy Goals JSON in minutes, default 180; records retain {time,type:'TIME',value,sync:false}. Integer 0–1440, with zero removing the goal. Edits within 24 hours replace the last goal; older history remains. Service maintenance ownership protects writes. |
| forest.dailyLaunch() / rewards() | Once per local day, retaining streak/count and LaunchReward fields. Query unclaimed mature focus/task/daily/streak rewards: 30 daily, 6*min(days,80) streak, 5 per task, max(floor(minutes),1) focus. Claim window 24–48 hours. Actual claims use the existing canonical idempotent ledger, never UI balance arithmetic. |
| Native notification title | Composition supplies a localized current-language title; direct service defaults, permission and scheduling stay unchanged. |
| Browser backup sink | Download a complete pre-replacement backup and require explicit confirmation that it is saved/readable. Cancel throws cancelled before restore/reset. Initiating a download is insufficient; product code never uses backup:false. |


## D-V read-only wallpaper subscription (2026-11-15)

`wallpaper.subscribe/getSnapshot` exposes immutable `{loading, version}`. Loading describes the shared Bing request and clears on cancellation, failure or completion. Version increments only after a successful theme commit. Settings observes downloads and cached activation; the timer subscribes only to version changes to refresh its background. Component unmount does not cancel a shared download. Existing commands, cancellation guards, journals and storage formats remain unchanged. Network service and settings interaction tests cover stale-cache activation, switching during downloads, reopening settings, failure and retry.

## Additional contracts

business.batch accepts 1–2000 supported commands atomically, sharing validation, associations and expected checks. Goals retain legacy JSON/minutes/history; setGoal accepts integer 0–1440 (zero removes the target). Forest daily launch and claims use local days and the canonical idempotent ledger. wallpaper.subscribe/getSnapshot exposes immutable loading/version; unmount does not cancel shared downloads. Project snapshots own global order, preserving parent/expanded fields; reports cache frozen aggregation only within one committed snapshot and invalidate on refresh.

Network defaults off and permits only explicit same-origin/Bing requests. Generated language catalogs preserve system fallbacks without translating user content. Root MIT and complete bundled dependency/font licenses retain applicable copyright and provenance.
