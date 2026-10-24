#!/usr/bin/env python3
"""Underlays for tracing the Bulgarian letters by hand in the handwriting capture tool (tools/letter_capture), one PNG per letter.

  python3 tools/propis2/variants/bg/make_underlays.py <Boyan_Maga-Regular.ttf> <out dir> [glyphs.json]

The tool fits a photo underlay to the canvas height (150 units) and puts its left edge at x=100 (the middle slot), so every PNG is
150 units tall, and drawn in the TOOL's geometry: baseline y=88, lowercase 62..88, capitals up to 36, the bank's 65deg slant.
The font's own geometry (78deg, capitals 2.06, descenders 1.13) is taken out, as font_glyphs.py does: the deck's meta.script puts
it back, so a letter traced over the underlay comes out as the font. Grey: the font's letter. Thin colour line (optional, from
font_glyphs.py's output): the pen path the program found, its strokes numbered at their start — keep it where it is right.
Files: up_<letter>.png / lo_<letter>.png (case-proof on Windows, like the dictation clips).
"""
import sys, json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import font_glyphs as fg  # noqa: E402

PX = 8                  # pixels per tool unit
H_UNITS, W_UNITS = 150, 200
SLANT = 0.4663          # the tool's 65deg slant (build_digit_glyphs.py SLANT)
S = 2.0                 # bank height / tool height (the bank's x-height 52 is the tool's 26)
LEFT = 12.0             # where the letter's ink starts in the underlay (tool units)


def bank_to_tool(x, y):
    h = (62.0 - y) / S
    return x - SLANT * (S - 1) * h, 88.0 - h


def main():
    font, out = sys.argv[1], Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    hints = {g["label"]: g for g in json.loads(Path(sys.argv[3]).read_text())} if len(sys.argv) > 3 else {}
    f = TTFont(font); gs = f.getGlyphSet(); cm = f.getBestCmap()
    lab = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 7 * PX) if Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").exists() else None
    letters = "абвгдежзийклмнопрстуфхцчшщъьюя"
    for ch in letters + letters.upper():
        pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
        polys = [[bank_to_tool(*fg.to_bank(x, y)) for x, y in poly] for poly in pen.polys]
        hint = [[bank_to_tool(*q) for q in fg.parse_path(st["d"])] for st in hints.get(ch, {}).get("strokes", [])]
        x_min = min(x for poly in polys for x, _ in poly)
        dx = LEFT - x_min
        W, H = W_UNITS * PX, H_UNITS * PX
        P = lambda x, y: ((x + dx) * PX, y * PX)
        wind = np.zeros((H, W), int)
        for poly, raw in zip(polys, pen.polys):
            m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([P(x, y) for x, y in poly], fill=1)
            area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(raw, raw[1:] + raw[:1]))
            wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
        rgba = np.zeros((H, W, 4), np.uint8)
        rgba[wind != 0] = (90, 90, 90, 255)
        img = Image.fromarray(rgba, "RGBA"); d = ImageDraw.Draw(img)
        for k, st in enumerate(hint):
            n = len(st)
            for i in range(n - 1):
                t = i / max(n - 1, 1)
                r, g, b = [int(255 * v) for v in __import__("colorsys").hsv_to_rgb(0.75 * t, 0.9, 0.85)]
                d.line([P(*st[i]), P(*st[i + 1])], fill=(r, g, b, 255), width=PX // 2)
            sx, sy = P(*st[0]); d.ellipse([sx - 2 * PX, sy - 2 * PX, sx + 2 * PX, sy + 2 * PX], fill=(0, 0, 0, 255))
            if lab: d.text((sx + 2 * PX, sy - 9 * PX), str(k + 1), fill=(0, 0, 0, 255), font=lab)
        if lab: d.text((2 * PX, 0), ch, fill=(200, 0, 0, 255), font=lab)
        img.save(out / f"{'up' if ch.isupper() else 'lo'}_{ch.lower()}.png")
    print(f"{2 * len(letters)} underlays -> {out}")


if __name__ == "__main__":
    main()
