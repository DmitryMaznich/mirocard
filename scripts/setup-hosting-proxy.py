"""
Sets up mirocard.kaplieva.help on shared hosting as a reverse proxy
to the Tailscale Funnel (https://mazpc.taile45e98.ts.net).
"""
import paramiko, io
from cryptography.hazmat.primitives.serialization import (
    load_ssh_private_key, Encoding, PrivateFormat, NoEncryption
)

FUNNEL_URL = "https://mazpc.taile45e98.ts.net"

KEY = b"""-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABDE6BhJOY
VXjJoV9k0Yk4kGAAAAEAAAAAEAAAEXAAAAB3NzaC1yc2EAAAADAQABAAABAQDTlA7fIvbg
x5Ikj44uKdBfwrYuMHfM6a2zVnL/QXowvoajdfOYkBzmIMdqXMXyAovxwD6ii23zq3clVG
DqEIw2tTF/ZLCaE99tXMMZsZkDmi1T/0X2ID/cfJGi3zsd1FVYjDvIjuYRQTLtjItXctKA
Mez7SG64aixU4oIg9H7Uv+s2XXWR1m7FEJSH5w2L0MrjpNGo19Z0lzqYiKc8mhEjjjfLrF
ogYqagci3IPJWcOGcKRD8A0yFKmr0P3Q6mnWl/xXoukkfe3jkLTqtWb1M6RdjE9ZYJKdr9
tplbQVw+L310cmdxbyyzZJYLbHglAxcm1E5VfurOdhj8vh5UohKdAAADwGjlffJ1/qbNjs
kmJxmBNizSth1ui0Ze2ahudpO/jWzdK+WElaPn0ma9wa82sxJ3Ix/Tyo4N7g/SJlmPAPpr
sXPYXm7i6b35J8nJRJidmQqDlZDsvEJi6e/9LooWmureq/Sd1EK4tFZ3bxP2R5fuvgzKj5
+9TuoZivBQ1u3z9shsf1qn/RAa8bEZ1Ijn8wQtks/p4QrTQUCRkXEt6goQ6iD/vqAVUiUV
7prbOiCnqEzrClCnPfFYJmei+TyxqikQ+PJuTK3ZSblMshzpC1sUm21CBztFNoTO44mZ8k
V9VQfBeK4csBb7UzuU586MA++kIUTLQai71v8eBqXa//5ueQMCiP0c3lmDfZHi01RI2D/5
VwcuD3oywb1nCV/hmxwGE+xYbVOt2zn/mA/y7OHmm7qfVvfRUBztDuZ73lndWoUw2XrSwX
YdlDTLmujvpdWIxRLGtnQW8k+0vb/BFxeZ7f/3ZA0TLD8/uIMZ5DZKABdfNv9VvyJhGrJE
ASwcHJFmAHFmZcTc36VjMd9MIsQ2DrsdES2S9jjuHhlcZZt0UDulzCTuC0xmQQ4lVI4AOi
fvf4SidB9drQGeRdiYIOxiGAlhEOM8Y4+kd4XNbGqBDVOtDhUjNC2zZuLwl+rlbkuvmbpS
nu7HR2mNk3NKJc2GzMAG5TMsDQdjFcdHGjJv2Th1LpnD8x+RjFjHnaUzhhEz+385KxQeTC
VnFsnGR1CiZJzTUkb8Mq6n/TWrNatovOqb8ilLtnLur0FJc8kOKdYLnHmNDiQOvkilq4Cg
qELV9MwN07eAjlA5UgC+fTb/xGFTW7vXXTZzkR9Nry7gE2JChthdNeKv3s8tQ+nfk8POkt
tYlctd8RDtEVfqD2MEHGjrHvEzPlUiWkjPhdKt9BMRlhGS4Vlg7S8U8rUElzBJW29DPuvl
nDNtu3hvcABRm2Qx3hHfpVmnGhLPsvOrRRCD0CSPSoHX/VAi1Px5wn0YC77A4lwLkU88ud
YfNlQY3ZIUGechm7Y6n4VPKa5cQXRqToLJJpt4OGJpTp2aoQhlnWjuokTgb7QASzo6kFCx
akIfuLN+FEGjdfrMQilgPHQgAIqxfczZyuLwFVSht0tmgVBH4e5ebuQ9UUH0NyEn8cCoIV
bxqgiyBXm7v3cm9lQNkVrvaWpil9bC7i4roFdLgA+7KP30yN7zLABq6DpWeGvaJHjGSy5R
XXPOCw5nvoU/D0ADI093Fsrmyt9GXnPfpW3fvsO83Z+reWORXdkTq53p4jyMKvFfFZxpGK
p0ssWTnA==
-----END OPENSSH PRIVATE KEY-----"""


def connect():
    pk = load_ssh_private_key(KEY, password=b"=Dmaz241078")
    pem = pk.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    pkey = paramiko.RSAKey.from_private_key(io.StringIO(pem.decode()))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("lcp-81.controlpanel.si", port=22, username="kaplie98", pkey=pkey, timeout=15)
    return c


def run(client, cmd):
    _, out, err = client.exec_command(cmd)
    rc = out.channel.recv_exit_status()
    return out.read().decode(), err.read().decode(), rc


def sftp_write(sftp, path, content):
    with sftp.open(path, "w") as f:
        f.write(content)


def main():
    print("Connecting to hosting...")
    c = connect()
    sftp = c.open_sftp()
    print("Connected.")

    subdir = "/home/kaplie98/public_html/mirocard"
    out, err, rc = run(c, f"mkdir -p {subdir}")
    print(f"mkdir: rc={rc}")

    # Check what Apache modules are loaded
    out, err, rc = run(c, "php -r \"phpinfo();\" 2>/dev/null | head -5")
    print(f"PHP: {out[:100]}")

    # Check if mod_proxy is in loaded modules via PHP
    out, err, rc = run(c, "php -r \"echo json_encode(apache_get_modules());\" 2>/dev/null")
    if out:
        import json
        try:
            mods = json.loads(out)
            has_proxy = "mod_proxy" in mods or "mod_proxy_http" in mods
            print(f"mod_proxy available: {has_proxy}")
            print(f"Relevant modules: {[m for m in mods if 'proxy' in m or 'rewrite' in m]}")
        except Exception:
            print(f"Modules raw: {out[:300]}")
    else:
        print(f"apache_get_modules error: {err[:100]}")

    # Write .htaccess with proxy + redirect fallback
    htaccess = (
        "Options -Indexes\n"
        "RewriteEngine On\n"
        "\n"
        "<IfModule mod_proxy.c>\n"
        "    ProxyRequests Off\n"
        "    ProxyPreserveHost Off\n"
        f"    ProxyPass / {FUNNEL_URL}/\n"
        f"    ProxyPassReverse / {FUNNEL_URL}/\n"
        "</IfModule>\n"
        "\n"
        "<IfModule !mod_proxy.c>\n"
        f"    RewriteRule ^(.*)$ {FUNNEL_URL}/$1 [R=302,L]\n"
        "</IfModule>\n"
    )
    sftp_write(sftp, f"{subdir}/.htaccess", htaccess)
    print("Wrote .htaccess")

    # Verify
    out, err, rc = run(c, f"cat {subdir}/.htaccess")
    print(f".htaccess content:\n{out}")

    sftp.close()
    c.close()
    print("\nDone. Next: create subdomain in cPanel → mirocard.kaplieva.help → ~/public_html/mirocard")


if __name__ == "__main__":
    main()
