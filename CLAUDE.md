# Mirocard2 - Claude Code Setup

## Canonical Project Root

Work from this directory only:

```text
C:\Users\dmazn\Projects\Mirocard2
```

Do not open backup archives, restored backup folders, Synology backup folders, `dist/`, `runtime/`, or `output/` as the main project.

## Runtime Host (Railway)

> **ВАЖНО:** production теперь на Railway (проект "Mirocard", сервис `mirocard-backend`), не на локальной машине. Деплой — `git push origin main` (Railway auto-deploy из GitHub). БД — SQLite на Railway Volume (`/data`), недоступна напрямую через SSH; для чтения/изменения продакшн-БД нужен Railway API/dashboard shell, не paramiko. Локальный файл `runtime/data/mirocard.db` в рабочей копии — это **не продакшн**, а локальная разработка.

| Parameter | Value |
|-----------|-------|
| Public URL | `https://app.mironium.com/` |
| Railway project | Mirocard |
| Railway service | `mirocard-backend` |
| Source | GitHub `DmitryMaznich/mirocard`, branch `main` |
| Backend + SPA | serves both (`SERVE_STATIC=1`), no separate reverse proxy |
| DB | SQLite on Railway Volume, `MIROCARD_DATA_DIR=/data` |
| Backups | hourly, in-process (`scripts/railway-backup-loop.mjs`), only runs when `RAILWAY_ENVIRONMENT` is set |

Do not deploy the backend to Synology. Synology/SmartNAS is backup storage only.

Известное ограничение: SMTP (`mail.kaplieva.help`) недоступен из сети Railway (connection timeout) — email-подтверждение и восстановление пароля на `app.mironium.com` сейчас не работают. См. `DEPLOYMENT.md`.

### Старый хост (retired 2026-08-23)

Домашний Windows/Caddy хост (`192.168.1.163`, публичный адрес `mirocard.kaplieva.help`) отключён: `MirocardBackend2` scheduled task — **Disabled** (не удалён, обратимо). `/api/*` там теперь 502. Подробности старой схемы — в `DEPLOYMENT.md`, раздел "Former production path".

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
git push origin main   # Railway auto-deploys the whole app (frontend + backend)
```

`npm run deploy:prod` / `npm run deploy:verify` target the **old, retired** Windows/Caddy host — do not run them expecting a production effect; they no longer touch what's actually live.

Before pushing to `main`: run `git status --short`, commit intentional changes, run `npm run build` locally as a sanity check.

**Mandatory: every push to `main` that changes app behavior must bump the version in `package.json` first, in its own commit.** `git push origin main` deploys to production immediately (Railway auto-deploy) with no review gate, so the version is the only signal that distinguishes one deploy from the next — skipping it means `/api/version` can't tell you whether a given fix actually shipped. Bump before pushing, not after:

```bash
npm version patch --no-git-tag-version
git add package.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git push origin main
```

Skip only for changes that touch no app code (docs, this file, deck ZIPs pushed separately, etc).

After pushing, verify `https://app.mironium.com/api/version` returns the new version and `/` responds before considering the deploy done.

Details: `DEPLOYMENT.md`.

## Backend (Node.js)

The backend runs as part of the same Railway service as the frontend — no separate deploy step, no SFTP, no scheduled task to restart. A push to `main` redeploys both together.

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

Production DB protection (Railway, current):

- The `mirocard-backend` service itself runs the hourly backup loop in-process (`scripts/railway-backup-loop.mjs`), writing to `/data/backups/` on the same Volume, 14-day retention.
- No off-site copy yet — known gap, not yet solved. `scripts/fetch-production-db-backup.py` (SSH-based, below) no longer applies to current production.
- Do not restart or stop the backend for backups.

Old host backups (retired, 192.168.1.163):

- Runtime host `192.168.1.163` ran `Mirocard Production DB Hourly Backup` hourly, writing to `C:\Users\dmazn\MirocardBackups\hourly-db`.
- `scripts/fetch-production-db-backup.py` fetched the latest backup over SSH for local full backup packages — this pulled from the old host's `runtime/data/mirocard.db`, not Railway.

Restore and scheduling details: `docs/backup-restore.md`.

## Прописи (propis) topic

Handwriting-practice topic under active development (`src/topics/renderers/propis/`,
`tools/propis/`). Independent from `letter_writing` ("Написание букв") — don't touch
that topic while working on this one. Mode 1 ("Учим буквы") is shipped; mode 2 (PDF
export for print) is not started.

Before touching anything in this topic, read `docs/propis.md` first — it has the file
map, the ruling geometry's design decisions (and why), and pitfalls already hit once
(don't repeat them).

## Important

- Synology/SmartNAS is allowed only as backup storage, not as a backend/runtime target.
- After pushing to `main`, verify `https://app.mironium.com/api/version` and `/` both respond before considering a deploy done.
- `railway.json`'s builder must stay `"DOCKERFILE"` — Railpack/Nixpacks auto-detect has historically misidentified this repo as a static site.
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
