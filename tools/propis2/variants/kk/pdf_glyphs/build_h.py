#!/usr/bin/env python3
"""Lowercase һ of the Kazakh copybook PDF («Яһуди», page 38), fitted to our system (owner, 2026-10-31: «вытащи h из этого слова и подгони под нашу систему»).

  python3 tools/propis2/variants/kk/pdf_glyphs/build_h.py            # writes h_lower.json (bank coordinates, one stroke)

Input: h_skel.json, the skeleton of the glyph outline (skeleton.py). The pen path is walked along that skeleton in the order the letter is written (entry from
the lower left, up to the loop, the loop, down the stem to its foot, back up the stem, the arch, the right leg, the exit), then
  - moved to the bank's geometry: baseline 62, ascender top -42 (the glyph's own height is mapped to 104 units), the slant of the PDF's stem turned to our 65 degrees,
  - smoothed a little (the thinning leaves a staircase).
"""
import json, sys, math
from collections import deque
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sk = json.load(open(sys.argv[1] if len(sys.argv) > 1 else HERE / "h_skel.json"))
S, X0, Y0 = sk["S"], sk["x0"], sk["y0"]
pix = {(round((y - Y0) * S), round((x - X0) * S)) for x, y in sk["skeleton"]}
nb = lambda p: [(p[0] + a, p[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and (p[0] + a, p[1] + b) in pix]
to_px = lambda x, y: (round((y - Y0) * S), round((x - X0) * S))
near = lambda q: min(pix, key=lambda p: (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2)

def walk(a, b):
    prev = {a: None}; dq = deque([a])
    while dq:
        u = dq.popleft()
        if u == b: break
        for v in nb(u):
            if v not in prev: prev[v] = u; dq.append(v)
    out = []; u = b
    while u is not None: out.append(u); u = prev[u]
    return out[::-1]

# waypoints (pixels of h_skel.png, y down), in the order of the pen
E2, E1, E0 = tuple(near((1015, 75))), tuple(near((1320, 62))), tuple(near((995, 900)))
W = [E2, (830, 265), (655, 372), (330, 470), (75, 700), (330, 700), (655, 372), (830, 265), (905, 273), E1, (905, 273), (700, 600), (900, 640), (1100, 540), (1300, 540), E0]
W = [near(w) for w in W]
poly = [W[0]]
for a, b in zip(W, W[1:]): poly += walk(a, b)[1:]
P = np.array([[p[1] / S + X0, p[0] / S + Y0] for p in poly])          # glyph units, y down, baseline y = 0

# 1. the slant of the stem (the stretch E1 -> J) in the PDF
stem = np.array([[q[1] / S + X0, q[0] / S + Y0] for q in walk(near((905, 273)), E1)])
t_pdf = (stem[0][0] - stem[-1][0]) / (stem[-1][1] - stem[0][1])       # dx per unit of height of the stem
t_bank = math.tan(math.radians(25.0))
top, base = P[:, 1].min(), 0.0
k = 104.0 / (base - top)                                               # ascender: 104 bank units
B = np.stack([ (P[:, 0] - P[0, 0]) * k + (-(P[:, 1] - base)) * k * 0.0, 62.0 + (P[:, 1] - base) * k ], 1)
h = (62.0 - B[:, 1])                                                   # height above the baseline in bank units
B[:, 0] += h * (t_bank - t_pdf)                                        # turn the slant to 65 degrees
B[:, 0] += 124.7 - B[0, 0]                                             # start where the bank's letters start

def smooth(B, sigma=1.4, step=0.4):
    seg = np.hypot(*np.diff(B, axis=0).T); acc = np.concatenate([[0], np.cumsum(seg)])
    n = max(int(acc[-1] / step), 20); ts = np.linspace(0, acc[-1], n)
    r = np.stack([np.interp(ts, acc, B[:, c]) for c in (0, 1)], 1)
    half = int(4 * sigma / step); ker = np.exp(-0.5 * (np.arange(-half, half + 1) * step / sigma) ** 2); ker /= ker.sum()
    ext = np.vstack([2 * r[0] - r[1:half + 1][::-1], r, 2 * r[-1] - r[-half - 1:-1][::-1]])
    sm = np.stack([np.convolve(ext[:, c], ker, mode="valid") for c in (0, 1)], 1); sm[0], sm[-1] = r[0], r[-1]
    return sm

def to_bezier(pts, knots=70):
    seg = np.hypot(*np.diff(pts, axis=0).T); acc = np.concatenate([[0], np.cumsum(seg)])
    tk = np.linspace(0, acc[-1], knots); K = np.stack([np.interp(tk, acc, pts[:, c]) for c in (0, 1)], 1)
    ex = np.vstack([2 * K[0] - K[1], K, 2 * K[-1] - K[-2]]); out = [f"M {K[0][0]:.2f} {K[0][1]:.2f}"]
    for i in range(1, len(ex) - 2):
        p0, p1, p2, p3 = ex[i - 1], ex[i], ex[i + 1], ex[i + 2]
        c1 = p1 + (p2 - p0) / 6.0; c2 = p2 - (p3 - p1) / 6.0
        out.append(f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}")
    return " ".join(out)

Bs = smooth(B)
d = to_bezier(Bs)
json.dump({"d": d, "scale": k, "stem_slant_pdf_deg": math.degrees(math.atan(1 / t_pdf)), "start": Bs[0].tolist(), "end": Bs[-1].tolist(), "top": Bs[:, 1].min()}, open(HERE / "h_lower.json", "w"), ensure_ascii=False)
print("scale", round(k, 3), "pdf stem angle", round(math.degrees(math.atan(1 / t_pdf)), 1), "start", Bs[0].round(1), "end", Bs[-1].round(1), "top y", round(Bs[:, 1].min(), 1))
