#!/usr/bin/env python3
"""Underlays for tracing the Kazakh letters by hand in the handwriting capture tool (tools/letter_capture), one PNG per letter.

  python3 tools/propis2/variants/kk/make_underlays.py <poster1.jpg> <poster2.jpg> <out dir>

The sources are two alphabet posters the owner sent (2026-10-29), not kept in the repo: poster 1 is a Kazakh cursive alphabet,
poster 2 a mixed Kazakh/Bashkir one, used only where poster 1 is too blurred (у's loop, ә). Both are already ruled at 65deg, so the
letter is only cut out and scaled, not de-slanted. Geometry of the tool, as in bg/make_underlays.py: 150 units tall, baseline
y=88, lowercase 62..88, capitals up to 36, ink starting at x=12; lowercase scales by the poster's x-height, capitals by
baseline -> top of the letter.
Files: up_<letter>.png / lo_<letter>.png (case-proof on Windows, like the dictation clips).
"""
import sys
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PX = 8
H_UNITS, W_UNITS = 150, 200
LEFT = 12.0
BASE, X_TOP, CAP_TOP = 88.0, 62.0, 36.0

# letter: (poster, crop box, baseline y, x-line y or None for a capital, ink colour[, box to erase: a neighbour's ink])
LETTERS = {
    "Ә": (1, (243, 35, 304, 132), 128, None, "red"),
    "ә": (2, (207, 140, 248, 180), 174, "top", "red", (207, 140, 214, 162)),  # poster 1's ә is too small: its loop fills in
    "Һ": (1, (383, 495, 444, 592), 588, None, "dark"),
    "һ": (1, (450, 512, 500, 592), 588, 550, "dark"),
    "І": (1, (318, 608, 394, 708), 702, None, "red", (376, 638, 394, 708)),  # the lowercase і beside it
    "у": (2, (860, 325, 912, 392), 360, 332, "red"),
}


def inkness(rgb, colour):
    a = rgb.astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if colour == "red":
        return np.clip((r - (g + b) / 2 - 25) / 45, 0, 1)
    return np.clip((170 - a.min(axis=2)) / 90, 0, 1) * (np.abs(r - (g + b) / 2) < 70)


def keep_big(mask, frac=0.12):
    """Drop specks and neighbours' bits: keep 8-connected parts at least `frac` of the biggest."""
    h, w = mask.shape; lab = np.zeros((h, w), int); sizes = [0]
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        n = len(sizes); sizes.append(0); q = deque([(y0, x0)]); lab[y0, x0] = n
        while q:
            y, x = q.popleft(); sizes[n] += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; q.append((yy, xx))
    big = max(sizes)
    return np.isin(lab, [i for i, s in enumerate(sizes) if i and s >= frac * big])


def main():
    posters = {1: Image.open(sys.argv[1]).convert("RGB"), 2: Image.open(sys.argv[2]).convert("RGB")}
    out = Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
    for ch, (src, box, base, xline, colour, *erase) in LETTERS.items():
        ink = inkness(np.array(posters[src].crop(box)), colour)
        for x0, y0, x1, y1 in erase:
            ink[y0 - box[1]:y1 - box[1], x0 - box[0]:x1 - box[0]] = 0
        ink = np.clip(ink / max(np.percentile(ink[ink > 0.1], 90), 0.3), 0, 1)  # thin strokes are faint on a small JPEG
        ink *= keep_big(ink > 0.3)
        ys, xs = np.nonzero(ink > 0.3)
        top = box[1] + ys.min()
        if xline == "top": xline = top  # no usable x-line on the poster: the letter's own top is the x-height
        k = (BASE - X_TOP) / (base - xline) if xline else (BASE - CAP_TOP) / (base - top)  # tool units per poster px
        k = float(k * PX)
        im = Image.fromarray((ink * 255).astype(np.uint8)).resize((round(ink.shape[1] * k), round(ink.shape[0] * k)), Image.BICUBIC)
        im = im.filter(ImageFilter.GaussianBlur(k / 4)).point(lambda v: 255 if v > 128 else 0)
        canvas = Image.new("L", (W_UNITS * PX, H_UNITS * PX), 0)
        dx = LEFT * PX - xs.min() * k
        dy = BASE * PX - (base - box[1]) * k
        canvas.paste(im, (round(dx), round(dy)))
        rgba = Image.new("RGBA", canvas.size, (90, 90, 90, 0)); rgba.putalpha(canvas)
        ImageDraw.Draw(rgba).text((2 * PX, 0), ch, fill=(200, 0, 0, 255))
        rgba.save(out / f"{'up' if ch.isupper() else 'lo'}_{ch.lower()}.png")
    print(f"{len(LETTERS)} underlays -> {out}")


if __name__ == "__main__":
    main()
