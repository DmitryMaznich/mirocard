#!/usr/bin/env python3
"""Download listed PDF resources for local reference only."""
import json
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parent
out = root / "local"
out.mkdir(exist_ok=True)
sources = json.loads((root / "sources.json").read_text(encoding="utf-8"))["sources"]
for source in sources:
    if source.get("type") != "pdf" or not source.get("download"):
        continue
    dest = out / (source["id"] + ".pdf")
    try:
        request = urllib.request.Request(source["url"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            data = response.read(32 * 1024 * 1024)
        if not data.startswith(b"%PDF-"):
            raise ValueError("Not a PDF")
        dest.write_bytes(data)
        print("OK", dest.name)
    except Exception as exc:
        print("FAILED", source["id"], str(exc))
