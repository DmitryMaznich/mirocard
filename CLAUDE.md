# Mirocard2 - Claude Code Setup

## Canonical Project Root

Work from this directory only:

```text
C:\Users\dmazn\Projects\Mirocard2
```

Do not open backup archives, restored backup folders, Synology backup folders, `dist/`, `runtime/`, or `output/` as the main project.

## Runtime Host (backend + Caddy)

| Parameter | Value |
|-----------|-------|
| LAN IP | `192.168.1.163` |
| Tailscale IP | `100.124.69.40` |
| Tailscale hostname | `laptop-353ltno0.taile45e98.ts.net` (Funnel -> :8080) |
| SSH port | 22 |
| User | `dmazn` |
| Project path | `C:/Users/dmazn/Projects/Mirocard2` |
| Frontend dist | `C:/Users/dmazn/Projects/Mirocard2/dist` |
| Backend API | `127.0.0.1:3012` (Caddy reverse-proxies `/api/*`) |
| LAN URL | `http://192.168.1.163:8080/` |
| Public URL | `https://mirocard.kaplieva.help/` |

Do not deploy the backend to Synology. Synology/SmartNAS is backup storage only.

## Credentials

Do not write secrets into repository docs. Use environment variables, Windows Credential Manager, SSH keys, or the password manager.

Local files that may contain secrets and must stay gitignored:

```text
.env
backend/.env
```

If credentials are needed for deployment, use `MIROCARD_DEPLOY_PASSWORD` or `MIROCARD_DEPLOY_KEY_PATH` outside git.

## Deploy

```bash
npm run deploy:prod    # build + upload to the Windows/Caddy runtime
npm run deploy:verify  # verify public and LAN URLs
```

Before deploy: run `git status --short`, commit intentional changes, then run the deploy script. Dirty worktree deploys require an explicit emergency-only `--allow-dirty`.

Details: `DEPLOYMENT.md`.

## Backend (Node.js)

The backend runs on the runtime host, normally via the `MirocardBackend2` Windows Scheduled Task. It listens on `127.0.0.1:3012`.

Backend source changes are not deployed by `npm run deploy:prod`; follow `DEPLOYMENT.md` for backend copy/restart/verification.

## Backups

Backup destination:

```text
\\SmartNAS\home\Drive\!Документы\MirocardBackups
```

Backup scripts:

```text
scripts/backup-project.ps1
scripts/backup-db-hourly.ps1
scripts/backup-sqlite.mjs
scripts/install-backup-tasks.ps1
```

Rules for Claude Code:

- Do not inspect or edit Synology backup archives during normal development.
- Do not commit backup archives, restored backup folders, `.env`, `backend/.env`, or runtime database files.
- Do not run backup scripts with `-IncludeSecrets` unless the user explicitly asks and confirms the destination is encrypted/access-controlled.
- `runtime/data/mirocard.db` is production/runtime data, not source code.

Production DB protection:

- Runtime host `192.168.1.163` runs `Mirocard Production DB Hourly Backup` hourly.
- It writes SQLite backups to `C:\Users\dmazn\MirocardBackups\hourly-db` on the runtime host.
- Local full backup packages fetch the latest production DB backup over SSH via `scripts/fetch-production-db-backup.py` and include it under `db/production/`.
- Do not restart or stop the backend for backups.

Restore and scheduling details: `docs/backup-restore.md`.

## Important

- Synology/SmartNAS is allowed only as backup storage, not as a backend/runtime target.
- Two backend processes on `3012` conflict; stop the old process before starting a new one.
- `npm run deploy:verify` must pass after every production deploy.
- Rotate any token or password that was ever committed, pasted into docs, or embedded in git remotes.

## iOS Safe Area (notch / Dynamic Island / home indicator) — mandatory check

The app runs as an iOS PWA with `viewport-fit=cover`. Any screen-level element pinned to
a screen edge — header, footer, floating close/back/action button, bottom sheet — renders
under the iPhone status bar/notch/Dynamic Island or the home-indicator bar if it doesn't
reserve space for it, and its buttons become untappable there. This has been a recurring
bug (fixed piecemeal multiple times: `.home-header`, `.session-topbar`, `.planner-header`,
`.chat-header`, `.shs-root`, `.admin-lock-fab`, `.worksheet-close-button--floating`,
`.video-reward-close`, and others — audited and fixed 2026-07-06).

**Rule — apply this in the same diff that adds or edits any screen-level fixed/sticky/
absolute-positioned element, not as a follow-up:**

- Global CSS variables already exist in `src/styles.css` (`:root`): `--app-safe-top`,
  `--app-safe-right`, `--app-safe-bottom`, `--app-safe-left` (backed by
  `env(safe-area-inset-*)`, boosted under `html.app-ios-standalone`). Use them — do not
  invent new ones.
- Top bars: `padding-top: calc(<original> + var(--app-safe-top, 0px))`.
- Bottom bars/sheets: `padding-bottom: calc(<original> + var(--app-safe-bottom, 0px))`.
- Floating buttons pinned to a corner (`position: fixed`/`absolute` + `top`/`right`/
  `bottom`/`left`): add the matching `var(--app-safe-*, 0px)` to that offset, e.g.
  `top: calc(12px + var(--app-safe-top, 0px)); right: calc(12px + var(--app-safe-right, 0px));`.
- Reusing an existing shared class (`.screen-header`, `.planner-header`, `.home-header`,
  `.session-topbar`) already covers this — no extra work needed. The bug only appears
  when a **new** header/footer/floating-button class is introduced.
- Before calling a new/changed screen done, grep the touched CSS for
  `position:\s*(fixed|sticky|absolute)` and confirm every rule with a `top`/`right`/
  `bottom`/`left` offset that reaches a real screen edge has the variable baked in.
- To verify without a physical device (Playwright or devtools console):
  ```js
  document.documentElement.classList.add('app-ios-standalone');
  document.documentElement.style.setProperty('--app-safe-top', '59px');   // Dynamic Island
  document.documentElement.style.setProperty('--app-safe-bottom', '34px'); // home indicator
  ```
  then screenshot the screen — anything now cramped or overlapping the top/bottom edge
  needs the fix above.
