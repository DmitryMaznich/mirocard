# Mirocard Backup And Restore

This procedure protects the project before Synology cloud/offsite backup is added.

## Layers

1. GitHub keeps tracked source code and tracked deck files.
2. A Synology SMB share keeps full recovery packages created by `scripts/backup-project.ps1`.
3. A later Synology Hyper Backup job should copy the backup share to offsite storage.

Do not use sync alone as backup. Synology Drive is useful, but snapshots or Hyper Backup are needed so accidental deletion and ransomware can be rolled back.

## One-Time Synology Setup

1. Create a shared folder, for example `MirocardBackups`.
2. Enable SMB access for the Windows user that runs backups.
3. If the volume uses Btrfs, enable snapshots for `MirocardBackups`.
4. Test the path from Windows:

```powershell
Test-Path \\SYNOLOGY\MirocardBackups
```

This machine already has a mapped Synology target named `SmartNAS`, and drive `Z:` points to `\\SmartNAS\home\Drive\!Документы`. Recommended backup root: `\\SmartNAS\home\Drive\!Документы\MirocardBackups`.

## Manual Backup

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-project.ps1 -BackupRoot "\\SmartNAS\home\Drive\!Документы\MirocardBackups"
```

For a local test only:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-project.ps1 -BackupRoot "C:\tmp\MirocardBackups" -NoPrune
```

The script writes one zip and one `.sha256` file. The zip contains:

- `git/*.bundle`: all git refs;
- `git/*.patch`: uncommitted tracked changes at backup time;
- `untracked-files/`: non-ignored untracked files;
- `ignored-assets/`: valuable ignored assets such as images, PDFs, docs, fonts, and audio;
- `db/mirocard-*.db`: consistent SQLite backup;
- `manifest.txt`: restore hints and git state.

Secrets are not included by default. Store these separately in a password manager:

- `.env`
- `backend/.env`
- GitHub, Synology, SSH, SMTP, Anthropic credentials

Use `-IncludeSecrets` only if the destination is encrypted and access-controlled.

## Recommended Schedule

Use Windows Task Scheduler on the development/runtime machine.

Daily project backup:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\dmazn\Projects\Mirocard2\scripts\backup-project.ps1" -BackupRoot "\\SmartNAS\home\Drive\!Документы\MirocardBackups"
```

Hourly database-only job:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\dmazn\Projects\Mirocard2\scripts\backup-db-hourly.ps1" -BackupRoot "\\SmartNAS\home\Drive\!Документы\MirocardBackups"
```

## Install Windows Scheduled Tasks

After confirming the Synology path is accessible from a normal PowerShell session, install both backup tasks:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-backup-tasks.ps1 -BackupRoot "\\SmartNAS\home\Drive\!Документы\MirocardBackups"
```

Use `-Force` to replace existing tasks.
## Production Runtime DB Backup

The production backend runs on `192.168.1.163` / `100.72.91.115`, not on the local Codex machine.

Runtime host setup now uses a two-step backup design:

1. Runtime host scheduled task `Mirocard Production DB Hourly Backup` runs hourly.
2. It writes consistent SQLite backups to:

```text
C:\Users\dmazn\MirocardBackups\hourly-db
```

3. Local full project backups call `scripts/fetch-production-db-backup.py` and include the latest production DB backup inside the final zip under:

```text
db/production/
```

This avoids needing Synology SMB credentials on the runtime host. The backend process is not stopped or restarted during backup.

To verify the runtime task over SSH:

```powershell
Get-ScheduledTaskInfo -TaskName "Mirocard Production DB Hourly Backup"
Get-ChildItem C:\Users\dmazn\MirocardBackups\hourly-db
```
## Restore From Full Backup

1. Copy the latest `mirocard-project-*.zip` from Synology to the new machine.
2. Verify checksum:

```powershell
Get-FileHash -Algorithm SHA256 .\mirocard-project-YYYYMMDD-HHMMSS.zip
Get-Content .\mirocard-project-YYYYMMDD-HHMMSS.zip.sha256
```

3. Extract the zip.
4. Restore git repository:

```powershell
git clone .\git\mirocard-YYYYMMDD-HHMMSS.bundle Mirocard2
cd Mirocard2
git remote set-url origin git@github.com:DmitryMaznich/mirocard.git
```

5. If needed, apply captured uncommitted changes:

```powershell
git apply ..\git\git-staged.patch
git apply ..\git\git-working-tree.patch
```

6. Copy `untracked-files/` and `ignored-assets/` back into the project if those files are needed.
7. Restore database:

```powershell
New-Item -ItemType Directory -Force runtime\data
Copy-Item ..\db\mirocard-YYYYMMDD-HHMMSS.db runtime\data\mirocard.db
```

8. Restore `.env` and `backend/.env` from the password manager.
9. Install and verify:

```powershell
npm install
npm run build
node backend\server.mjs
```

## Immediate Security Fix

The current git remote was observed with a GitHub token embedded in the URL. Revoke that token in GitHub and replace the remote with SSH or tokenless HTTPS:

```powershell
git remote set-url origin git@github.com:DmitryMaznich/mirocard.git
```
