#!/usr/bin/env python3
"""Underlays for tracing the British (Nelson) letters by hand in the handwriting capture tool (tools/letter_capture), one PNG per sign.

  python3 tools/latin_letters/make_underlays.py <nelson-ready-reference.pdf | page-1.png at 600 dpi> <out dir>

Source: Nelson Handwriting Ready Reference Guide, page 1 (docs/research/handwriting/nelson-uk; the PDF itself is not in the repo).
Rows taken from it: «The lower-case alphabet for Books 1 to 6» (a-z), «The capital letters and numerals» (A-Z, 1-0).
Measured on the page at 600 dpi (docs/mockups/latin-letters/british-vs-nelson.html): stroke 6.5 px, x-height 44 px between stroke
centres, ascenders and descenders 0.86 of it, capitals as tall as the ascenders.

Geometry of the tool, as in tools/propis2/variants/{bg,kk}/make_underlays.py: 150 units tall, 8 px per unit; baseline y=88, x-line
y=62 (x-height 26 units). Every sign is scaled by the same factor (26 units per Nelson x-height), so the page's own proportions are
kept: ascenders and capitals reach y=39.6 (the tool's mid line 36 is just above), descenders y=110.4 (on the tool's mid line 110).
The ink starts at x=12. The letters are upright: the tool's 65deg slant grid is not theirs (turn off the arc guides and the arc
snapping when tracing). The British proportions of the pupil books (ascenders 0.74, descenders 0.72) are applied when the traced
letters are built, as for the drawn ones (tools/handwriting/latin/build-print.mjs --style british) -- not here.
Files: lo_<a>.png, up_<A>.png, num_<1>.png (case-proof on Windows).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PX = 8
H_UNITS, W_UNITS = 150, 200
LEFT = 12.0
BASE, X_TOP = 88.0, 62.0
HALF = 3.25   # half the stroke on the page, px
X_PAGE = 44.0  # x-height on the page between stroke centres, px

# (rows of the page to search, baseline at the stroke centre, signs left to right, file prefix)
ROWS = [
    ((1270, 1440), 1379, "abcdefghijklmnopqrstuvwxyz", "lo"),
    ((2380, 2510), 2488, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "up"),
    ((2550, 2680), 2655, "1234567890", "num"),
]


def page_image(src):
    if src.lower().endswith(".pdf"):
        tmp = Path(tempfile.mkdtemp())
        subprocess.run(["pdftoppm", "-r", "600", "-f", "1", "-l", "1", "-gray", "-png", src, str(tmp / "p")], check=True)
        src = str(next(tmp.glob("p-*.png")))
    im = Image.open(src).convert("L")
    if im.size != (4961, 7016):
        sys.exit(f"expected page 1 at 600 dpi (4961x7016), got {im.size}")
    return im


def main():
    page = page_image(sys.argv[1])
    ink_all = np.clip((200 - np.array(page).astype(float)) / 120, 0, 1)
    out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    k = (BASE - X_TOP) / X_PAGE * PX  # output px per page px
    n = 0
    for (a, b), base, signs, prefix in ROWS:
        band = ink_all[a:b]
        cols = (band > 0.5).any(0)
        segs, start = [], None
        for x, v in enumerate(cols):
            if v and start is None: start = x
            if not v and start is not None: segs.append((start, x)); start = None
        if len(segs) != len(signs):
            sys.exit(f"{prefix}: found {len(segs)} signs, expected {len(signs)} -- not the right page?")
        for ch, (s, e) in zip(signs, segs):
            ink = band[:, s:e]
            im = Image.fromarray((ink * 255).astype(np.uint8))
            im = im.resize((round(im.width * k), round(im.height * k)), Image.BICUBIC).filter(ImageFilter.GaussianBlur(k / 4))
            canvas = Image.new("L", (W_UNITS * PX, H_UNITS * PX), 0)
            dx = LEFT * PX - HALF * k  # the stroke's centre on its left edge at x=LEFT
            dy = BASE * PX - (base - a) * k
            canvas.paste(im, (round(dx), round(dy)))
            rgba = Image.new("RGBA", canvas.size, (90, 90, 90, 0)); rgba.putalpha(canvas)
            rgba.save(out / f"{prefix}_{ch}.png", optimize=True)
            n += 1
    print(f"wrote {n} underlays -> {out}")


if __name__ == "__main__":
    main()
