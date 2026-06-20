import paramiko, io
from cryptography.hazmat.primitives.serialization import (
    load_ssh_private_key, Encoding, PrivateFormat, NoEncryption
)

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

FUNNEL = "https://laptop-353ltno0.taile45e98.ts.net"

def connect():
    pk = load_ssh_private_key(KEY, password=b"=Dmaz241078")
    pem = pk.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    pkey = paramiko.RSAKey.from_private_key(io.StringIO(pem.decode()))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("lcp-81.controlpanel.si", port=22, username="kaplie98", pkey=pkey, timeout=15)
    return c

def run(c, cmd):
    _, out, err = c.exec_command(cmd)
    out.channel.recv_exit_status()
    return out.read().decode(), err.read().decode()

c = connect()
sftp = c.open_sftp()

htaccess = (
    "Options -Indexes\n"
    "RewriteEngine On\n"
    "\n"
    "# Pass through PHP scripts directly\n"
    "RewriteRule ^(proxy\\.php|purge\\.php|test\\.php)$ - [L]\n"
    "\n"
    "# Route everything else through PHP proxy\n"
    "RewriteRule ^ proxy.php [L,QSA]\n"
)

with sftp.open("/home/kaplie98/public_html/mirocard/.htaccess", "w") as f:
    f.write(htaccess)
print(f"Updated .htaccess → routes via proxy.php to {FUNNEL}")

out, _ = run(c, "cat /home/kaplie98/public_html/mirocard/.htaccess")
print(out)

# Test curl from hosting to funnel via proxy.php
print("=== Curl from hosting (public URL) ===")
out, err = run(c, "curl -sI https://mirocard.kaplieva.help/manifest.json 2>&1")
print(out or err)

sftp.close()
c.close()
