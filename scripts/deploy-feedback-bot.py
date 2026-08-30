#!/usr/bin/env python
"""Deploy feedback-bot/*.py to the runtime host and restart MirocardFeedbackBot.

Mirrors the manual backend-deploy pattern documented in DEPLOYMENT.md: upload
via SFTP, then restart via the scheduled task — never edit files directly on
the host.
"""

import argparse
from pathlib import Path

import paramiko

REMOTE_BOT_ROOT = "C:/Users/dmazn/Projects/Mirocard2/feedback-bot"
LOCAL_BOT_DIR = Path(__file__).resolve().parent.parent / "feedback-bot"
DEPLOYED_FILES = [
    "mirocard_feedback_bot.py",
    "message_cache.py",
    "backlog.py",
    "formatting.py",
    "env_helpers.py",
    "google_photos.py",
    "video_ingest.py",
    "authorize_google_photos.py",
    "requirements.txt",
]


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


def build_upload_file_list(local_dir: Path, filenames):
    """Pairs each filename with its local and remote (posix) path.

    Raises FileNotFoundError if a file is missing locally.
    """
    pairs = []
    for name in filenames:
        local_path = local_dir / name
        if not local_path.exists():
            raise FileNotFoundError(f"Missing local file: {local_path}")
        pairs.append((str(local_path), f"{REMOTE_BOT_ROOT}/{name}"))
    return pairs


def restart_bot_task(client):
    _stdin, stdout, _stderr = client.exec_command(
        'wmic process where "CommandLine like \'%mirocard_feedback_bot.py%\'" get ProcessId'
    )
    stdout.channel.recv_exit_status()
    for line in stdout.read().decode().splitlines():
        pid = line.strip()
        if pid.isdigit():
            client.exec_command(f"taskkill /PID {pid} /F")
    client.exec_command('schtasks /run /tn "MirocardFeedbackBot"')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pairs = build_upload_file_list(LOCAL_BOT_DIR, DEPLOYED_FILES)

    if args.dry_run:
        for local_path, remote_path in pairs:
            print(f"{local_path} -> {remote_path}")
        return

    env = load_env(args.env)
    client, host = connect(env)
    try:
        sftp = client.open_sftp()
        try:
            client.exec_command(f'mkdir "{REMOTE_BOT_ROOT}"')
            for local_path, remote_path in pairs:
                sftp.put(local_path, remote_path)
                print(f"Uploaded {local_path} -> {remote_path}")
        finally:
            sftp.close()
        restart_bot_task(client)
        print(f"Deployed to {host} and restarted MirocardFeedbackBot.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
