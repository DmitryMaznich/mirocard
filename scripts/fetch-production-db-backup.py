#!/usr/bin/env python
"""Download the latest production DB backup from the runtime host.

Reads SSH connection settings from the local .env file. This script does not
print or persist credentials. It downloads the latest DB file already created by
`Mirocard Production DB Hourly Backup` on the runtime host.
"""

import argparse
import json
import os
from pathlib import Path

import paramiko

REMOTE_BACKUP_ROOT = "C:/Users/dmazn/MirocardBackups/hourly-db"


def load_env(path):
    env = {}
    env_path = Path(path)
    if not env_path.exists():
        return env
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def connect(env):
    hosts = [h.strip() for h in env.get("MIROCARD_DEPLOY_HOSTS", "100.72.91.115").split(",") if h.strip()]
    user = env.get("MIROCARD_DEPLOY_USER", "dmazn")
    port = int(env.get("MIROCARD_DEPLOY_PORT", "22"))
    password = env.get("MIROCARD_DEPLOY_PASSWORD")
    key_path = env.get("MIROCARD_DEPLOY_KEY_PATH")
    if not password and not key_path:
        raise RuntimeError("No SSH credential found. Set MIROCARD_DEPLOY_PASSWORD or MIROCARD_DEPLOY_KEY_PATH.")

    last_error = None
    for host in hosts:
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            kwargs = {
                "hostname": host,
                "port": port,
                "username": user,
                "timeout": 15,
                "banner_timeout": 30,
            }
            if key_path:
                kwargs["key_filename"] = key_path
            else:
                kwargs["password"] = password
            client.connect(**kwargs)
            return client, host
        except Exception as exc:  # pragma: no cover - operational fallback
            last_error = exc
    raise last_error


def run_json(client, command):
    _stdin, stdout, stderr = client.exec_command(command)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", "replace").strip()
    err = stderr.read().decode("utf-8", "replace").strip()
    if code != 0:
        raise RuntimeError(err or out or f"Remote command failed with {code}")
    if not out:
        return None
    return json.loads(out)


def sftp_path(windows_path):
    return windows_path.replace("\\", "/")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--remote-root", default=REMOTE_BACKUP_ROOT)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    env = load_env(args.env)
    client, host = connect(env)
    try:
        ps = (
            "$root = '" + args.remote_root.replace("'", "''") + "'; "
            "Get-ChildItem -LiteralPath $root -File -Filter 'mirocard-db-*.db' "
            "| Sort-Object LastWriteTime -Descending "
            "| Select-Object -First 1 Name,FullName,Length,LastWriteTime "
            "| ConvertTo-Json -Compress"
        )
        latest = run_json(client, f"powershell -NoProfile -Command \"{ps}\"")
        if not latest:
            raise RuntimeError("No production DB backup files found on runtime host.")

        remote_db = latest["FullName"]
        remote_sha = remote_db + ".sha256"
        local_db = out_dir / latest["Name"]
        local_sha = out_dir / (latest["Name"] + ".sha256")

        sftp = client.open_sftp()
        try:
            sftp.get(sftp_path(remote_db), str(local_db))
            try:
                sftp.get(sftp_path(remote_sha), str(local_sha))
            except OSError:
                pass
        finally:
            sftp.close()

        metadata = {
            "sourceHost": host,
            "remotePath": remote_db,
            "downloadedFile": local_db.name,
            "bytes": local_db.stat().st_size,
        }
        (out_dir / "production-db-source.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        print(f"Downloaded production DB backup: {local_db} ({metadata['bytes']} bytes)")
    finally:
        client.close()


if __name__ == "__main__":
    main()
