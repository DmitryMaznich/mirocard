#!/usr/bin/env python3
"""Kazakh letters built from the Russian bank's strokes, by the owner's recipes (2026-10-30).

  python3 tools/propis2/variants/kk/build_glyphs.py [--preview out.html]

Bank geometry (tools/propis/wide.json): baseline y=62, top of the lowercase (the narrow row's upper line) y=10,
capitals up to y=-42, 65deg slant. Each recipe names the source letter's strokes (1-based, as on the stroke
catalog sheet) and adds the new strokes; the result goes to variant.json -> glyphs (TODO once the first letters are approved).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BANK = {g["label"]: g for g in json.loads((ROOT / "tools/propis/wide.json").read_text())["glyphs"]}
X_TOP, BASE = 10.0, 62.0


def stem_x(d, y):
    """x where the first straight segment (M .. L ..) of a path crosses height y."""
    (x0, y0), (x1, y1) = [tuple(map(float, p)) for p in re.findall(r"(-?[\d.]+) (-?[\d.]+)", d)[:2]]
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


def bar(cx, y, half=14.0, bend=2.5):
    """Crossbar left to right: the left end dips by `bend`, the right end turns up by the same amount."""
    l, r = cx - half, cx + half
    return {"d": f"M {l:.2f} {y + bend:.2f} C {l + 3:.2f} {y:.2f} {l + 6:.2f} {y:.2f} {l + 9:.2f} {y:.2f} "
                 f"L {r - 9:.2f} {y:.2f} C {r - 6:.2f} {y:.2f} {r - 3:.2f} {y:.2f} {r:.2f} {y - bend:.2f}"}


def g_bar():
    """Ғ: Г strokes 1 and 2, then a crossbar through the middle of the stem on the narrow row's upper line.
    Г's stroke 3 is its tailStroke (drawn only when a letter follows), kept so Ғ joins like Г."""
    g = BANK["Г"]; s = g["strokes"]
    out = dict(g, label="Ғ", strokes=[s[0], s[1], bar(stem_x(s[0]["d"], X_TOP), X_TOP), s[2]], tailStroke=3,
               sourceLabel="Ғ = Г (штрихи 1, 2) + перекладина на верхней линии узкой строки; соединение — штрих 3 Г")
    return out


RECIPES = [g_bar]


def preview(glyphs, path):
    cells = ""
    for g in glyphs:
        paths = "".join(f'<path d="{s["d"]}" fill="none" stroke="{c}" stroke-width="2.6" stroke-linecap="round"/>'
                        for s, c in zip(g["strokes"], ["#d62728", "#1f77b4", "#2ca02c", "#bbb", "#9467bd"]))
        cells += (f'<div style="display:inline-block;margin:10px;text-align:center"><svg viewBox="100 -55 130 135" width="260" height="270">'
                  f'<line x1="100" x2="230" y1="{BASE}" y2="{BASE}" stroke="#e88"/><line x1="100" x2="230" y1="{X_TOP}" y2="{X_TOP}" stroke="#99e"/>'
                  f'<line x1="100" x2="230" y1="-42" y2="-42" stroke="#99e"/>{paths}</svg><br>{g["label"]}</div>')
    Path(path).write_text(f"<html><body style='font:20px sans-serif'>{cells}</body></html>")


if __name__ == "__main__":
    built = [r() for r in RECIPES]
    if "--preview" in sys.argv: preview(built, sys.argv[sys.argv.index("--preview") + 1])
    else: print(json.dumps(built, ensure_ascii=False, indent=1))
