# Mirocard2 Deployment

This repo has one production deployment path.

## Canonical Production

- Public URL: `https://mirocard.kaplieva.help/`
- Runtime host: Windows/Caddy machine reachable by Tailscale or LAN
- LAN check URL: `http://192.168.1.163:8080/`
- Remote app root: `C:/Users/dmazn/Projects/Mirocard2`
- Remote frontend root: `C:/Users/dmazn/Projects/Mirocard2/dist`
- Backend API on the runtime host: `127.0.0.1:3012`
- Caddy rule: `/api/*` reverse-proxies to `127.0.0.1:3012`

`mirocard.kaplieva.help` must point to the same Windows/Caddy runtime. It must not serve a separate static copy of the app from shared hosting, because that creates a second production version and breaks `/api`, service worker updates, and version checks.

## Required Agent Workflow

Before any production deploy, Codex and Claude Code must both use this flow:

1. `git status --short`
2. Commit or stash all unrelated changes.
3. Run the relevant tests/checks for the change.
4. Run `npm run build`.
5. Commit the deployed state.
6. Run `npm run deploy:prod`.
7. Verify both `https://mirocard.kaplieva.help/` and `http://192.168.1.163:8080/`.

The deploy script refuses a dirty worktree by default. For an emergency-only deploy, pass `--allow-dirty` and state that explicitly in the handoff.

## Commands

```bash
npm run deploy:prod
npm run deploy:verify
```

`npm run deploy:prod` builds the app, writes a fresh `dist/version.json`, uploads the entire `dist/` directory plus the Caddy config to the Windows/Caddy runtime, then verifies the public and LAN URLs.

`npm run deploy:verify` does not upload. It checks the currently deployed runtime.

## Backend Deploy (NOT covered by `npm run deploy:prod`)

`npm run deploy:prod` only uploads `dist/` (frontend). It never touches `backend/`.

The remote `C:/Users/dmazn/Projects/Mirocard2` on the runtime host is **not a git repository** — it's a plain file copy. Backend source changes must be copied manually via SFTP, then the process restarted:

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

Use the **`MirocardBackend2`** scheduled task to restart (`Logon Mode: Interactive/Background`) — not `MirocardBackend` (`Logon Mode: Interactive only`, silently fails to spawn a visible process over a non-interactive SSH session and gets stuck in `Status: Running` forever). Both tasks exist on the host; only `MirocardBackend2` is reliable for unattended restarts.

After restart, verify the new code actually loaded — `/api/version` only reflects `dist/version.json` (frontend build info), not the backend git SHA, so it will report success even if the backend process is still running stale code. Confirm by hitting an endpoint whose behavior changed.

Backend `.env` lives at `C:/Users/dmazn/Projects/Mirocard2/backend/.env` on the host (not in git). It currently holds `ANTHROPIC_API_KEY` plus `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` (mail.kaplieva.help, shared with the Kaplieva project) and `APP_BASE_URL=https://mirocard.kaplieva.help`.

## Required Local Secrets

Set these outside git, for example in the agent environment:

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
MIROCARD_DEPLOY_ALLOW_DIRTY=1
```

Use either `MIROCARD_DEPLOY_PASSWORD` or `MIROCARD_DEPLOY_KEY_PATH`.

## Deprecated Paths

Do not use these for production:

- `node deploy.mjs`: compatibility wrapper only; delegates to `deploy-prod.mjs`.
- `node deploy-163.mjs`: compatibility wrapper only; delegates to `deploy-prod.mjs`.
- `scripts/deploy-to-hosting.py`: deprecated direct static deploy to shared hosting.
- `scripts/setup-hosting-proxy.py`, `scripts/fix-htaccess.py`: one-time hosting infrastructure scripts only, not app deploy scripts.

## Verification Contract

A successful production deploy means:

- `https://mirocard.kaplieva.help/version.json` matches the deployed commit/build time.
- `http://192.168.1.163:8080/version.json` matches the same commit/build time.
- `https://mirocard.kaplieva.help/api/version` responds from the same runtime backend.
- `sw.js`, `index.html`, `manifest.json`, and app assets come from the same `dist/` build.

If any of these disagree, stop and fix routing/deploy configuration before shipping more changes.
