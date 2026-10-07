#!/usr/bin/env python3
"""Shapes for the «Прописи 2» constructor's pictograms, taken from the topic's own data (not drawn by hand).

  python3 tools/propis2/build_icon_shapes.py

Writes src/features/propis2/iconShapes.json: the cursive «а» (narrow and wide row), the element «крючок» (to the right / to the
left) — each fitted into the 24x24 icon box: the glyph's lowercase band (y 10..62) onto [top, base], its own stretch (`s`, the
engine widens every glyph by 1.806 keeping the 65deg slant; an icon is better a little narrower), left of the ink at x = 0.
"""
import json, math, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
wide = {g["label"]: g for g in json.loads((ROOT / "tools/propis/wide.json").read_text())["glyphs"]}
elements = {e["id"]: e for e in json.loads((ROOT / "tools/propis/elements.json").read_text())["elements"]}
OUT = ROOT / "src/features/propis2/iconShapes.json"
T = math.tan(math.radians(25))


def points(d, s):
    toks = re.findall(r"[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    out, i = [], 0
    while i < len(toks):
        if toks[i] in "MLCQZ":
            out.append(toks[i]); i += 1; continue
        x, y = float(toks[i]), float(toks[i + 1]); i += 2
        out.append((s * x - (s - 1) * T * (62 - y), y))
    return out


def fit(strokes, top, base, s):
    k = (base - top) / 52.0
    pts = [p for st in strokes for p in points(st["d"], s) if isinstance(p, tuple)]
    mx = min(p[0] for p in pts)
    paths = [" ".join(p if isinstance(p, str) else f"{(p[0] - mx) * k:.2f} {top + (p[1] - 10) * k:.2f}" for p in points(st["d"], s)) for st in strokes]
    return {"d": paths, "w": round((max(p[0] for p in pts) - mx) * k, 2)}


shapes = {
    "a_narrow": fit(wide["а"]["strokes"], 8, 16, 1.5),
    "a_wide": fit(wide["а"]["strokes"], 6, 18, 1.35),
    "hook": fit(elements["06_kryuchok_vpravo"]["strokes"], 6, 18, 1.2),
    "hook_big": fit(elements["06_kryuchok_vpravo"]["strokes"], 6, 19, 1.3),
    "hook_l_big": fit(elements["05_kryuchok_vlevo"]["strokes"], 6, 19, 1.3),
}
OUT.write_text(json.dumps(shapes, ensure_ascii=False, indent=1) + "\n")
print(f"{len(shapes)} shapes -> {OUT}")
