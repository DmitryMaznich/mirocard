import os
import paramiko

password = os.environ.get("MIROCARD_DEPLOY_PASSWORD")
if not password:
    raise SystemExit("Set MIROCARD_DEPLOY_PASSWORD before running this helper.")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.163", port=22, username="dmazn", password=password, timeout=10)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    out.channel.recv_exit_status()
    return out.read().decode(), err.read().decode()

print("=== Tailscale status on 192.168.1.163 ===")
out, err = run("tailscale status 2>&1")
print(out or err)

print("\n=== Tailscale Funnel status ===")
out, err = run("tailscale funnel status 2>&1")
print(out or err)

print("\n=== Port 8080 process ===")
out, err = run("netstat -an | findstr :8080 2>&1")
print(out or err)

print("\n=== Backend running? ===")
out, err = run("netstat -an | findstr :3012 2>&1")
print(out or err)

c.close()
