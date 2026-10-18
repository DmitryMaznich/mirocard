#!/usr/bin/env python3
"""Review sheet: every traced capital after tidy_trace.py over the Boyan Maga outline, on the deck's paper, so a wrong simplification
(a loop made a spur, a wave made an arc, a bow made an elbow) shows at a glance.

  python3 tools/propis2/variants/bg/compare_font.py <Boyan_Maga-Regular.ttf> <out.png> [--built]

--built: the capitals as they are in variant.json now (what the deck draws), every stroke red, a dot where it starts, over the
font's stencil in grey; no hand. For the owner's review of the finished letters.

Grey: the font as a stencil at its own proportions (build_glyphs.stencil_map): as tall as the tidied letter, on its middle.
Thin dark: the hand as captured. Colour: the tidied strokes (one colour per stroke, a dot where it starts).
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
def fine(cmds):
    # 40 points per cubic (parse_path's 10 draw a long one as a polygon)
    out = [np.asarray(cmds[0][1][0], float)]
    for cm, ps in cmds[1:]:
        ps = [np.asarray(p, float) for p in ps]
        if cm == "L": out.append(ps[0]); continue
        p0 = out[-1]
        for t in np.linspace(0, 1, 41)[1:]: out.append((1-t)**3*p0 + 3*(1-t)**2*t*ps[0] + 3*(1-t)*t**2*ps[1] + t**3*ps[2])
    return out


for n, it in enumerate(items):
    ch = it['label']
    raw = [np.array([dg.xform(p, 2.0, 0) for p in tt.parse_path(s['d'])]) for s in it['strokes']]
    bank, paper = bg.tidy(ch, raw, script)
    # the font's outline, where the underlay showed it under the hand (make_underlays.py, the image's left edge at canvas x = 100)
    pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
    polys_t = [[mu.bank_to_tool(*fg.to_bank(x, y)) for x, y in poly] for poly in pen.polys]
    dx = mu.LEFT - min(x for poly in polys_t for x, _ in poly) + 100.0
    # the font as a stencil at its own proportions, as tall as the letter, on the letter's middle (build_glyphs.stencil_map)
    fn = bg.stencil_map(ch, like=np.vstack([tt.parse_path(dg.fmt(c)) for c in paper]))
    polys = [fn(np.array([fg.to_bank(x, y) for x, y in poly])) for poly in pen.polys]
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
    # the ruling's slant guides (meta.script slantDeg, 76deg on the Bulgarian paper): every stem must run along them
    for gx in np.arange(x0 - 40, x0 + 190, 15):
        dd.line([Q((gx, tt.BASE)), Q((gx + (tt.BASE - tt.CAP_TOP) * tt.SLANT_T, tt.CAP_TOP))], fill=(225, 190, 190), width=1)
    for r in raw: dd.line([Q(p) for p in tt.placed_like_last(r)], fill=(90, 90, 90), width=1)
    for j, c in enumerate(paper):
        pts = fine(c); dd.line([Q(p) for p in pts], fill=cols[j % 3], width=3)
        x, y = Q(pts[0]); dd.ellipse([x - 7, y - 7, x + 7, y + 7], fill=cols[j % 3])
    dd.text((ox + 12, oy + 8), ch, fill=(0, 0, 0), font=font)
img.save(sys.argv[2])


def built_sheet(out):
    """--built: variant.json's capitals on paper (tidy_trace.to_paper, the deck's geometry), red over the font stencil."""
    variant = json.load(open(V + 'variant.json'))
    tt.use_script(variant['meta']['script'])
    dxs = json.load(open(V + 'underlay_dx.json'))['dx']
    glyphs = [g for g in variant['glyphs'] if g['label'].isupper() and g['label'] in dxs]
    order = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ"
    glyphs.sort(key=lambda g: order.index(g['label']))
    S, CW, CH, per = 5, 150 * 5, 140 * 5, 4
    rows = (len(glyphs) + per - 1) // per
    img = Image.new('RGB', (per * CW, rows * CH), 'white')
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
    for n, g in enumerate(glyphs):
        ch = g['label']
        paper = [tt.to_paper(np.array(tt.parse_path(st['d']))) for st in g['strokes']]
        body = [p for k, p in enumerate(paper) if k != g.get('tailStroke')]  # the connector to the next letter is not the letter
        fn = bg.stencil_map(ch, like=np.vstack(body))
        pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
        polys = [fn(np.array([fg.to_bank(x, y) for x, y in poly])) for poly in pen.polys]
        x0 = min(min(p[0] for poly in polys for p in poly), min(q[0] for p in paper for q in p)) - 8
        ox, oy = (n % per) * CW, (n // per) * CH
        P = lambda p: ((p[0] - x0) * S, (p[1] + 70) * S)
        wind = np.zeros((CH, CW), int)
        for poly in polys:
            m = Image.new('1', (CW, CH), 0); ImageDraw.Draw(m).polygon([P(p) for p in poly], fill=1)
            area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, list(poly[1:]) + [poly[0]]))
            wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
        cell = np.full((CH, CW, 3), 255, np.uint8); cell[wind != 0] = (205, 205, 205)
        img.paste(Image.fromarray(cell), (ox, oy))
        dd = ImageDraw.Draw(img)
        Q = lambda p: (ox + (p[0] - x0) * S, oy + (p[1] + 70) * S)
        for y in (tt.BASE, tt.X_TOP, tt.CAP_TOP): dd.line([Q((x0, y)), Q((x0 + 148, y))], fill=(150, 180, 220), width=2)
        for st in g['strokes']:
            cmds = []
            nums = [float(v) for v in __import__('re').findall(r'-?\d*\.?\d+(?:[eE][+-]?\d+)?', st['d'])]
            toks = __import__('re').findall(r'[MLC]', st['d'])
            i = 0
            for t in toks:
                k = 1 if t in 'ML' else 3
                ps = [tt.to_paper(np.array([[nums[i + 2 * j], nums[i + 2 * j + 1]]]))[0] for j in range(k)]
                cmds.append((t, ps)); i += 2 * k
            pts = fine(cmds)
            dd.line([Q(p) for p in pts], fill=(200, 20, 20), width=4)
            x, y = Q(pts[0]); dd.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(200, 20, 20))
        dd.text((ox + 12, oy + 8), ch, fill=(0, 0, 0), font=font)
        dd.rectangle([ox, oy, ox + CW - 1, oy + CH - 1], outline=(225, 225, 225))
    img.save(out)


if '--built' in sys.argv: built_sheet(sys.argv[2])
