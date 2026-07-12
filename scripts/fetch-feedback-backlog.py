#!/usr/bin/env python
"""Pull new feedback backlog entries and attachments from the runtime host.

Reads SSH connection settings from the local .env file (the same
MIROCARD_DEPLOY_* variables used by fetch-production-db-backup.py). Merges
remote inbox.jsonl entries into the local feedback/inbox.jsonl without
touching locally-edited entries (in particular, local `status` values).
"""

import argparse
import json
from pathlib import Path

import paramiko

REMOTE_FEEDBACK_ROOT = "C:/Users/dmazn/Projects/Mirocard2/feedback"
ATTACHMENT_FIELDS = ("photo", "voice")


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


def sftp_path(windows_path):
    return windows_path.replace("\\", "/")


def parse_jsonl(text):
    entries = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            entries.append(json.loads(line))
    return entries


def merge_backlog(remote_entries, local_entries):
    """Adds remote entries missing locally, without touching existing local entries.

    Returns (merged_entries, newly_added_entries), merged sorted by captured_at.
    """
    local_by_id = {entry["id"]: entry for entry in local_entries}
    newly_added = [entry for entry in remote_entries if entry["id"] not in local_by_id]
    merged = list(local_entries) + newly_added
    merged.sort(key=lambda entry: entry.get("captured_at", ""))
    return merged, newly_added


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    parser.add_argument("--out-dir", default="feedback")
    parser.add_argument("--remote-root", default=REMOTE_FEEDBACK_ROOT)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    local_inbox_path = out_dir / "inbox.jsonl"
    local_entries = (
        parse_jsonl(local_inbox_path.read_text(encoding="utf-8"))
        if local_inbox_path.exists() else []
    )

    env = load_env(args.env)
    client, host = connect(env)
    try:
        sftp = client.open_sftp()
        try:
            remote_inbox_path = sftp_path(f"{args.remote_root}/inbox.jsonl")
            with sftp.open(remote_inbox_path, "r") as f:
                remote_text = f.read().decode("utf-8")
            remote_entries = parse_jsonl(remote_text)

            merged, newly_added = merge_backlog(remote_entries, local_entries)

            for entry in newly_added:
                for field in ATTACHMENT_FIELDS:
                    relpath = entry.get(field)
                    if not relpath:
                        continue
                    local_path = out_dir / relpath
                    if local_path.exists():
                        continue
                    remote_path = sftp_path(f"{args.remote_root}/{relpath}")
                    local_path.parent.mkdir(parents=True, exist_ok=True)
                    sftp.get(remote_path, str(local_path))

            body = "\n".join(json.dumps(entry, ensure_ascii=False) for entry in merged)
            local_inbox_path.write_text(body + ("\n" if merged else ""), encoding="utf-8")
            print(f"Synced from {host}: {len(newly_added)} new entries, {len(merged)} total.")
        finally:
            sftp.close()
    finally:
        client.close()


if __name__ == "__main__":
    main()
