#!/usr/bin/env python3
"""Review sheet for the traced British letters: per letter the Nelson underlay, the hand's path (grey) and the tidied letter (blue),
on the capture tool's lines.

  python3 tools/latin_letters/tidy_capture.py --tool <captures.json>... > /tmp/tidy-tool.json
  python3 tools/latin_letters/review_capture.py /tmp/tidy-tool.json <out.html> <captures.json>... [--page page.svg]

The underlays are read from tools/latin_letters/underlays/british (lo_<a>.png): 1600x1200 px = 200x150 tool units, put at x = 100 as the
tool puts them, then moved sideways onto the hand's ink (the owner moves the underlay in the tool while tracing). `--page`: an SVG of a page laid out by the engine, shown under the letters.
"""
import base64
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

UNDER = Path(__file__).resolve().parent / "underlays" / "british"


def main():
    args = sys.argv[1:]
    page = None
    if "--page" in args:
        k = args.index("--page"); page = Path(args[k + 1]).read_text(encoding="utf-8"); del args[k:k + 2]
    tidy = {g["label"]: g for g in json.load(open(args[0], encoding="utf-8"))["glyphs"]}
    caps = {}
    for f in args[2:]:
        for c in json.load(open(f, encoding="utf-8")): caps[c["label"]] = c
    cells = []
    for l in sorted(caps, key=lambda c: (c.lower(), c)):
        c = caps[l]
        xs = [float(v) for s in c["strokes"] for v in re.findall(r"-?\d+\.?\d*", s["d"])[0::2]]
        x0 = min(xs) - 8
        vw = max(56, max(xs) - min(xs) + 16)  # wide letters (W, M) get a wider cell
        pre = "lo" if l.islower() else "up" if l.isalpha() else "num"
        png = UNDER / f"{pre}_{l}.png"
        under = ""
        if png.exists():
            # the underlay was moved sideways in the tool while tracing: put its ink's left edge where the hand's is
            alpha = np.array(Image.open(png))[:, :, 3]
            ux = 100 + np.nonzero(alpha.max(0) > 128)[0][0] / 8 + 1.92  # + half the stroke: the hand traces its middle
            # onto the tidied letter's leftmost ink (its stem), not the hand's: the hand wavers about the stem it traced
            tx = [float(v) for st in tidy[l]["strokes"] for v in re.findall(r"-?\d+\.?\d*", st["d"])[0::2]]
            dx = min(tx) - ux
            under = f'<image href="data:image/png;base64,{base64.b64encode(png.read_bytes()).decode()}" x="{100 + dx:.2f}" y="0" width="200" height="150" opacity="0.45" filter="url(#tint)"/>'
        lines = "".join(f'<line x1="{x0}" x2="{x0 + vw}" y1="{y}" y2="{y}" stroke="{col}" stroke-width="{w}"/>'
                        for y, col, w in ((36, "#cbd5e1", .2), (62, "#94a3b8", .25), (88, "#334155", .35), (110, "#cbd5e1", .2)))
        raw = "".join(f'<path d="{s["d"]}" stroke="#9ca3af" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.7"/>' for s in c["strokes"])
        neat = "".join(f'<path d="{s["d"]}" stroke="#1d4ed8" stroke-width="0.7" fill="none" stroke-linecap="round"/>' for s in tidy[l]["strokes"])
        cells.append(f'<figure><svg viewBox="{x0} 30 {vw} 86" width="{210 * vw / 56:.0f}" height="322"><defs><filter id="tint"><feColorMatrix type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.6  0 0 0 0 0.2  0 0 0 1 0"/></filter></defs>{under}{lines}{raw}{neat}</svg><figcaption>{l}</figcaption></figure>')
    html = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Британские буквы: обводка и выравнивание</title>'
            '<style>body{font:14px/1.45 system-ui,sans-serif;margin:12px;color:#1e293b}figure{display:inline-block;margin:4px;text-align:center}'
            'svg{background:#fff;border:1px solid #e2e8f0}figcaption{font-size:18px}.page svg{width:100%;max-width:720px;height:auto;border:0}.propis-paper{fill:#fffdf6}</style>'
            '<h1>Британские буквы: обводка и выравнивание</h1>'
            '<p>Бледно-оранжевое — подложка Нельсона, серое — путь руки в мастерской, синее — буква после выравнивания '
            '(<code>tools/latin_letters/tidy_capture.py</code>). Линии мастерской: 36, линия строчных 62, строка 88, 110.</p>'
            + "".join(cells)
            + (f'<h2>На странице прописей (линовка Нельсона)</h2><div class="page">{page}</div>' if page else ""))
    Path(args[1]).write_text(html, encoding="utf-8")
    print(f"{len(cells)} letters -> {args[1]}")


if __name__ == "__main__":
    main()
