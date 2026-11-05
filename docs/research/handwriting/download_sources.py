#!/usr/bin/env python3
"""Download PDF references from original publishers for local research only.

Generated files are stored in the ignored local/ tree and are not part of Git.
Check each source's terms before downloading or redistributing.
"""
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
PROFILES = ["slovenian", "zaner-bloser", "nelson-uk"]
LIMIT = 32 * 1024 * 1024

for profile in PROFILES:
    folder = ROOT / profile
    catalog = json.loads((folder / "sources.json").read_text(encoding="utf-8"))
    dest = folder / "local"
    dest.mkdir(parents=True, exist_ok=True)
    entries = catalog["sources"]
    report = []
    for item in entries:
        url = item.get("url")
        ident = item.get("id", "unknown")
        kind = item.get("format", item.get("type", ""))
        if kind != "pdf" or item.get("download") is False:
            continue
        name = ident + ".pdf"
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = response.read(LIMIT + 1)
            if len(payload) > LIMIT or not payload.startswith(b"%PDF-"):
                raise ValueError("Invalid PDF or too large")
            (dest / name).write_bytes(payload)
            status = {"id": ident, "status": "ok", "filename": name}
        except Exception as err:
            status = {"id": ident, "status": "failed", "message": str(err)}
        report.append(status)
        print(profile, ident, status["status"])
    (dest / "download-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
