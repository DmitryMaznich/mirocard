# Mirocard2 Deployment

This repo has one production deployment path: Railway.

## Canonical Production (Railway)

- Public URL: `https://app.mironium.com/`
- Railway project: **Mirocard**, service **mirocard-backend**, environment **production**
- Source: GitHub `DmitryMaznich/mirocard`, branch `main` — Railway auto-deploys on every push to `main`
- Build: `Dockerfile` at repo root (builds the SPA via `npm run build`, installs `backend/`, runs `node backend/server.mjs`)
- The backend serves both the API and the built SPA (`SERVE_STATIC=1`) — there is no separate Caddy layer on Railway
- Data: SQLite on a Railway Volume mounted at `/data` (`MIROCARD_DATA_DIR=/data`), 5 GB allocated
- Backups: the running backend itself runs an hourly SQLite snapshot loop (`scripts/railway-backup-loop.mjs`, `VACUUM INTO` + integrity check) onto the same volume under `/data/backups/`, 14-day retention. It only activates when `RAILWAY_ENVIRONMENT` is set (Railway injects this automatically), so it never runs on a local checkout.
- Env vars live in the Railway dashboard (Service → Variables), not in a local `.env` — there is nothing to SFTP or SSH for a normal deploy.

### Deploying

There is no separate `deploy:prod` step for the backend anymore. A normal deploy is:

```bash
git status --short   # must be clean
npm run build         # sanity-check the build locally first
```

Bump the app version and commit that on its own (this repo's convention — see
`git log --oneline -- package.json`, e.g. `chore: release v1.0.1968`):

```bash
npm version patch --no-git-tag-version
git add package.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
```

Then push:

```bash
git push origin main  # Railway picks this up automatically
```

Railway rebuilds the Docker image and redeploys within roughly 1–2 minutes of the push. Verify with:

```bash
curl -s https://app.mironium.com/api/version
curl -s -o /dev/null -w "%{http_code}\n" https://app.mironium.com/
```

### Known limitation: SMTP

`SMTP_HOST=mail.kaplieva.help` is not reachable from Railway's network (connection timeout on port 465). Email verification and password-reset emails currently do not send on `app.mironium.com`. This is a known gap, not yet fixed — `mail.kaplieva.help` is itself being retired, so a proper fix means pointing SMTP at whatever mail infrastructure replaces it, not re-opening a firewall for a domain that's going away.

### Railway dashboard reference

- `railway.json` at repo root pins the builder to the Dockerfile (`"builder": "DOCKERFILE"`) — do not let this drift back to Nixpacks/Railpack auto-detect, which historically misidentified this repo as a static site.
- Service settings must have `startCommand` explicitly set to `node backend/server.mjs` — if it falls back to `npm start`, every redeploy's old-container shutdown logs a noisy (harmless) "Deploy Crashed" email because `npm`'s process wrapper doesn't forward `SIGTERM` cleanly.
- Railway Volumes are single-service — a volume cannot be shared across two services, which is why backups run in-process rather than as a separate scheduled service.

---

## Former production path (retired 2026-08-23)

The sections below describe the previous production setup — a self-hosted Windows/Caddy machine on the home network. It has been decommissioned (`MirocardBackend2` scheduled task disabled, backend stopped) in favor of Railway above. Kept here for historical reference only; do not follow these steps for new deploys.

### Old Canonical Production

- Public URL: `https://mirocard.kaplieva.help/`
- Runtime host: Windows/Caddy machine reachable by Tailscale or LAN
- LAN check URL: `http://192.168.1.163:8080/`
- Remote app root: `C:/Users/dmazn/Projects/Mirocard2`
- Remote frontend root: `C:/Users/dmazn/Projects/Mirocard2/dist`
- Backend API on the runtime host: `127.0.0.1:3012`
- Caddy rule: `/api/*` reverse-proxies to `127.0.0.1:3012`

`mirocard.kaplieva.help` used to point to this Windows/Caddy runtime. The backend there is now stopped; the domain may still resolve to Caddy serving a stale static `dist/`, but `/api/*` returns 502.

### Old Required Agent Workflow

Before any production deploy, Codex and Claude Code both used this flow:

1. `git status --short`
2. Commit or stash all changes. Production is deployed only from a clean worktree.
3. Run the relevant tests/checks for the change.
4. Run `npm run build`.
5. Commit the deployed state and push it to `origin`.
6. Run `npm run deploy:prod`.
7. Verify both `https://mirocard.kaplieva.help/` and `http://192.168.1.163:8080/`.

The deploy script refuses a dirty worktree unconditionally. It pushes the current branch before uploading any production file, then checks the worktree again after the build. This prevents a deployment of files that do not exist in a recoverable commit on `origin`.

### Old Commands

```bash
npm run deploy:prod
npm run deploy:verify
```

`npm run deploy:prod` builds the app, writes a fresh `dist/version.json`, uploads the entire `dist/` directory plus the Caddy config to the Windows/Caddy runtime, then verifies the public and LAN URLs.

`npm run deploy:verify` does not upload. It checks the currently deployed runtime.

### Old Backend Deploy (was NOT covered by `npm run deploy:prod`)

`npm run deploy:prod` only uploaded `dist/` (frontend). It never touched `backend/`.

The remote `C:/Users/dmazn/Projects/Mirocard2` on the runtime host is **not a git repository** — it was a plain file copy. Backend source changes had to be copied manually via SFTP, then the process restarted:

```python
import os, paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.1.163', port=22, username='dmazn', password=os.environ['MIROCARD_DEPLOY_PASSWORD'], timeout=15)

sftp = client.open_sftp()
for f in ['server.mjs', 'lib/db.mjs', 'lib/account-repository.mjs', 'lib/mailer.mjs']:  # whichever changed
    sftp.put(f'C:/Users/dmazn/Projects/Mirocard2/backend/{f}', f'C:/Users/dmazn/Projects/Mirocard2/backend/{f}')
sftp.close()

# Kill whatever currently listens on 3012, then restart via the scheduled task
stdin, stdout, stderr = client.exec_command('netstat -ano | findstr :3012')
for line in stdout.read().decode().splitlines():
    if 'LISTENING' in line:
        pid = line.strip().split()[-1]
        client.exec_command(f'taskkill /PID {pid} /F')
time.sleep(2)
client.exec_command('schtasks /run /tn "MirocardBackend2"')
client.close()
```

The **`MirocardBackend2`** scheduled task (`Logon Mode: Interactive/Background`) is now **disabled** (not deleted) — re-enable with `schtasks /change /tn "MirocardBackend2" /enable` plus a manual restart if this host is ever needed again. `MirocardBackend` (`Logon Mode: Interactive only`) was never reliable for unattended restarts and should stay untouched.

Backend `.env` lives at `C:/Users/dmazn/Projects/Mirocard2/backend/.env` on the host (not in git). It held `ANTHROPIC_API_KEY` plus `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` (mail.kaplieva.help, shared with the Kaplieva project) and `APP_BASE_URL=https://mirocard.kaplieva.help`.

### Old Required Local Secrets

```bash
MIROCARD_DEPLOY_PASSWORD=...
```

Optional overrides:

```bash
MIROCARD_DEPLOY_HOSTS=100.72.91.115,192.168.1.163
MIROCARD_DEPLOY_USER=dmazn
MIROCARD_DEPLOY_PORT=22
MIROCARD_DEPLOY_KEY_PATH=C:/path/to/private/key
MIROCARD_REMOTE_ROOT=C:/Users/dmazn/Projects/Mirocard2
MIROCARD_PUBLIC_URL=https://mirocard.kaplieva.help
MIROCARD_LAN_URL=http://192.168.1.163:8080
```

### Old Deprecated Paths

These were already deprecated before the Railway migration:

- `node deploy.mjs`: compatibility wrapper only; delegated to `deploy-prod.mjs`.
- `node deploy-163.mjs`: compatibility wrapper only; delegated to `deploy-prod.mjs`.
- `scripts/deploy-to-hosting.py`: deprecated direct static deploy to shared hosting.
- `scripts/setup-hosting-proxy.py`, `scripts/fix-htaccess.py`: one-time hosting infrastructure scripts only, not app deploy scripts.

### Old Verification Contract

A successful production deploy on the old host meant:

- `https://mirocard.kaplieva.help/version.json` matched the deployed commit/build time.
- `http://192.168.1.163:8080/version.json` matched the same commit/build time.
- `https://mirocard.kaplieva.help/api/version` responded from the same runtime backend.
- `sw.js`, `index.html`, `manifest.json`, and app assets came from the same `dist/` build.
