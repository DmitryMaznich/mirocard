#!/usr/bin/env python3
"""Static localization inventory. Counts are audit signals, not translation units.

Normal checkout: python3 scripts/audit-localization.py --revision <commit>
--tree accepts a GitHub recursive-tree JSON snapshot for a verified source mirror.
Only Python's standard library is required. No network or application startup.
"""
import argparse
import csv
import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CYR = re.compile(r"[А-Яа-яЁё]")
SIGNALS = {
    "speech": re.compile(r"SpeechSynthesisUtterance|speechSynthesis|useSpeech|playTopicFile|playSequence|\.speak\("),
    "locale": re.compile(r"ru-RU|sl-SI|en-US|uiLanguage|cardLanguage|primaryLanguage|toLocale\w+|Intl\."),
    "audio": re.compile(r"\.mp3|\.wav|audio[/.:]|new Audio\("),
    "print": re.compile(r"window\.print|application/pdf|jsPDF|<html|lang="),
}


def selected(path):
    return bool(
        (re.match(r"src/.*\.(?:js|jsx|json)$", path) and not re.search(r"\.(test|spec)\.", path))
        or re.match(r"backend/(?:lib/.*\.mjs|server\.mjs|generated/.*\.json|legal/.*\.html)$", path)
        or re.match(r"(?:shared/.*\.mjs|index\.html|package\.json|public/(?:sw\.js|manifest\.json|.*topic\.json|decks/catalog\.json)|tools/[^/]+/topic\.json|content/topics/.*\.json)$", path)
        or re.match(r"scripts/(?:build-topic-inventory|build-audio-review-manifest|entitlement-reminder-loop|generate-.*audio|generate-letter-sounds)\.mjs$", path)
    )


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def balanced(text, start, opening="[", closing="]"):
    """Read a JS array/object, ignoring quoted strings and comments."""
    depth, i, quote = 0, start, None
    while i < len(text):
        c = text[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif text.startswith("//", i):
            end = text.find("\n", i)
            i = len(text) if end < 0 else end
            continue
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = len(text) if end < 0 else end + 2
            continue
        elif c == opening:
            depth += 1
        elif c == closing:
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
        i += 1
    raise ValueError("Unbalanced static metadata")


def static_modes(text):
    match = re.search(r"\bmodes\s*:\s*\[", text)
    if not match:
        return []
    array = balanced(text, text.index("[", match.start()))
    rows, pos = [], 1
    while pos < len(array) - 1:
        if array[pos] != "{":
            pos += 1
            continue
        obj = balanced(array, pos, "{", "}")
        values = {}
        for key in ("id", "type"):
            m = re.search(r"\b" + key + r"\s*:\s*[\"']([^\"']+)", obj)
            values[key] = m.group(1) if m else ""
        if values["id"]:
            rows.append(values)
        pos += len(obj)
    return rows


def write_csv(out, name, fields, rows):
    with (out / name).open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fields, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default="HEAD")
    parser.add_argument("--tree", type=Path)
    parser.add_argument("--out", type=Path, default=ROOT / "docs/localization/inventory")
    args = parser.parse_args()
    if args.tree:
        snapshot = json.loads(args.tree.read_text())
        entries = snapshot["tree"]
        revision = snapshot["commit"]
        if args.revision not in ("HEAD", revision):
            raise ValueError("Snapshot revision mismatch")
    else:
        revision = git("rev-parse", args.revision).decode().strip()
        entries = []
        for row in git("ls-tree", "-rlz", revision).split(b"\0"):
            if not row:
                continue
            meta, path = row.split(b"\t", 1)
            mode, kind, sha, size = meta.decode().split()
            if kind == "blob":
                entries.append({"path": path.decode(), "sha": sha, "size": int(size)})
    sources = {}
    for entry in entries:
        path = entry["path"]
        if not selected(path):
            continue
        data = (ROOT / path).read_bytes() if args.tree else git("show", f"{revision}:{path}")
        digest = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if digest != entry["sha"]:
            raise ValueError(f"Source hash mismatch: {path}")
        sources[path] = data.decode("utf-8")
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    files, signals, modes = [], [], []
    for path, text in sorted(sources.items()):
        lines = text.splitlines()
        files.append({"path": path, "lines": len(lines), "cyrillic_lines": sum(bool(CYR.search(l)) for l in lines),
                      **{key + "_lines": sum(bool(pattern.search(l)) for l in lines) for key, pattern in SIGNALS.items()}})
        for number, line in enumerate(lines, 1):
            tags = (["cyrillic"] if CYR.search(line) else []) + [key for key, pat in SIGNALS.items() if pat.search(line)]
            if tags:
                signals.append({"path": path, "line": number, "signals": ";".join(tags), "excerpt": line.strip()[:400], "review": "unreviewed"})
        if path.endswith("topic.json"):
            data = json.loads(text)
            topic_id = (data.get("meta") or {}).get("id", data.get("id", ""))
            for mode in data.get("modes", []):
                if not isinstance(mode, dict):
                    continue
                modes.append({"topic_id": topic_id, "mode_id": mode.get("id", ""), "type": mode.get("type", ""), "source": path,
                              "title": json.dumps(mode.get("ui", {}).get("title", mode.get("title", mode.get("name", ""))), ensure_ascii=False), "provenance": "source_manifest", "sl_ready": "unverified"})
        elif path.startswith("src/topics/builtin"):
            id_match = re.search(r"\bid\s*:\s*[\"']([^\"']+)", text)
            for mode in static_modes(text):
                modes.append({"topic_id": id_match.group(1) if id_match else "", "mode_id": mode["id"], "type": mode["type"], "source": path,
                              "provenance": "static_builtin", "sl_ready": "unverified"})
    catalog = json.loads(sources["public/decks/catalog.json"])["decks"]
    inventory = json.loads(sources["backend/generated/topic-inventory.json"])["topics"]
    topics = []
    for topic in inventory:
        bundle, cat = topic.get("bundle") or {}, topic.get("catalogEntry") or {}
        declared = sorted({str(m["mode_id"]) for m in modes if m["topic_id"] == topic["id"]})
        topics.append({"topic_id": topic["id"], "title": topic.get("title", ""), "renderer": topic.get("renderer") or bundle.get("renderer", ""),
                       "version": topic.get("version", ""), "status": cat.get("status", "builtin" if topic.get("builtin") else "uncatalogued"),
                       "builtin": topic.get("builtin", False), "bundle_modes": bundle.get("modes", ""), "bundle_cards": bundle.get("cards", ""),
                       "known_source_mode_ids": ";".join(declared), "mode_audit": "source_manifest_only" if declared else "requires_package_inspection",
                       "catalog_title_languages": ";".join(sorted(cat.get("title", {}))) if isinstance(cat.get("title"), dict) else "",
                       "sources": ";".join(topic.get("sources", [])), "sl_ready": "unverified"})
    app = sources["src/App.jsx"]
    screen_block = re.search(r"const SCREENS\s*=\s*\{(.*?)\n\};", app, re.S)
    if not screen_block:
        raise ValueError("Screen registry not found")
    imports = dict(re.findall(r'import\s+(\w+)\s+from\s+"([^"]+)"', app))
    routes = [{"route": route, "component": component, "source": imports.get(component, "src/App.jsx (local wrapper)"), "state_audit": "see ../screen-states.md"}
              for route, component in re.findall(r"^\s*(\w+):\s*(\w+)\s*,?", screen_block.group(1), re.M)]
    assets = [{"path": e["path"], "bytes": e["size"], "sha": e["sha"], "scope": "tracked_loose_asset"}
              for e in entries if re.search(r"\.(mp3|wav|ogg|m4a|pdf|woff2?|ttf)$", e["path"], re.I)]
    write_csv(out, "source-files.csv", ["path", "lines", "cyrillic_lines", "speech_lines", "locale_lines", "audio_lines", "print_lines"], files)
    write_csv(out, "source-signals.csv", ["path", "line", "signals", "excerpt", "review"], signals)
    write_csv(out, "topics.csv", list(topics[0]), topics)
    write_csv(out, "modes.csv", ["topic_id", "mode_id", "type", "source", "title", "provenance", "sl_ready"], modes)
    write_csv(out, "screens.csv", ["route", "component", "source", "state_audit"], routes)
    write_csv(out, "loose-assets.csv", ["path", "bytes", "sha", "scope"], sorted(assets, key=lambda e: e["path"]))
    summary = {"revision": revision, "source_files": len(files), "cyrillic_lines": sum(f["cyrillic_lines"] for f in files), "signal_rows": len(signals),
               "screen_routes": len(routes), "inventory_topics": len(topics), "catalog_entries": len(catalog), "source_mode_records": len(modes),
               "topics_with_source_modes": len({m["topic_id"] for m in modes}), "loose_assets": len(assets),
               "topic_statuses": dict(sorted(Counter(t["status"] for t in topics).items())),
               "limits": ["Signals include comments and data; they are not unique translation units.", "ZIP contents, generated audio and PDF text were not decoded.",
                          "Mode records can repeat across source manifests; zero bundle modes does not mean zero runnable modes.", "No runtime, device, linguistic or methodology acceptance implied."]}
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run()
