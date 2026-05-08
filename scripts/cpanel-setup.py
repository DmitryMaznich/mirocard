"""
Creates mirocard.kaplieva.help subdomain and requests SSL via cPanel API.
"""
import urllib.request, urllib.parse, ssl, json, base64

HOST = "lcp-81.controlpanel.si:2083"
USER = "kaplie98"
PASS = "=Dmaz241078"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

auth = base64.b64encode(f"{USER}:{PASS}".encode()).decode()

def cpanel(func, module, **params):
    qs = urllib.parse.urlencode(params)
    url = f"https://{HOST}/execute/{module}/{func}?{qs}"
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            body = r.read()
            if not body:
                return {"error": "empty response", "status": r.status}
            try:
                return json.loads(body)
            except Exception:
                print(f"  Raw body ({len(body)}): {body[:500]}")
                raise
    except urllib.error.HTTPError as e:
        body = e.read()
        print(f"  HTTP {e.code}: {body[:300]}")
        return {"error": f"HTTP {e.code}"}


def main():
    # 1. List existing subdomains
    print("=== Existing subdomains ===")
    res = cpanel("list_subdomains", "SubDomain")
    for s in (res.get("data") or []):
        print(f"  {s.get('domain')} → {s.get('dir')}")

    # 2. Create mirocard subdomain
    print("\n=== Creating mirocard.kaplieva.help ===")
    res = cpanel("addsubdomain", "SubDomain",
                 domain="mirocard",
                 rootdomain="kaplieva.help",
                 dir="/public_html/mirocard",
                 disallowdot=0)
    print(json.dumps(res, indent=2))

    # 3. Request SSL certificate
    print("\n=== Requesting SSL cert ===")
    res = cpanel("ensure_domains_keys", "SSL",
                 domain="mirocard.kaplieva.help")
    print(json.dumps(res, indent=2))

    # 4. Install Let's Encrypt cert (AutoSSL)
    print("\n=== Running AutoSSL ===")
    res = cpanel("run_autossl_check", "SSL")
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
