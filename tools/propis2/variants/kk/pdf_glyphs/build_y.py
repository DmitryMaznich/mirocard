#!/usr/bin/env python3
"""Capital Ы of the Kazakh copybook PDF (page 34), fitted to our system (owner, 2026-10-31: «ты можешь вектор вытащить из PDF»).

  python3 tools/propis2/variants/kk/pdf_glyphs/build_y.py     # writes Y_glyph.json: {"strokes": [d, d], ...} in bank coordinates

Input Y_skel.json: the centre line of the glyph outline (skeleton.py, from Y_glyph.d = the outline in the PDF's font). Two pen strokes, as the letter is written:
  1. the left stem from its top down, round the bottom of the belly, up its right side and over the top back to the stem;
  2. from the bottom of the belly along the connector up to the right stem, up it to the top, back down it (the same line), to the foot, the hook and the exit.
Fitted: the capital's height to 104 bank units (top -42, baseline 62), the slant of the right stem turned to 65 degrees, a light smoothing, the start of the letter on x = 124.7.
"""
import json, math
from collections import deque
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sk = json.load(open(HERE / "Y_skel.json"))
S, X0, Y0 = sk["S"], sk["x0"], sk["y0"]
pix = {(round((y - Y0) * S), round((x - X0) * S)) for x, y in sk["skeleton"]}
nb = lambda p: [(p[0] + a, p[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and (p[0] + a, p[1] + b) in pix]
near = lambda xy: min(pix, key=lambda p: (p[0] - xy[1]) ** 2 + (p[1] - xy[0]) ** 2)          # waypoints are given as (x, y) in the pixels of Y_skel.png

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

def path_through(way):
    way = [near(w) for w in way]; poly = [way[0]]
    for a, b in zip(way, way[1:]): poly += walk(a, b)[1:]
    return poly

# waypoints, (x, y) in the pixels of Y_skel.png
L_TOP, J1, L_BOT, BOTTOM, R_SIDE, TOP_BELLY = (225, 45), (140, 258), (60, 470), (205, 488), (262, 380), (190, 258)
stroke1 = path_through([L_TOP, J1, L_BOT, (120, 522), BOTTOM, R_SIDE, TOP_BELLY, J1])
J2, R_TOP, FOOT, EXIT = (345, 375), (498, 48), (322, 520), (456, 413)
stroke2 = path_through([BOTTOM, J2, R_TOP, J2, FOOT, EXIT])

allp = np.array([[p[1] / S + X0, p[0] / S + Y0] for p in stroke1 + stroke2])
top, base = allp[:, 1].min(), allp[:, 1].max()
k = 104.0 / (base - top)
t_bank = math.tan(math.radians(25.0))
rs = np.array([[p[1] / S + X0, p[0] / S + Y0] for p in walk(near(J2), near(R_TOP))])          # the right stem, to measure its slant
t_pdf = (rs[-1][0] - rs[0][0]) / (rs[0][1] - rs[-1][1])

def to_bank(poly):
    P = np.array([[p[1] / S + X0, p[0] / S + Y0] for p in poly])
    h = (base - P[:, 1]) * k                                                    # height above the baseline in bank units
    x = (P[:, 0] - allp[:, 0].min()) * k + h * (t_bank - t_pdf)
    return np.stack([x + 124.7, 62.0 - h], 1)

def smooth(B, sigma=1.2, step=0.4):
    seg = np.hypot(*np.diff(B, axis=0).T); acc = np.concatenate([[0], np.cumsum(seg)])
    n = max(int(acc[-1] / step), 20); ts = np.linspace(0, acc[-1], n)
    r = np.stack([np.interp(ts, acc, B[:, c]) for c in (0, 1)], 1)
    half = int(4 * sigma / step); ker = np.exp(-0.5 * (np.arange(-half, half + 1) * step / sigma) ** 2); ker /= ker.sum()
    ext = np.vstack([2 * r[0] - r[1:half + 1][::-1], r, 2 * r[-1] - r[-half - 1:-1][::-1]])
    sm = np.stack([np.convolve(ext[:, c], ker, mode="valid") for c in (0, 1)], 1); sm[0], sm[-1] = r[0], r[-1]
    return sm

def bez(pts, spacing=5.0):
    seg = np.hypot(*np.diff(pts, axis=0).T); acc = np.concatenate([[0], np.cumsum(seg)])
    tk = np.linspace(0, acc[-1], max(int(acc[-1] / spacing), 8)); K = np.stack([np.interp(tk, acc, pts[:, c]) for c in (0, 1)], 1)
    ex = np.vstack([2 * K[0] - K[1], K, 2 * K[-1] - K[-2]]); o = [f"M {K[0][0]:.2f} {K[0][1]:.2f}"]
    for i in range(1, len(ex) - 2):
        p0, p1, p2, p3 = ex[i - 1], ex[i], ex[i + 1], ex[i + 2]
        c1 = p1 + (p2 - p0) / 6.0; c2 = p2 - (p3 - p1) / 6.0
        o.append(f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}")
    return " ".join(o)

B1, B2 = smooth(to_bank(stroke1)), smooth(to_bank(stroke2))
json.dump({"strokes": [bez(B1), bez(B2)], "scale": k, "pdf_stem_slant_deg": math.degrees(math.atan(1 / t_pdf)), "start1": B1[0].tolist(), "start2": B2[0].tolist(), "exit": B2[-1].tolist()}, open(HERE / "Y_glyph.json", "w"), ensure_ascii=False)
print("scale", round(k, 3), "pdf stem", round(math.degrees(math.atan(1 / t_pdf)), 1), "start1", B1[0].round(1), "start2", B2[0].round(1), "exit", B2[-1].round(1), "pts", len(B1), len(B2))
