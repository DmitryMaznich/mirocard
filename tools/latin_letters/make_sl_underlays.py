#!/usr/bin/env python3
"""Underlays for tracing Slovenian cursive letters by hand in the handwriting capture tool (tools/letter_capture), cut from the
owner's school sheets (docs/propis2-sl.md, step 4р).

  python3 tools/latin_letters/make_sl_underlays.py <«Male pisane črke – 9».pdf> <out dir>

The sheet itself is not in the repo. At 600 dpi its ruling (measured 2026-11-13) is three lines per row, equal bands: top line,
dashed x-line, baseline, 142.5 px apart. Geometry of the tool, as in make_underlays.py: 150 units tall, 200 wide, 8 px per unit,
baseline y=88, x-line y=62 (x-height 26 units), so the sheet is scaled by 26 units per its x-height. The cut letter is dark grey;
its neighbours on the sheet are kept faint, so the joins in and out are visible; the sheet's own lines are removed (the tool
draws its own, at the same heights).

CUTS: (file, sheet row baseline, letter columns, context columns) at 600 dpi.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PX = 8
H_UNITS, W_UNITS = 150, 200
BASE, X_TOP = 88.0, 62.0
X_PAGE = 142.5  # x-height on the sheet at 600 dpi, between line centres
AT_X = 40.0     # where the cut letter's left edge goes, units

CUTS = [
    # r at the start of «raste» (row 4): lead-in from the baseline, then «a» faint
    ("lo_r.png", 4623, (2480, 2678), (2420, 3000)),
    # r inside «frizerjev» (row 2): out of f, into i
    ("lo_r_2.png", 3479.5, (2364, 2528), (2160, 2780)),
]
TOPS = [2623.5, 3194, 3766.5, 4336, 4908, 5478.5, 6050]
BASES = [2909.5, 3479.5, 4052.5, 4623, 5193.5, 5760, 6336]
LINES = TOPS + BASES + [(t + b) / 2 for t, b in zip(TOPS, BASES)]


def page(src):
    tmp = Path(tempfile.mkdtemp())
    subprocess.run(["pdftoppm", "-r", "600", "-f", "1", "-l", "1", "-gray", "-png", src, str(tmp / "p")], check=True)
    return np.array(Image.open(next(tmp.glob("p-*.png"))).convert("L")).astype(float)


def main():
    im = page(sys.argv[1])
    ink = np.clip((200 - im) / 120, 0, 1)
    # the sheet's ruling out: a pixel near a line's centre stays only if the ink goes on above or below the line
    clean = ink.copy()
    for y in LINES:
        for r in range(int(y) - 11, int(y) + 12):
            keep = (ink[r - 14] > 0.4) | (ink[r + 14] > 0.4)
            clean[r] = np.where(keep, ink[r], 0)
    out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    k = (BASE - X_TOP) / X_PAGE * PX
    for name, base, (a, b), (ca, cb) in CUTS:
        top = int(base - BASE / (BASE - X_TOP) * X_PAGE)  # the sheet's y at the tool's y=0
        bot = int(base + (H_UNITS - BASE) / (BASE - X_TOP) * X_PAGE)
        band = clean[top:bot, ca:cb].copy()
        row = BASES.index(base)
        band[: max(0, int(TOPS[row] - 12) - top)] = 0  # the row above
        if row + 1 < len(TOPS): band[max(0, int(TOPS[row + 1] - 12) - top):] = 0  # the row below
        weight = np.full(band.shape, 0.22)
        weight[:, a - ca:b - ca] = 1.0
        g = Image.fromarray((band * weight * 255).astype(np.uint8))
        g = g.resize((round(g.width * k), round(g.height * k)), Image.BICUBIC).filter(ImageFilter.GaussianBlur(k / 4))
        canvas = Image.new("L", (W_UNITS * PX, H_UNITS * PX), 0)
        canvas.paste(g, (round(AT_X * PX - (a - ca) * k), round(BASE * PX - (base - top) * k)))
        rgba = Image.new("RGBA", canvas.size, (90, 90, 90, 0)); rgba.putalpha(canvas)
        rgba.save(out / name, optimize=True)
    print(f"wrote {len(CUTS)} underlays -> {out}")


if __name__ == "__main__":
    main()
