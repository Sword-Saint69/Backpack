# Backpack — Architecture & Production Plan

**Pack up your databases. Back them up to GitHub, free.**

Backpack is a cross-platform desktop app (Electron + Node.js) that connects to one
or more databases (Firebase/Firestore, Postgres/NeonDB, MySQL, and any future
adapter), exports their data to JSON, and pushes it to a GitHub repository as
free, versioned backup storage. Every backup is a Git commit, so GitHub's
commit history becomes a free point-in-time snapshot history — no extra backend
required.

---

## 1. Product Goals

| Goal | Detail |
|---|---|
| Zero-cost storage | Use GitHub repos (public or private) as the storage backend — no S3/GCS bill. |
| Multi-database | Firebase, Postgres/NeonDB, MySQL out of the box; adapter interface for more. |
| Set-and-forget | In-app scheduler (cron-style) runs backups unattended, with tray icon + startup launch. |
| Safe by default | Secrets encrypted at rest via OS keychain (Electron `safeStorage`), never logged, never sent anywhere except the DB and GitHub. |
| Resilient | Retries, partial-failure isolation (one DB failing doesn't block others), full audit log. |
| Production-ready | Auto-update, crash reporting, signed installers, tested adapters, documented recovery process. |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron App (Backpack)                 │
│                                                                   │
│  ┌───────────────┐        IPC (contextBridge)      ┌──────────┐ │
│  │   Renderer     │ <────────────────────────────>  │   Main   │ │
│  │ (UI: React or  │                                  │ Process  │ │
│  │  plain HTML)   │                                  │ (Node.js)│ │
│  └───────────────┘                                  └────┬─────┘ │
│                                                            │       │
│         ┌──────────────────────────────────────────────────┼───┐  │
│         │                     Main Process Modules          │   │  │
│         │                                                    │   │  │
│         │  store.js        adapters/*.js       lib/github.js│   │  │
│         │  (encrypted       (Firebase, Postgres, (Octokit,   │   │  │
│         │   config via      MySQL, ...)          contents API│   │  │
│         │   safeStorage)                          + retries) │   │  │
│         │                                                    │   │  │
│         │  lib/scheduler.js (node-cron)   lib/backupRunner.js│   │  │
│         │  lib/logger.js (rotating file log)                 │   │  │
│         └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                │                                    │
                ▼                                    ▼
     ┌─────────────────────┐              ┌───────────────────────┐
     │  Databases           │              │  GitHub Repository     │
     │  - Firestore          │   JSON      │  backups/              │
     │  - Postgres/NeonDB    │ ───────────►│    <connection>/        │
     │  - MySQL               │             │      2026-08-04T120000Z.json │
     │  - (pluggable more)    │             │      latest.json        │
     └─────────────────────┘              └───────────────────────┘
```

**Process split (Electron security model):**
- **Main process** — the only process with DB drivers, credentials, GitHub token,
  and filesystem/network access. This is where all backup logic runs.
- **Renderer process** — sandboxed, `contextIsolation: true`, `nodeIntegration: false`.
  Talks to main only through a narrow `preload.js` bridge (add/edit connection,
  run backup now, fetch logs). It never sees decrypted secrets — main returns
  only masked/redacted views (e.g. `hasSecret: true`), except into the "edit"
  form when the user explicitly opens it.

---

## 3. Core Modules

### 3.1 `store.js` — Encrypted Config Store
- Wraps `electron-store` (JSON on disk in the OS app-data folder).
- Secrets (service-account JSON, connection strings, GitHub PAT) are encrypted
  with `safeStorage.encryptString`, which is backed by the OS keychain
  (macOS Keychain, Windows DPAPI, libsecret/kwallet on Linux). If no OS
  keychain is available, Backpack warns the user explicitly rather than
  silently storing plaintext.
- Config schema: `connections[]`, `github{}`, `logs[]`, `schedules[]`.

### 3.2 `adapters/*.js` — Database Adapters
Common interface every adapter implements:
```js
{
  testConnection(secret) -> Promise<boolean>,
  exportData(connectionId, secret, options) -> Promise<{ [tableOrCollection]: any[] }>
}
```
- **Firebase**: iterates all root collections (and subcollections) via the
  Admin SDK, using a per-connection isolated app instance.
- **Postgres/NeonDB**: reads `information_schema.tables`, dumps each table
  with `SELECT *`. Supports SSL (NeonDB requires it).
- **MySQL**: `SHOW TABLES`, dumps each with `SELECT *`.
- **Extensibility**: adding MongoDB, SQLite, Supabase, Airtable, etc. means
  adding one file that satisfies the interface above and registering it in
  `adapters/index.js`. No changes needed elsewhere.

### 3.3 `lib/github.js` — Upload Layer
- Uses `@octokit/rest` against the Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`)
  — no local `git` binary required, works from any OS without configuration.
- Writes two things per backup run:
  - `backups/<connection-name>/<ISO-timestamp>.json` — immutable snapshot.
  - `backups/<connection-name>/latest.json` — always overwritten, for quick access.
- Commit message includes connection name, row/doc counts, and duration.
- **Size handling**: GitHub blocks files >100MB via the Contents API. Backpack:
  - Streams/batches large exports into `part-0001.json`, `part-0002.json`, etc.
    (configurable chunk size, default ~40MB pre-encoding headroom).
  - Warns the user in the UI and log if a single table/collection alone exceeds
    the limit, with a suggestion to filter or paginate that source.
- **Retry policy**: exponential backoff (3 attempts) on 5xx/network errors;
  GitHub secondary rate-limit responses are respected via `Retry-After`.

### 3.4 `lib/scheduler.js` — Scheduling
- `node-cron` inside the main process; each connection has its own cron
  expression (default hourly/daily presets + custom cron string in the UI).
- "Run on system startup" via Electron's `app.setLoginItemSettings`.
- Missed-run handling: if the app wasn't running at the scheduled time, the
  next launch checks `lastRunAt` per connection and offers a "catch-up" run.

### 3.5 `lib/backupRunner.js` — Orchestration
- Given a connection, runs: `testConnection` (fast fail) → `exportData` →
  size-check/chunk → `github.upload` → `store.appendLog`.
- **Isolation**: each connection's backup runs independently; one failing
  does not cancel others in the same scheduled batch (`Promise.allSettled`).
- Emits progress events to the renderer (connecting → exporting → uploading →
  done/error) for live UI feedback.

### 3.6 `lib/logger.js` — Logging & Audit Trail
- Rotating local log file (e.g. `electron-log`), separate from the in-app
  "last 200 runs" log shown in the UI.
- Never logs secret values — connection strings/tokens are redacted before
  any log line is written.

---

## 4. Full Feature List

### MVP (already scaffolded)
- [x] Add/edit/delete DB connections (Firebase, Postgres/NeonDB, MySQL)
- [x] Encrypted local secret storage
- [x] Manual "Backup now" per connection
- [x] Upload JSON to GitHub via Contents API
- [x] Basic run log

### Production-readiness additions
- [ ] **Scheduler UI** — per-connection cron presets + custom expression, next-run display
- [ ] **Tray icon** — minimize to tray, quick "Backup all now", status indicator (idle/running/error)
- [ ] **Launch at startup** toggle
- [ ] **Dry-run mode** — preview row/doc counts and payload size without uploading
- [ ] **Selective backup** — choose specific tables/collections instead of "all"
- [ ] **Compression option** — gzip JSON before upload to cut GitHub storage/transfer
- [ ] **Encryption-at-rest option for the backup file itself** — optional client-side AES encryption of the JSON before it's committed, for sensitive data in public repos
- [ ] **Multiple GitHub targets** — different repos/branches per connection (e.g. separate repos per project)
- [ ] **Restore tool** — pull a chosen commit's JSON back down and (for Postgres/MySQL) generate `INSERT` statements or replay into a target DB
- [ ] **Notifications** — desktop notification + optional webhook/email on failure
- [ ] **Auto-update** — `electron-updater` wired to GitHub Releases
- [ ] **Crash reporting** — opt-in, e.g. Sentry, with secrets scrubbed
- [ ] **Signed installers** — macOS notarization, Windows code signing (avoids SmartScreen/Gatekeeper warnings)
- [ ] **Multi-window safe** — single-instance lock (`app.requestSingleInstanceLock`) so two copies don't race on the same schedule
- [ ] **Backup pruning policy** — optional: keep last N timestamped snapshots per connection, delete older ones via the Contents API to bound repo size
- [ ] **Onboarding checks** — validate GitHub token scopes (`repo` scope, or fine-grained "Contents: read/write") and repo existence before first run

---

## 5. Security Model

1. **Secrets never leave the device** except to (a) the database itself and
   (b) GitHub, both over TLS.
2. **At rest**: encrypted via OS keychain (`safeStorage`); if unavailable,
   the user is warned and can choose to proceed or abort.
3. **In the renderer**: no secret ever crosses the `preload.js` bridge in
   plaintext for display; only masked booleans (`hasSecret`) are returned.
4. **GitHub token scope**: recommend a **fine-grained PAT** scoped to only
   the specific backup repo, with "Contents: Read and write" — not a
   classic token with full `repo` access.
5. **Public vs private repos**: the UI warns clearly if the selected repo is
   public, since JSON dumps of a database are sensitive by default.
6. **Electron hardening**: `contextIsolation: true`, `nodeIntegration: false`,
   `sandbox: true`, a strict `Content-Security-Policy` in the renderer, and
   no remote content loaded (UI is fully local files).

---

## 6. Reliability & Error Handling

- **Retries**: network calls (DB connect, GitHub API) retry with exponential
  backoff (e.g. 1s, 4s, 10s), capped at 3 attempts.
- **Partial failure isolation**: a scheduled "backup all" run uses
  `Promise.allSettled`; each connection's success/failure is logged and
  surfaced independently, and one failure triggers a notification without
  blocking the others.
- **Idempotency**: each run's timestamped filename is unique, so a
  crash/retry mid-run at worst produces a duplicate snapshot, never a
  corrupted one (writes are all-or-nothing at the file level via the
  Contents API).
- **Timeouts**: DB queries and GitHub calls have explicit timeouts so a
  hung connection doesn't block the scheduler indefinitely.

---

## 7. GitHub Repo Layout (convention)

```
backups/
  neon-prod-db/
    latest.json
    2026-08-01T030000Z.json
    2026-08-02T030000Z.json
  firebase-app/
    latest.json
    2026-08-01T030000Z.json
    2026-08-01T030000Z.part-0001.json   (if chunked)
manifest.json     <- last run summary for every connection, machine-readable
```

`manifest.json` gives you (or any external monitoring script) a single file
to check freshness without scanning the whole repo.

---

## 8. Testing Strategy

- **Unit tests** (Jest): each adapter tested against a local Docker
  Postgres/MySQL and the Firebase emulator suite — no real cloud credentials
  needed in CI.
- **Integration test**: a "fake GitHub" mock server validates the upload
  payloads, chunking logic, and retry/backoff behavior.
- **E2E**: Playwright/Spectron-style test driving the Electron UI through
  add-connection → backup-now → verify commit appeared (against a disposable
  test repo).
- **Manual QA checklist** before each release: fresh install on macOS/
  Windows/Linux, keychain unavailable fallback, large-DB chunking, revoked
  GitHub token error path, offline behavior.

---

## 9. Packaging & Distribution

- `electron-builder` targets: `dmg` (macOS, notarized), `nsis` (Windows,
  signed), `AppImage` (Linux).
- `electron-updater` checks a GitHub Releases feed on launch and offers
  in-app update installs.
- Versioning: SemVer; release notes generated from commit history.

---

## 10. Roadmap Beyond v1

- MongoDB / SQLite / Supabase / Airtable adapters
- Web dashboard (optional, reads the same GitHub repo) for teams who want a
  browser view without installing the desktop app
- Alternative storage backends (GitLab, self-hosted Gitea) behind the same
  upload interface, for teams who don't use GitHub
- Encrypted "restore wizard" with schema diffing before replay

---

## 11. Versioned Upgrade Roadmap

A concrete path from MVP to a mature product, grouped into shippable
versions rather than one big backlog.

### v1.0 — Core (MVP, launch)
- Add/edit/delete connections: Firebase, Postgres/NeonDB, MySQL
- Encrypted local secret storage (`safeStorage`)
- Manual "Backup now" per connection
- GitHub upload via Contents API, timestamped + `latest.json`
- Basic run log (last 200 runs, in-app)
- Single-instance lock, basic error toasts

### v1.1 — Automation
- In-app scheduler (cron presets + custom expression) per connection
- "Launch at startup" toggle
- Tray icon with status (idle/running/error) and "Backup all now"
- Missed-run catch-up on next launch
- Desktop notifications on success/failure

### v1.2 — Control & Safety
- Selective backup: pick specific tables/collections instead of "all"
- Dry-run mode (preview size/row counts, no upload)
- GitHub token scope validation + public-repo warning on setup
- `manifest.json` written per run (machine-readable freshness summary)
- Backup pruning policy (keep last N snapshots per connection)

### v1.3 — Scale & Payload Handling
- Automatic chunking for tables/collections that exceed GitHub's 100MB file limit
- Optional gzip compression before upload
- Optional client-side AES encryption of the JSON before commit (for public repos)
- Configurable retry/backoff and per-connection timeout settings

### v1.4 — Reliability & Ops
- Rotating local log file separate from in-app history (`electron-log`)
- Opt-in crash reporting with secret scrubbing
- Webhook/email alert option on failure (in addition to desktop notification)
- Auto-update via `electron-updater` + GitHub Releases

### v1.5 — Restore
- Restore wizard: browse commit history, pick a snapshot, preview diff vs. current DB
- Postgres/MySQL restore: generate `INSERT`/`UPSERT` statements or replay directly into a target DB
- Firestore restore: replay documents/collections back into a project (same or different)

### v2.0 — Adapter Expansion
- MongoDB, SQLite, Supabase, Airtable, DynamoDB adapters
- Formal adapter plugin system (drop-in `.js` files or npm packages, auto-discovered)
- Community adapter template + docs

### v2.1 — Team & Multi-Target
- Multiple GitHub targets (different repo/branch per connection)
- Alternative storage backends behind the same interface: GitLab, self-hosted Gitea
- Shared team config profile (export/import connection settings, secrets excluded)

### v2.2 — Visibility
- Optional lightweight web dashboard that reads the same GitHub repo (backup freshness, size trends, history browser) — no server required, static site reading the repo via GitHub API
- Backup size/growth charts over time inside the desktop app

### v3.0 — Advanced
- Schema-diffing before restore (warn about breaking changes between snapshot and live schema)
- Incremental/delta backups (only changed rows/docs) to cut payload size on large DBs
- Role-based access if run in a shared/team environment (who can add connections, who can trigger restores)

---

## 12. Current Scaffold Status

Already written in this project:
- `src/store.js` — encrypted config store
- `src/adapters/firebase.js`, `postgres.js`, `mysql.js`
- Pending: `src/lib/github.js`, `src/lib/scheduler.js`, `src/lib/backupRunner.js`,
  `src/main.js`, `src/preload.js`, `src/renderer/*` (UI)

Next build step: implement `lib/github.js` (Octokit upload + chunking) and
`main.js`/`preload.js` wiring, then the renderer UI.
