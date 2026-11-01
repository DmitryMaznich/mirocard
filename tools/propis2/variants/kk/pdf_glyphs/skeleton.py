#!/usr/bin/env python3
"""Centre line of a glyph outline taken from the Kazakh copybook PDF (an SVG path of one filled glyph).

  python3 tools/propis2/variants/kk/pdf_glyphs/skeleton.py <glyph.d> <out.json> [out.png]

Flattens the outline, rasterises it, thins it (skimage skeletonize) and writes the skeleton graph: end points, junctions and the polylines
(edges) between them, in glyph units (y down, as in the SVG). The PDF is the owner's reference; only the shape of the letters that the bank lacks is taken.
"""
import sys, re, json
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize

def flatten(d, n=24):
    toks = re.findall(r"[MCLZ]|-?\d+\.?\d*(?:e-?\d+)?", d); i = 0; contours = []; cur = []; p = None
    while i < len(toks):
        t = toks[i]
        if t == "M":
            if cur: contours.append(cur)
            p = (float(toks[i + 1]), float(toks[i + 2])); cur = [p]; i += 3
        elif t == "L":
            p = (float(toks[i + 1]), float(toks[i + 2])); cur.append(p); i += 3
        elif t == "C":
            c1 = (float(toks[i + 1]), float(toks[i + 2])); c2 = (float(toks[i + 3]), float(toks[i + 4])); e = (float(toks[i + 5]), float(toks[i + 6]))
            for k in range(1, n + 1):
                u = k / n; v = 1 - u
                cur.append((v ** 3 * p[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * e[0], v ** 3 * p[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * e[1]))
            p = e; i += 7
        else:
            i += 1
    if cur: contours.append(cur)
    return contours

def main():
    d = open(sys.argv[1]).read()
    cs = flatten(d)
    xs = [x for c in cs for x, _ in c]; ys = [y for c in cs for _, y in c]
    S = 80  # pixels per glyph unit
    x0, y0 = min(xs) - 0.5, min(ys) - 0.5
    W, H = int((max(xs) - x0 + 0.5) * S), int((max(ys) - y0 + 0.5) * S)
    # even-odd fill: draw each contour with XOR
    wind = np.zeros((H, W), int)                       # non-zero winding (TrueType / PDF glyphs overlap their contours: an even-odd fill would cancel the overlaps)
    for c in [c for c in cs if len(c) >= 3]:
        m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([((x - x0) * S, (y - y0) * S) for x, y in c], fill=1)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(c, c[1:] + c[:1]))
        wind += np.where(np.array(m, bool), 1 if area > 0 else -1, 0)
    mask = wind != 0
    sk = skeletonize(mask)
    ys_, xs_ = np.nonzero(sk)
    pts = set(zip(ys_.tolist(), xs_.tolist()))
    nb = lambda p: [(p[0] + a, p[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and (p[0] + a, p[1] + b) in pts]
    deg = {p: len(nb(p)) for p in pts}
    ends = [p for p, k in deg.items() if k == 1]
    junc = [p for p, k in deg.items() if k >= 3]
    out = {"S": S, "x0": x0, "y0": y0, "ends": [[(p[1] / S) + x0, (p[0] / S) + y0] for p in ends], "junctions": [[(p[1] / S) + x0, (p[0] / S) + y0] for p in junc],
           "skeleton": [[(p[1] / S) + x0, (p[0] / S) + y0] for p in sorted(pts)], "mask_wh": [W, H]}
    json.dump(out, open(sys.argv[2], "w"))
    if len(sys.argv) > 3:
        im = Image.fromarray((mask * 120 + 135).astype(np.uint8)).convert("RGB"); px = im.load()
        for (y, x) in pts: px[x, y] = (200, 0, 0)
        dr = ImageDraw.Draw(im)
        for k, (y, x) in enumerate(ends): dr.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(0, 0, 255), width=3); dr.text((x + 12, y - 6), f"E{k}", fill=(0, 0, 255))
        for k, (y, x) in enumerate(junc[:40]): dr.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(0, 140, 0), width=2)
        im.save(sys.argv[3])
    print("ends", len(ends), "junction px", len(junc), "skeleton px", len(pts), "size", W, H)

if __name__ == "__main__":
    main()
