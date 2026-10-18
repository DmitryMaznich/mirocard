#!/usr/bin/env python3
"""Review sheet: every traced capital after tidy_trace.py over the Boyan Maga outline, on the deck's paper, so a wrong simplification
(a loop made a spur, a wave made an arc, a bow made an elbow) shows at a glance.

  python3 tools/propis2/variants/bg/compare_font.py <Boyan_Maga-Regular.ttf> <out.png>

Grey: the font where the underlay showed it under the hand (make_underlays.py), put through the same placing as the tidied letter.
Colour: the tidied strokes (one colour per stroke, a dot where it starts).
"""
import sys, json, glob
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tidy_trace as tt, font_glyphs as fg, make_underlays as mu, build_glyphs as bg
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
dg = tt.dg; dg.DY = 0.0
V = str(Path(__file__).resolve().parent) + '/'
f = TTFont(sys.argv[1]); gs = f.getGlyphSet(); cm = f.getBestCmap()
script = json.load(open(V + 'variant.json'))['meta']['script']
items = [i for fn in sorted(glob.glob(V + 'captures/boyan_*.json')) for i in json.load(open(fn)) if i['label'].isupper()]
S = 5; CW, CH = 150 * S, 140 * S; per = 3
rows = (len(items) + per - 1) // per
img = Image.new('RGB', (per * CW, rows * CH), 'white'); d = ImageDraw.Draw(img)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
cols = [(200, 20, 20), (20, 80, 200), (10, 140, 50)]
for n, it in enumerate(items):
    ch = it['label']
    raw = [np.array([dg.xform(p, 2.0, 0) for p in tt.parse_path(s['d'])]) for s in it['strokes']]
    bank, paper = tt.tidy_letter(raw, True, script, loops=ch in bg.LOOPS)
    # the font's outline, where the underlay showed it under the hand (make_underlays.py, the image's left edge at canvas x = 100)
    pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
    polys_t = [[mu.bank_to_tool(*fg.to_bank(x, y)) for x, y in poly] for poly in pen.polys]
    dx = mu.LEFT - min(x for poly in polys_t for x, _ in poly) + 100.0
    polys = [tt.placed_like_last(np.array([dg.xform((x + dx, y), 2.0, 0) for x, y in poly])) for poly in polys_t]
    x0 = min(min(p[0] for poly in polys for p in poly), min(q[0] for c in paper for _, ps in c for q in ps)) - 8
    ox, oy = (n % per) * CW, (n // per) * CH
    P = lambda p: ((p[0] - x0) * S, (p[1] + 70) * S)
    # fill with the non-zero rule (counters stay open)
    W, H = CW, CH; wind = np.zeros((H, W), int)
    for poly in polys:
        m = Image.new('1', (W, H), 0); ImageDraw.Draw(m).polygon([P(p) for p in poly], fill=1)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, list(poly[1:]) + [poly[0]]))
        wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
    cell = np.full((H, W, 3), 255, np.uint8); cell[wind != 0] = (205, 205, 205)
    img.paste(Image.fromarray(cell), (ox, oy))
    dd = ImageDraw.Draw(img)
    Q = lambda p: (ox + (p[0] - x0) * S, oy + (p[1] + 70) * S)
    for y in (tt.BASE, tt.X_TOP, tt.CAP_TOP): dd.line([Q((x0, y)), Q((x0 + 148, y))], fill=(150, 180, 220), width=2)
    for j, c in enumerate(paper):
        pts = tt.parse_path(dg.fmt(c)); dd.line([Q(p) for p in pts], fill=cols[j % 3], width=4)
        x, y = Q(pts[0]); dd.ellipse([x - 7, y - 7, x + 7, y + 7], fill=cols[j % 3])
    dd.text((ox + 12, oy + 8), ch, fill=(0, 0, 0), font=font)
img.save(sys.argv[2])
