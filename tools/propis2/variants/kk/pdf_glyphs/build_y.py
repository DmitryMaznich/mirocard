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

# --- clean strokes (owner, 2026-10-31: «выровняй траекторию»): the stems are exact straight lines, only the belly, the connector and the hook are curves of the skeleton, smoothed hard
# (the thinning leaves little spurs and steps around the junctions) and joined to the lines without a corner.
SIG = 3.0
def curve_tail(P, sig=SIG):
    """The smoothed curve through P as the cubics of bez() without its leading M (it continues the path before it)."""
    return bez(smooth(P, sigma=sig), spacing=7.0).split(" ", 3)[3]

def line_fit(P):
    """The straight line (point, unit direction) through the points P (least squares)."""
    c = P.mean(axis=0); u, s_, vt = np.linalg.svd(P - c); return c, vt[0]

P1, P2 = to_bank(stroke1), to_bank(stroke2)
# left stem: the line through its straight part (from the top to the junction), carried on down to where the belly's lower left curve begins
i1 = next(i for i, q in enumerate(stroke1) if i > 5 and math.hypot(q[0] - near(J1)[0], q[1] - near(J1)[1]) < 1.5)
c1, u1 = line_fit(P1[: i1 - 12])
if u1[1] < 0: u1 = -u1
dev1 = lambda q: abs((q[0] - c1[0]) * u1[1] - (q[1] - c1[1]) * u1[0])
j = i1
while j + 1 < len(P1) and dev1(P1[j + 1]) < 0.8: j += 1                      # the stem goes on straight below the junction until the belly's curve leaves it
top1 = c1 + u1 * float(np.dot(P1[0] - c1, u1))
down1 = c1 + u1 * float(np.dot(P1[j] - c1, u1))
# the belly: from the end of the straight stem round the bottom, up its right side and over the top back to the stem; it ends ON the stem line
end1 = c1 + u1 * float(np.dot(P1[-1] - c1, u1))
belly = np.vstack([P1[j - 20: len(P1) - 12], end1[None, :]]) if False else P1[j - 20: len(P1) - 14]
d1 = f"M {top1[0]:.2f} {top1[1]:.2f} L {down1[0]:.2f} {down1[1]:.2f} " + curve_tail(np.vstack([down1[None, :], P1[j + 1: len(P1) - 14], end1[None, :]]))

# stroke 2 follows the PDF's own centre line (owner, 2026-10-31: «ты исказил полностью исходную фигуру»): a straight-line/one-cubic version sagged below the real connector.
# The connector, the right stem (walked once, then back along the very same smoothed points) and the foot with the hook are each smoothed lightly (SIG2) and joined end to end.
SIG2 = 2.0
conn = to_bank(walk(near(BOTTOM), near(J2)))
stem = to_bank(walk(near(J2), near(R_TOP)))
down = to_bank(walk(near(J2), near(FOOT)) + walk(near(FOOT), near(EXIT))[1:])
sm = lambda P: smooth(P, sigma=SIG2, step=0.4)
cs, ss, ds = sm(conn), sm(stem), sm(down)
# the skeleton of the right stem is pulled sideways where the connector merges into it (y ~7..34): take the stem from its clean parts above and below, x as a quadratic of y
imax = int(np.argmax(ds[:, 1]))                                                              # the foot's lowest point: the descending part ends there, the hook rises after it
desc = ds[: imax + 1]
clean = np.vstack([ss[ss[:, 1] < 4.0], desc[(desc[:, 1] > 36.0) & (desc[:, 1] < 54.0)]])
coef = np.polyfit(clean[:, 1], clean[:, 0], 2); fx = lambda y: np.polyval(coef, y)
ytop = -41.8; Y_END = 42.0
ys = np.linspace(ytop, Y_END, 120); stem_fit = np.stack([fx(ys), ys], 1)
i_end = int(np.argmax(desc[:, 1] >= Y_END))
ds2 = np.vstack([stem_fit[-1][None, :], ds[i_end:]])                                         # the foot and the hook from the skeleton, continuing the fitted stem
# the connector ends where it comes closest to the fitted stem; the last bit is carried straight on to the stem along its direction there
dist = np.array([fx(q[1]) - q[0] for q in cs])
k_end = int(np.argmin(abs(dist[len(cs) // 2:]))) + len(cs) // 2
cs = cs[: k_end + 1]
tdir = cs[-1] - cs[-6]; tdir /= np.hypot(*tdir)
for _ in range(40):                                                                           # step along the direction until the line meets the stem curve
    e = cs[-1] + tdir * 0.3
    if (fx(e[1]) - e[0]) * (fx(cs[-1][1]) - cs[-1][0]) <= 0 or abs(fx(e[1]) - e[0]) < 0.15: cs = np.vstack([cs, e]); break
    cs = np.vstack([cs, e])
j0 = int(np.argmin(abs(ys - cs[-1][1])))
climb = np.vstack([cs[-1][None, :], stem_fit[j0:][::-1]])                                     # junction -> top
fall = np.vstack([stem_fit[:-1], sm(ds2)])                                                    # top -> foot -> hook
d2 = bez(cs, spacing=7.0) + " " + bez(climb, spacing=9.0).split(" ", 3)[3] + " " + bez(fall, spacing=7.0).split(" ", 3)[3]
P2 = np.vstack([cs, climb, fall])
B1, B2 = P1, P2
json.dump({"strokes": [d1, d2], "scale": k, "pdf_stem_slant_deg": math.degrees(math.atan(1 / t_pdf)), "start1": top1.tolist(), "start2": P2[0].tolist(), "exit": P2[-1].tolist()}, open(HERE / "Y_glyph.json", "w"), ensure_ascii=False)
print("scale", round(k, 3), "start1", top1.round(1), "start2", P2[0].round(1), "exit", P2[-1].round(1))
