"""Deprecated hosting/cPanel helper.

This script previously targeted the old shared-hosting deployment path and has
been disabled so repository tools do not carry embedded credentials. Production
now uses the canonical Windows/Caddy runtime. Use:

    npm run deploy:prod
    npm run deploy:verify

See DEPLOYMENT.md for the current workflow.
"""

raise SystemExit(
    "Deprecated helper disabled. Use `npm run deploy:prod` and DEPLOYMENT.md."
)
