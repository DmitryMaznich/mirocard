#!/usr/bin/env python3
"""British letters traced by hand in the capture tool (tools/letter_capture, over tools/latin_letters/underlays/british) -> the same pen
path, tidied, in the engine's capture frame (docs/latin-letters.md).

  python3 tools/latin_letters/tidy_capture.py <captures.json>... > tools/latin_letters/captures/british.tidy.json

Several files may be given; a later capture of a letter replaces an earlier one. The hand's own path stays: its strokes, their order and
direction, where the pen lifts and where it turns back (the stem of a d, the retrace of an h). Only the shake goes:
- the stroke is cut where the pen turns back (a cusp); tiny pieces between two turns (a knot of the hand) are dropped;
- a run that stays close to a line is that line: within VERT_DEG of the vertical it is vertical (a stem), within HORIZ_DEG of the
  horizontal horizontal (t's and f's bar); a retrace runs exactly along the stem it goes back up;
- what is left is curves, drawn through ANCHORS -- the ends and every top, bottom, leftmost and rightmost point of a bow -- with the
  tangent horizontal at a top or bottom and vertical at a side, so a bowl is an oval; a quarter between a side and a top / bottom is a
  quarter of an ellipse (handles 0.5523 of its axes), anything else one cubic fitted to the smoothed hand with the anchors' tangents;
- a top, bottom or stem end this close (SNAP) to a ruling line stands on it: x-line 62, baseline 88, and where the Nelson page puts the
  ascenders (39.6) and descenders (110.4) -- 0.86 of the x-height, as the underlays.
Then into the engine's frame: x 2 (the tool's x-height 26 -> 52, baseline 88 -> 62, ink from x = 0), and the zones above the x-line /
below the baseline squeezed from the page's 0.86 to the pupil books' 0.74 / 0.72 (tools/handwriting/latin/build-print.mjs, british).
Dots (a stroke smaller than DOT) become the same small ring as the drawn letters'.
"""
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

STEP = 0.2            # resampling step, tool units (x-height 26)
CUSP_DEG = 110.0      # the direction turns this much within CUSP_W: the pen turned back
CUSP_W = 1.2
KNOT = 3.5            # a piece shorter than this between two turns is a knot of the hand
LINE_TOL, LINE_MIN = 0.9, 15.0         # a long slanting run this close to its chord is a line (A, v, w, x, z, k's leg)
STEM_TOL, STEM_MIN = 0.9, 15.0         # a near-vertical run this long: a stem (the side of a bowl is shorter)
LONG_TOL, LONG_MIN = 1.4, 25.0         # a slanting or level run this long may waver more (the legs of W, V, M, N; the bars of Z)
BAR_TOL, BAR_MIN = 0.8, 12.0          # a near-horizontal run this long: a bar of t or f (the flat top of a bowl is shorter)
VERT_DEG, HORIZ_DEG = 10.0, 10.0
SMOOTH = 1.2          # gaussian along the curve, tool units
PROM_WHOLE = 2.0     # ... on a capital (its bows are about twice as big, the shake of the hand the same: G's and Q's bumps)
PROM = 1.2            # an extremum must stand out this much from both sides (else it is the shake)
FIT_TOL = 0.6         # a cubic strays at most this far from the smoothed hand, else the piece is split
SNAP = 4.0            # a stem's end this close to a ruling line stands on it (b, k were traced up to the tool's line 2, 36: the ascender is 39.6)
SNAP_EXT = 2.0       # a bow's top / bottom this close to a line stands on it (y's tail was 1.53 deep)
SHORT_TAIL = set("f")  # ... except these: f's tail is shorter on the Nelson page (0.77 of the x-height against 0.86), the hand kept it
TRIM, TRIM_PART = 3.0, 0.2  # a line gives this much of its end (at most this part of it) to the curve it turns into: room to turn
DOT = 3.0
DOTTED = set("ij")    # letters whose tiny strokes are dots; elsewhere a tiny stroke is a touch of the pen and goes
END_SNAP = 2.0       # a stroke's end (or a sharp turn) this close to a ruling line stands on it (v's point: 1.9 under after the line fit)
CLOSE = 3.0          # a stroke ending this close to its start is a closed oval
MEET = 2.0           # ends of two strokes this close are one point (the apex of A)
FRAG = 3.5            # a curve this short left between a line and the end of its piece is part of the line (b's stem began with a tick)
LOOP = 8.0            # a little loop of the hand (k's knot), at most this long around, is cut out
BAR_SNAP = 1.3       # a bar this close to a ruling line stands on it (E's middle bar was traced 1.2 under the x-line)
BOWED_SLANTS = set("kmnh")  # no slanting lines: k's rise from the stem's foot is a gentle arc and its leg starts level and bends down
#                         (owner, 2026-11-08: «от низа стойки идёт слегка по параболе; заключительный элемент сначала чуть выше,
#                         потом плавно загибается вниз»)
FREE_TURN = set("M")  # turns left where the hand put them: M's middle stops 0.07 of the x-height above the baseline on the Nelson page
STEM_MEET = 2.5      # a bar's end this close to a stem (a vertical line of another stroke) ends on it
BOW_BAR = 2.0        # a bar whose hand sags this much in the middle is drawn as one arc (f), else straight
BAR_DEV = 0.2         # a whole stroke near-horizontal and within this part of its length from its chord is a bar
K_ELL = 0.5523
OVAL_TURN, OVAL_STEM = 250.0, 28.0  # see line_runs
ELLIPSE_BOWS = set("D")  # bows drawn as ellipse quarters however the hand went (owner, 2026-11-09: D «пузо сделай плавной дугой»)
QUARTER_TOL = 3.0     # a quarter of an oval is an ellipse even this far from the hand (the hand drew D's side as a broken line)
X_LINE, BASE, NELSON = 62.0, 88.0, 0.86
LINES = [BASE - (BASE - X_LINE) * (1 + NELSON), X_LINE, BASE, BASE + (BASE - X_LINE) * NELSON]  # 39.64, 62, 88, 110.36
UPPER, LOWER = 0.74, 0.72


# ---------- geometry helpers
def parse(d):
    toks = re.findall(r"[MLC]|-?\d*\.?\d+(?:[eE][+-]?\d+)?", d)
    pts, i, cmd, cur = [], 0, None, None
    while i < len(toks):
        t = toks[i]
        if t in "MLC": cmd = t; i += 1; continue
        if cmd == "M":
            cur = np.array([float(toks[i]), float(toks[i + 1])]); pts.append(cur); i += 2; cmd = "L"
        elif cmd == "L":
            cur = np.array([float(toks[i]), float(toks[i + 1])]); pts.append(cur); i += 2
        else:
            p = [cur] + [np.array([float(toks[i + 2 * j]), float(toks[i + 2 * j + 1])]) for j in range(3)]
            for s in np.linspace(0, 1, 41)[1:]:
                pts.append(bez(p, s))
            cur = p[3]; i += 6
    return np.array(pts)


def bez(p, t):
    u = 1 - t
    return u ** 3 * p[0] + 3 * u * u * t * p[1] + 3 * u * t * t * p[2] + t ** 3 * p[3]


def resample(pts, step=STEP):
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < 1e-6: return pts[:1]
    n = max(2, int(round(s[-1] / step)) + 1)
    ss = np.linspace(0, s[-1], n)
    return np.stack([np.interp(ss, s, pts[:, 0]), np.interp(ss, s, pts[:, 1])], 1)


def length(p): return float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum()) if len(p) > 1 else 0.0


def smooth(p, sigma=SMOOTH):
    n = len(p); r = int(3 * sigma / STEP)
    if n < 5 or r < 1: return p.copy()
    k = np.exp(-0.5 * (np.arange(-r, r + 1) * STEP / sigma) ** 2); k /= k.sum()
    pad = np.concatenate([2 * p[0] - p[r:0:-1], p, 2 * p[-1] - p[-2:-r - 2:-1]])  # odd reflection keeps the ends and their direction
    out = np.stack([np.convolve(pad[:, j], k, "valid") for j in range(2)], 1)
    out[0], out[-1] = p[0], p[-1]
    return out


def unit(v):
    n = np.linalg.norm(v); return v / n if n > 1e-9 else v


# ---------- 1. cut at the turns back
def cusps(p):
    w = max(1, int(CUSP_W / STEP)); out = []
    ang = np.zeros(len(p))
    for i in range(w, len(p) - w):
        a, b = p[i] - p[i - w], p[i + w] - p[i]
        if np.linalg.norm(a) < 1e-6 or np.linalg.norm(b) < 1e-6: continue
        ang[i] = math.degrees(math.acos(np.clip(np.dot(unit(a), unit(b)), -1, 1)))
    i = 0
    while i < len(p):
        if ang[i] >= CUSP_DEG:
            j = i
            while j + 1 < len(p) and ang[j + 1] >= CUSP_DEG * 0.6: j += 1
            out.append(i + int(np.argmax(ang[i:j + 1]))); i = j + 1
        else: i += 1
    return out


def cut_loops(p):
    n = len(p); i = 0; keep = []
    w = int(1.0 / STEP); lmax = int(LOOP / STEP)
    while i < n:
        keep.append(i)
        jj = None
        for j in range(i + w * 2, min(n, i + lmax)):
            if np.linalg.norm(p[j] - p[i]) < 0.35:
                q = p[i:j + 1]; area = 0.5 * abs(np.dot(q[:, 0], np.roll(q[:, 1], 1)) - np.dot(q[:, 1], np.roll(q[:, 0], 1)))
                if area > 1.5: jj = j  # a real loop encloses something; going back along the same line (a retrace) does not
        i = jj if jj is not None else i + 1
    return p[keep]


def pieces(p):
    p = cut_loops(p)
    cuts = [0] + cusps(p) + [len(p) - 1]
    ps = [p[a:b + 1] for a, b in zip(cuts, cuts[1:]) if b > a]
    # knots: a short piece between two others goes; its neighbours meet halfway between where they stopped
    changed = True
    while changed and len(ps) > 1:
        changed = False
        for k, q in enumerate(ps):
            if length(q) < KNOT:
                if 0 < k < len(ps) - 1:
                    m = (ps[k - 1][-1] + ps[k + 1][0]) / 2
                    ps[k - 1] = np.vstack([ps[k - 1][:-1], m]); ps[k + 1] = np.vstack([m, ps[k + 1][1:]])
                del ps[k]; changed = True; break
    return [resample(q) for q in ps]


# ---------- 2. lines inside a piece
def chord_dev(q):
    a, b = q[0], q[-1]; d = unit(b - a)
    if np.linalg.norm(b - a) < 1e-6: return 1e9
    v = q - a; return float(np.abs(v[:, 0] * d[1] - v[:, 1] * d[0]).max())


def kind_of(d):
    ang = abs(math.degrees(math.atan2(d[1], d[0]))) % 180
    if abs(ang - 90) <= VERT_DEG: return "v"
    if min(ang, 180 - ang) <= HORIZ_DEG: return "h"
    return "l"


def run_ok(seg):
    L = length(seg)
    if L < min(STEM_MIN, BAR_MIN): return False
    k = kind_of(unit(seg[-1] - seg[0]))
    if k == "l" and (CUR in BOWED_SLANTS or CUR in ELLIPSE_BOWS): return False
    if k == "v" and CUR in ANGLED_LEAVE and seg[-1][1] < seg[0][1]: return False  # n m: nothing goes back up a stem -- the way up is the bow from the foot
    if k == "v" and CUR in ELLIPSE_BOWS and L < 30: return False  # D's belly has no upright stretch: one arc (the stem is its own stroke)
    tol, mn = {"v": (STEM_TOL, STEM_MIN), "h": (LONG_TOL if L >= LONG_MIN else BAR_TOL, BAR_MIN), "l": (LONG_TOL if L >= LONG_MIN else LINE_TOL, LINE_MIN)}[k]
    return L >= mn and chord_dev(seg) <= tol


def turning(q):
    """Total signed turn of a piece, degrees (an oval: about 360)."""
    sm = smooth(q, 2.0); d = np.diff(sm[::5], axis=0)
    a = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
    return float(np.degrees(a[-1] - a[0])) if len(a) > 1 else 0.0


def line_runs(q):
    """Maximal straight runs (index ranges) in a piece, the longest first. In an oval (the piece turns OVAL_TURN or more: O Q C G o) a
    flat stretch of the hand is still the oval's side: only a real stem (OVAL_STEM long, d's) is a line there."""
    n = len(q); cands = []
    min_len = OVAL_STEM if abs(turning(q)) >= OVAL_TURN else 0
    lo = int(min(STEM_MIN, BAR_MIN) / STEP)
    for i in range(0, n - lo, 2):
        best = None; j = i + lo
        while j < n:
            seg = q[i:j + 1]
            if run_ok(seg): best = j
            elif chord_dev(seg) > 2 * STEM_TOL: break
            j += 2
        if best is not None: cands.append((best - i, i, best))
    taken = np.zeros(n, bool); runs = []
    cands = [c for c in cands if length(q[c[1]:c[2] + 1]) >= min_len]
    # a level line only at a piece's end (the bars of B D P R Z z start or end a stroke or a turn back); a level stretch in the middle of
    # a bow is the bow's round bottom or top, never a line (S, owner 2026-11-08: «не спрямлять круглые»)
    edge = int(FRAG / STEP)
    cands = [c for c in cands if kind_of(unit(q[c[2]] - q[c[1]])) != "h" or c[1] <= edge or c[2] >= n - 1 - edge]
    for _, i, j in sorted(cands, reverse=True):
        if taken[i:j + 1].any(): continue
        taken[i:j + 1] = True; runs.append((i, j))
    return sorted(runs)


def fit_line(seg):
    c = seg.mean(0); u, s, vt = np.linalg.svd(seg - c); d = vt[0]
    if np.dot(d, seg[-1] - seg[0]) < 0: d = -d
    k = kind_of(d)
    if k == "v": d = np.array([0.0, math.copysign(1, d[1])]); c = np.array([np.median(seg[:, 0]), c[1]])
    if k == "h": d = np.array([math.copysign(1, d[0]), 0.0]); c = np.array([c[0], np.median(seg[:, 1])])
    proj = lambda pnt: c + d * np.dot(pnt - c, d)
    return {"type": "line", "a": proj(seg[0]), "b": proj(seg[-1]), "dir": d, "kind": k}


# ---------- 3. curves through anchors
def extrema(q):
    """Indices of tops / bottoms (axis 1) and sides (axis 0) that stand out by PROM, away from the ends."""
    out = []; n = len(q); w = int(2.0 / STEP); edge = int(1.5 / STEP)
    for ax in (0, 1):
        for sgn in (1, -1):
            v = sgn * q[:, ax]
            for i in range(edge, n - edge):
                if v[i] < v[max(0, i - w):i + w + 1].max() - 1e-9: continue
                prom = PROM_WHOLE if WHOLE else PROM
                if v[i] - v[:i].min() >= prom and v[i] - v[i + 1:].min() >= prom:
                    if not any(abs(i - j) < int(1.5 / STEP) and a == ax for j, a, _ in out): out.append((i, ax, sgn))
    out.sort()
    # two bottoms (or two tops) in a row, with no top (bottom) between them, are one round bottom that the hand wobbled: keep the deeper
    # one. Both would be put onto the line and the stretch between them drawn straight -- a round letter flattened (S, owner 2026-11-08:
    # «не спрямлять круглые»)
    merged = []
    for e in out:
        if e[1] == 1:
            prev = next((m for m in reversed(merged) if m[1] == 1), None)
            if prev is not None and prev[2] == e[2]:
                if e[2] * q[e[0], 1] > prev[2] * q[prev[0], 1]: merged[merged.index(prev)] = e
                continue
        merged.append(e)
    res = []
    gap = int(4.0 / STEP)
    for i, ax, _ in merged:
        if res and i - res[-1][0] < gap:
            if res[-1][1] == 0 and ax == 1: res[-1] = (i, ax)  # a top / bottom wins over a side next to it
            continue
        res.append((i, ax))
    return res


def fit_cubic(pts, p0, p3, t0, t1):
    """Least-squares handle lengths along fixed tangents (t1 points back from p3), chord-length parameters, handles clamped."""
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]); u = s / max(s[-1], 1e-9)
    b0, b1, b2, b3 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
    A1, A2 = np.outer(b1, t0), np.outer(b2, t1)
    C = np.array([[np.sum(A1 * A1), np.sum(A1 * A2)], [np.sum(A1 * A2), np.sum(A2 * A2)]])
    tmp = pts - np.outer(b0 + b1, p0) - np.outer(b2 + b3, p3)
    X = np.array([np.sum(A1 * tmp), np.sum(A2 * tmp)])
    dist = np.linalg.norm(p3 - p0)
    try: a0, a1 = np.linalg.solve(C, X)
    except np.linalg.LinAlgError: a0 = a1 = dist / 3
    lo, hi = 0.05 * dist, 1.2 * dist
    a0, a1 = float(np.clip(a0, lo, hi)), float(np.clip(a1, lo, hi))
    ctrl = [p0, p0 + a0 * t0, p3 + a1 * t1, p3]
    curve_pts = np.array([bez(ctrl, t) for t in np.linspace(0, 1, 80)])
    err = max(np.min(np.linalg.norm(curve_pts - x, axis=1)) for x in pts[::2])
    return ctrl, err


def snap_y(y, tol=SNAP):
    for L in LINES:
        if abs(y - L) <= tol: return L
    return y


def curve(q, t_start=None, t_end=None):
    """Cubics for one curved run q (ends fixed). t_start / t_end: tangents forced by an adjoining line."""
    sm = smooth(q)
    # a top / bottom near a ruling line is brought onto it by moving its whole neighbourhood smoothly (moving one point makes a notch)
    sarc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(sm, axis=0), axis=1))])
    taper = np.clip(np.minimum(sarc, sarc[-1] - sarc) / 2.0, 0, 1)  # the ends (joins) stay where they are
    for i, ax in extrema(sm):
        if ax != 1 or ORIGINAL: continue  # a bow taken from the original stays exactly where Nelson drew it
        if CUR in SHORT_TAIL and sm[i][1] > BASE: continue
        dy = snap_y(sm[i][1], SNAP_EXT) - sm[i][1]
        if dy: sm[:, 1] += dy * np.exp(-0.5 * ((sarc - sarc[i]) / 3.0) ** 2) * taper
    anchors = [(0, None)] + [(i, ax) for i, ax in extrema(sm)] + [(len(sm) - 1, None)]
    pos, tan = [], []
    for k, (i, ax) in enumerate(anchors):
        p = sm[i].copy()
        if ax is None:
            t = t_start if (k == 0 and t_start is not None) else t_end if (k == len(anchors) - 1 and t_end is not None) else None
            if t is None:
                w = int(1.5 / STEP)
                t = unit(sm[min(i + w, len(sm) - 1)] - sm[i]) if k == 0 else unit(sm[i] - sm[max(i - w, 0)])
        else:
            mv = sm[min(i + 2, len(sm) - 1)] - sm[max(i - 2, 0)]
            if ax == 1: t = np.array([math.copysign(1, mv[0]), 0.0])
            else: t = np.array([0.0, math.copysign(1, mv[1])])
        pos.append(p); tan.append(unit(t))
    pos[0], pos[-1] = q[0].copy(), q[-1].copy()
    # an end leaving a stem or a bar (its tangent forced along it) is like a side / a top of an oval: D's bow from its top bar is a quarter
    axes = [a for _, a in anchors]
    for k, t in ((0, t_start), (len(anchors) - 1, t_end)):
        if t is not None: axes[k] = 0 if abs(t[0]) < 1e-6 else 1 if abs(t[1]) < 1e-6 else None
    segs = []
    for k in range(len(anchors) - 1):
        i0, i1 = anchors[k][0], anchors[k + 1][0]
        segs += fit_span(sm[i0:i1 + 1], pos[k], pos[k + 1], tan[k], tan[k + 1], axes[k], axes[k + 1])
    return segs


def fit_span(pts, p0, p3, t0, t1, ax0, ax1, depth=0):
    # a quarter of an oval: from a side to a top / bottom (or back) -> a quarter of an ellipse
    if ax0 is not None and ax1 is not None and ax0 != ax1:
        dx, dy = abs(p3[0] - p0[0]), abs(p3[1] - p0[1])
        h0 = K_ELL * (dx if abs(t0[0]) > 0.5 else dy); h1 = K_ELL * (dx if abs(t1[0]) > 0.5 else dy)
        ctrl = [p0, p0 + h0 * t0, p3 - h1 * t1, p3]
        err = max(min(np.linalg.norm(bez(ctrl, t) - x) for t in np.linspace(0, 1, 60)) for x in pts[::3])
        if err <= QUARTER_TOL or CUR in ELLIPSE_BOWS: return [ctrl]
    ctrl, err = fit_cubic(pts, p0, p3, t0, -t1)
    ctrl = [ctrl[0], ctrl[1], ctrl[2], ctrl[3]]
    if err <= FIT_TOL or len(pts) < 12 or depth > 3: return [ctrl]
    m = len(pts) // 2
    tm = unit(pts[min(m + 3, len(pts) - 1)] - pts[max(m - 3, 0)])
    return fit_span(pts[:m + 1], p0, pts[m], t0, tm, None, None, depth + 1) + fit_span(pts[m:], pts[m], p3, tm, t1, None, None, depth + 1)


# ---------- a whole stroke
def trim_past(q, pnt, direction, from_end):
    """Drop the hand's overshoot past a turn back: only the run of points at the end (or start) that lies beyond `pnt` along
    `direction` (a curve may well go beyond it earlier on: G's arc rises far above its spur's top)."""
    past = np.dot(q - pnt, direction) > 0
    idx = range(len(q) - 1, -1, -1) if from_end else range(len(q))
    k = 0
    for i in idx:
        if not past[i]: break
        k += 1
    if k == 0 or k >= len(q) - 1: return q
    return q[:len(q) - k] if from_end else q[k:]


def bowed(a, b, sag):
    """One cubic from a to b sagging by `sag` in the middle (a parabola's: handles at the thirds, 4/3 of the sag off the chord)."""
    off = np.array([0.0, sag * 4 / 3])
    return [a, a + (b - a) / 3 + off, a + 2 * (b - a) / 3 + off, b]


def is_bar(p):
    ch = p[-1] - p[0]; L = length(p)
    return kind_of(unit(ch)) == "h" and L >= 6 and chord_dev(p) <= BAR_DEV * L


def tidy_stroke(raw, dotted=True, ends=None):
    p = resample(parse(raw))
    ext = p.max(0) - p.min(0)
    if max(ext) < DOT:
        if not dotted: return None  # a touch of the pen, not a dot (A came with one)
        c = (p.max(0) + p.min(0)) / 2
        return {"dot": c}
    # the ends moved onto a line / onto another stroke's end (stroke_ends) are put in AFTER the tidying (glyph()): moving them in the
    # hand's path first makes a jump there that the cutting at turns back reads as a turn (B's last bowl lost its bottom line)
    ch = p[-1] - p[0]; L = length(p)
    if is_bar(p):
        # bars stay where the hand put them (Nelson: t above the x-line by 0.17, f under it by 0.06) unless right at a line: the middle
        # bars of E F H are at 1.03 on the Nelson page and were traced at 60.9 / 61.8 / 61.2 -- all onto the x-line, the same height
        raw_p = resample(parse(raw))
        # a bowed bar is ONE simple arc (f, owner 2026-11-08: «у f точно просто изогнутую траекторию перемычки»; Nelson's f bar sags
        # 0.12 of the x-height in the middle, its ends on the x-line): its ends where the hand put them (onto a line when close), the
        # hand's sag in the middle
        ch = raw_p[-1] - raw_p[0]
        sag = raw_p[:, 1] - (raw_p[0][1] + (raw_p[:, 0] - raw_p[0][0]) * ch[1] / ch[0])
        s_mid = float(sag[np.argmax(np.abs(sag))])
        if abs(s_mid) >= BOW_BAR:
            a = np.array([raw_p[0][0], snap_y(raw_p[0][1], BAR_SNAP)]); b = np.array([raw_p[-1][0], snap_y(raw_p[-1][1], BAR_SNAP)])
            return {"segs": [bowed(a, b, s_mid)], "bar": True, "sag": s_mid}
        y = float(np.median(raw_p[:, 1])); y = snap_y(y, BAR_SNAP)
        a, b = np.array([p[0][0], y]), np.array([p[-1][0], y])
        return {"segs": [[a, a + (b - a) / 3, a + 2 * (b - a) / 3, b]], "bar": True}
    ps = pieces(p)
    # lines of every piece
    parts = []  # per piece: list of ("line", dict) / ("curve", points)
    for q in ps:
        runs = line_runs(q); items = []; last = 0
        frag = int(FRAG / STEP)
        runs = [(0 if i <= frag else i, len(q) - 1 if len(q) - 1 - j <= frag else j) for i, j in runs]
        for i, j in runs:
            if i > last: items.append(["curve", q[last:i + 1]])
            items.append(["line", fit_line(q[i:j + 1])]); last = j
        if last < len(q) - 1: items.append(["curve", q[last:]])
        if not items: items = [["curve", q]]
        parts.append(items)
    for k in range(1, len(parts)):
        prev = parts[k - 1][-1]; first = parts[k][0]
        if prev[0] == "line" and prev[1]["kind"] == "v" and first[0] == "curve":
            q = first[1]; x = prev[1]["b"][0]
            # the turn back is found within a small window, so the piece may begin with the last bit of the way down: skip it
            s0 = 0
            while s0 + 1 < len(q) and s0 * STEP < CUSP_W and (q[s0 + 1][1] - q[s0][1]) * prev[1]["dir"][1] > 0: s0 += 1
            m = s0
            on = 0.3 if CUR in ANGLED_LEAVE else 0.8  # n m: the arch grows from the stem's foot -- no retrace hugging the stem
            while m + 1 < len(q) and abs(q[m + 1][0] - x) <= on and (q[m + 1][1] - q[s0][1]) * prev[1]["dir"][1] <= 0: m += 1
            if m * STEP >= 2.0:
                ln = {"type": "line", "a": np.array([x, q[0][1]]), "b": np.array([x, q[m][1]]), "dir": -prev[1]["dir"], "kind": "v"}
                parts[k] = [["line", ln]] + ([["curve", q[m:]]] if m < len(q) - 1 else []) + parts[k][1:]
    # stems: a vertical line close to another one (the retrace) takes its x; ends near a ruling line stand on it
    verts = [it[1] for items in parts for it in items if it[0] == "line" and it[1]["kind"] == "v"]
    for k, a in enumerate(verts):
        for b in verts[:k]:
            if abs(a["a"][0] - b["a"][0]) <= 1.5: a["a"][0] = a["b"][0] = b["a"][0]
    for items in parts:
        for idx, (typ, it) in enumerate(items):
            if typ != "line": continue
            if it["kind"] == "v":
                if idx == 0: it["a"][1] = snap_y(it["a"][1])
                if idx == len(items) - 1: it["b"][1] = snap_y(it["b"][1])
            if it["kind"] == "h":  # onto the baseline / the top line from a little farther (D's bottom: 1.9), onto the x-line only when right at it (R)
                y = snap_y(it["a"][1], END_SNAP); y = y if y != X_LINE or abs(it["a"][1] - X_LINE) <= BAR_SNAP else it["a"][1]
                it["a"][1] = it["b"][1] = y
    for items in parts:
        for idx, (typ, it) in enumerate(items):
            if typ != "line": continue
            Lline = np.linalg.norm(it["b"] - it["a"]); t = min(TRIM, TRIM_PART * Lline)
            if idx > 0 and items[idx - 1][0] == "curve":
                na = it["a"] + it["dir"] * t
                items[idx - 1][1] = np.vstack([items[idx - 1][1], na]); it["a"] = na
            angled = CUR in ANGLED_LEAVE and it["kind"] == "v" and it["dir"][1] < 0  # n m: the arch leaves the stem on its own way
            if idx < len(items) - 1 and items[idx + 1][0] == "curve" and not angled:
                nb = it["b"] - it["dir"] * t
                items[idx + 1][1] = np.vstack([nb, items[idx + 1][1]]); it["b"] = nb
    # where two pieces meet (a turn back), one point: a line's end wins; a curve there runs along that line
    cusp_tan = {}
    for k in range(len(parts) - 1):
        A, B = parts[k][-1], parts[k + 1][0]
        # a stem or a bar (upright / level line) holds the turn on itself; a SLANTING line does not: the turn is where the hand turned
        # (k's loop turns 3.4 left of where its leg's line would start -- taking the line's start left a little hook there)
        if A[0] == "line" and (A[1]["kind"] != "l" or B[0] == "line"): pnt = A[1]["b"].copy()
        elif B[0] == "line" and (B[1]["kind"] != "l" or A[0] == "line"): pnt = B[1]["a"].copy()
        elif A[0] == "line": pnt = B[1][0].copy()
        elif B[0] == "line": pnt = A[1][-1].copy()
        else: pnt = (A[1][-1] + B[1][0]) / 2
        if CUR not in FREE_TURN: pnt[1] = snap_y(pnt[1], END_SNAP)  # a turn back on a line stands on it: the points of v and w, the tops of u and y
        if A[0] == "line": A[1]["b"] = pnt
        else:
            q = A[1]
            if B[0] == "line":
                back = -B[1]["dir"]
                q = trim_past(q, pnt, back, from_end=True)
            A[1] = np.vstack([q, pnt]) if np.linalg.norm(q[-1] - pnt) > 1e-6 else q
        if B[0] == "line":
            B[1]["a"] = pnt
        else:
            q = B[1]
            if A[0] == "line":
                fwd = -A[1]["dir"]
                q = trim_past(q, pnt, -fwd, from_end=False)
            B[1] = np.vstack([pnt, q]) if np.linalg.norm(q[0] - pnt) > 1e-6 else q
    # into cubics, the curves fitted between their neighbours' ends with their directions
    segs = []
    for pk, items in enumerate(parts):
        for idx, (typ, it) in enumerate(items):
            if typ == "line":
                a, b = it["a"], it["b"]; segs.append([a, a + (b - a) / 3, a + 2 * (b - a) / 3, b]); continue
            q = it.copy(); ts = te = None
            if idx > 0 and items[idx - 1][0] == "line":
                q[0] = items[idx - 1][1]["b"]
                prev = items[idx - 1][1]
                if not (CUR in ANGLED_LEAVE and prev["kind"] == "v" and prev["dir"][1] < 0): ts = prev["dir"]
            if idx < len(items) - 1 and items[idx + 1][0] == "line": q[-1] = items[idx + 1][1]["a"]; te = items[idx + 1][1]["dir"]
            if idx == 0 and (pk, "start") in cusp_tan: ts = cusp_tan[(pk, "start")]
            if idx == len(items) - 1 and (pk, "end") in cusp_tan: te = cusp_tan[(pk, "end")]
            segs += curve(resample(q), ts, te)
    return {"segs": segs}


# ---------- into the engine's frame
TOOL = False  # --tool: stay in the capture tool's units (for the review sheet)


CAP_K = 2 * (1 + UPPER) / (1 + NELSON)  # a capital / digit: whole, its top (the Nelson ascender) onto the pupil books' ascender


def to_engine(x, y, whole=False):
    if TOOL: return x, y
    if whole: return x * CAP_K, 62 + (y - BASE) * CAP_K
    y2 = (y - BASE) * 2 + 62
    if y < X_LINE: y2 = 10 - (X_LINE - y) * 2 * UPPER / NELSON
    if y > BASE: y2 = 62 + (y - BASE) * 2 * LOWER / NELSON
    return x * 2, y2


def fmt(n): return f"{round(n, 2):g}"


def stroke_ends(cap):
    """The ends of every stroke, moved: onto a ruling line when close, and ends of different strokes close together onto one point."""
    ends, bars = [], set()
    for i, s in enumerate(cap["strokes"]):
        p = resample(parse(s["d"])); ends.append([p[0].copy(), p[-1].copy()] if max(p.max(0) - p.min(0)) >= DOT else None)
        if ends[-1] and is_bar(p): bars.add(i)
    # a bar does not pull a stem's end to itself (E, F, H): it is put onto the stem after (glyph())
    flat = [(i, j) for i, e in enumerate(ends) if e and i not in bars for j in (0, 1)]
    for a in range(len(flat)):
        for b in range(a + 1, len(flat)):
            (i, j), (k, m) = flat[a], flat[b]
            if i != k and np.linalg.norm(ends[i][j] - ends[k][m]) <= MEET:
                mid = (ends[i][j] + ends[k][m]) / 2; ends[i][j] = mid.copy(); ends[k][m] = mid.copy()
    for e in ends:
        if e:
            for pnt in e:
                pnt[1] = LINES[0] if abs(pnt[1] - LINES[0]) <= SNAP else snap_y(pnt[1], END_SNAP)  # b, k were traced up to the tool's line 2
    return ends


CUR = None  # the label being tidied
WHOLE = False  # ... and whether it is a capital / digit


def tidy_glyph(cap):
    """The capture's strokes tidied, in the tool's units: [{"segs": [[p0, p1, p2, p3], ...]} | {"dot": c}]."""
    global CUR, WHOLE
    CUR = cap["label"]; WHOLE = not CUR.islower()
    dotted = cap["label"] in DOTTED
    whole = not cap["label"].islower()
    ends = stroke_ends(cap)
    strokes = []
    for i, s in enumerate(cap["strokes"]):
        st = tidy_stroke(s["d"], dotted, ends[i])
        if st is None: continue
        if "segs" in st and ends[i] and not st.get("bar"):  # the ends where they were put (a knot cut at the very start would move them): the next handle moves along
            for seg, k, h in ((st["segs"][0], 0, 1), (st["segs"][-1], 3, 2)):
                d = ends[i][0 if k == 0 else 1] - seg[k]
                if abs(seg[0][1] - seg[3][1]) < 1e-6 and abs(seg[1][1] - seg[0][1]) < 1e-6: d[1] = 0  # a horizontal line moves only along itself
                if abs(seg[0][0] - seg[3][0]) < 1e-6 and abs(seg[1][0] - seg[0][0]) < 1e-6: d[0] = 0  # ... a vertical one too
                seg[k] = seg[k] + d; seg[h] = seg[h] + d
        # a closed oval (O o Q): the hand overshoots its start a little; the end is put onto the start, going on the way it began
        if "segs" in st and not st.get("bar") and len(st["segs"]) > 2:
            a, z = st["segs"][0], st["segs"][-1]
            if np.linalg.norm(z[3] - a[0]) <= CLOSE:
                z[2] = a[0] - (a[1] - a[0]) * (np.linalg.norm(z[2] - z[3]) / max(np.linalg.norm(a[1] - a[0]), 1e-6)); z[3] = a[0].copy()
        strokes.append(st)
    stems = [seg[0][0] for st in strokes for seg in st.get("segs", []) if not st.get("bar") and abs(seg[0][0] - seg[3][0]) < 1e-6 and abs(seg[3][1] - seg[0][1]) > 8]
    for st in strokes:
        if not st.get("bar"): continue
        seg = st["segs"][0]
        for k in (0, 3):
            near = [x for x in stems if abs(x - seg[k][0]) <= STEM_MEET]
            if near: seg[k][0] = min(near, key=lambda x: abs(x - seg[k][0]))
        st["segs"][0] = bowed(seg[0], seg[3], st.get("sag", 0.0))
    return strokes


# bowls drawn after the ORIGINAL (owner, 2026-11-08: b «аккуратно подтянуть овал к линии оригинала», then p; of the variants shown
# the owner chose this one for both): the bowl is the edge of the Nelson bowl's hole on the underlay moved out by half the pen -- the
# middle of its stroke, reliable all round, landing on the stem's middle where the bowl's ink runs into the stem's -- put where the hand
# put the underlay (its stem onto the traced stem). It leaves the stem and comes back into it where that line does; the stem (and b's
# retrace up it) stay the hand's. Not pulled onto the lines: it is the original.
ORIGINAL_BOWL = set("bpPR")
BAR_END = 0.65  # P, R: where the bars end and the belly starts turning, of the belly's width  # P (owner, 2026-11-09: «шлифуем O, Q и P по такому же принципу»): its bowl is p's, from the capital's underlay
ORIGINAL = False  # set while a bowl from the original is drawn
UNDERLAYS = Path(__file__).resolve().parent / "underlays" / "british"
UL_PX, UL_X = 8, 100.0  # the underlay: 8 px a unit, put at x = 100 in the tool
HALF_INK = 3.25 * 26 / 44  # half the Nelson stroke, tool units


def original_bowl_from_hole(label, stem_x, start, prefix="lo", clear=0.3):
    """The bowl's middle line as the hole's edge moved out by half the pen: reliable all round, also where the bowl's ink runs into the
    stem's (there it lands on the stem's middle). The bowl is the part of it off the stem, from where it leaves the stem to where it
    comes back, in the direction the hand went (`start`: the hand's first point of the bowl)."""
    from PIL import Image
    from collections import deque
    a = np.array(Image.open(UNDERLAYS / f"{prefix}_{label}.png"))[:, :, 3] > 128
    h, w = a.shape
    cols = np.nonzero(a.any(0))[0]; dx = stem_x - (UL_X + cols[0] / UL_PX + HALF_INK)
    out = np.zeros_like(a); q = deque((y, x) for y in range(h) for x in (0, w - 1))
    q.extend((y, x) for x in range(w) for y in (0, h - 1))
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not a[y, x] and not out[y, x]:
            out[y, x] = True; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    hy, hx = np.nonzero(~a & ~out); cy, cx = hy.mean(), hx.mean()
    half = HALF_INK * UL_PX
    ring = []
    for t in np.linspace(-np.pi, np.pi, 721)[:-1]:
        r = 0.0
        while r < 400:
            x, y = int(round(cx + r * np.cos(t))), int(round(cy + r * np.sin(t)))
            if a[y, x]: break
            r += 0.25
        m = r + half
        ring.append((UL_X + (cx + m * np.cos(t)) / UL_PX + dx, (cy + m * np.sin(t)) / UL_PX))
    ring = np.array(ring)
    off = ring[:, 0] > stem_x + clear  # off the stem (P: its hole has round inner corners -- off it only past the stem's ink)
    # the longest run of the ring off the stem (going round, the ring wraps)
    n = len(ring); best = (0, 0); i = 0
    while i < n:
        if off[i]:
            j = i
            while off[(j + 1) % n] and j - i < n: j += 1
            if j - i > best[1] - best[0]: best = (i, j)
            i = j + 1
        else: i += 1
    bowl = np.array([ring[k % n] for k in range(best[0] - 1, best[1] + 2)])
    bowl[0][0] = bowl[-1][0] = stem_x
    # the way round the hand went: start at the end nearer the hand's start
    if np.linalg.norm(bowl[-1] - start) < np.linalg.norm(bowl[0] - start): bowl = bowl[::-1]
    return bowl


def bowl_ring_from_hole(label, stem_x):
    """The middle line all round a bowl whose stem is on its RIGHT (g): the hole's edge moved out by half the pen, the underlay put
    with its stem (the longest upright ink) on the traced stem. Returns ring points in the tool's units, or None."""
    from PIL import Image
    from collections import deque
    path = UNDERLAYS / f"lo_{label}.png"
    if not path.exists(): return None
    a = np.array(Image.open(path))[:, :, 3] > 128
    h, w = a.shape
    stem_col = int(np.argmax(a.sum(0)))
    run = np.nonzero(a[:, stem_col])[0]
    cols = [c for c in range(w) if a[run.mean().astype(int), c]]
    left = stem_col
    while left > 0 and a[int(run.mean()), left - 1]: left -= 1
    right = stem_col
    while right < w - 1 and a[int(run.mean()), right + 1]: right += 1
    dx = stem_x - (UL_X + (left + right) / 2 / UL_PX)
    out = np.zeros_like(a); q = deque((y, x) for y in range(h) for x in (0, w - 1))
    q.extend((y, x) for x in range(w) for y in (0, h - 1))
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not a[y, x] and not out[y, x]:
            out[y, x] = True; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    hy, hx = np.nonzero(~a & ~out)
    if not len(hy): return None
    cy, cx = hy.mean(), hx.mean(); half = HALF_INK * UL_PX; ring = []
    for t in np.linspace(-np.pi, np.pi, 721)[:-1]:
        r = 0.0
        while r < 400:
            x, y = int(round(cx + r * np.cos(t))), int(round(cy + r * np.sin(t)))
            if a[y, x]: break
            r += 0.25
        m = r + half
        ring.append((UL_X + (cx + m * np.cos(t)) / UL_PX + dx, (cy + m * np.sin(t)) / UL_PX))
    return np.array(ring)


def original_bowl(label, strokes):
    """b: the bowl goes on from the retrace up the stem (one stroke); p: the bowl is its own stroke starting on the stem."""
    vertical = lambda sg: all(abs(pt[0] - sg[0][0]) < 1e-6 for pt in sg)
    global ORIGINAL
    ORIGINAL = True
    try:
        for si, st in enumerate(strokes):
            segs = st.get("segs")
            if not segs: continue
            k = next((i for i, sg in enumerate(segs) if vertical(sg) and sg[0][1] - sg[3][1] > 3), None)  # a retrace up the stem
            if k is not None and k + 1 < len(segs):
                # b: the bowl as p's (owner, 2026-11-08, chose it from the two); the retrace up the stem runs to where it leaves
                xs = segs[k][0][0]
                pts = original_bowl_from_hole(label, xs, segs[k + 1][0])
                a0 = segs[k][0]; top = np.array([xs, pts[0][1]])
                st["segs"] = segs[:k] + [[a0, a0 + (top - a0) / 3, a0 + 2 * (top - a0) / 3, top]] + curve(resample(pts), None, None)
                return
        stems = [sg[0][0] for st in strokes for sg in st.get("segs", []) if vertical(sg) and abs(sg[3][1] - sg[0][1]) > 15]
        if not stems: return
        stem_x = stems[0]
        for st in strokes:
            segs = st.get("segs")
            if not segs or any(vertical(sg) and abs(sg[3][1] - sg[0][1]) > 15 for sg in segs): continue
            # the hand's start only tells which way round the bowl goes; where it leaves the stem is the original's
            pts = original_bowl_from_hole(label, stem_x, segs[0][0], *(("lo",) if label.islower() else ("up", HALF_INK)))
            if label.islower():
                st["segs"] = curve(resample(pts), None, None)
                return
            # P, R: straight bars at the original's heights (the top one on the ascender line), then the belly as two ellipse quarters
            # through the original's rightmost point. The bars end at BAR_END of the belly's width (owner, 2026-11-09: «пуза у R и P
            # закругляешь поздно, нужно раньше начинать» -- the original's middle line stays level to about 0.6 of it; of 0.65 / 0.6 /
            # 0.55 / 0.5 / 0.45 / 0.3, 0.45 «слишком рано», «чуть-чуть надо подвинуть назад»: 0.65)
            n = max(3, len(pts) // 20)
            y0 = snap_y(float(np.median(pts[:n, 1])), BAR_SNAP); y1 = float(np.median(pts[-n:, 1]))
            R = pts[int(np.argmax(pts[:, 0]))]
            xb = stem_x + BAR_END * (R[0] - stem_x)
            a0, a1, b0, b1 = np.array([stem_x, y0]), np.array([xb, y0]), np.array([xb, y1]), np.array([stem_x, y1])
            line = lambda p, q: [p, p + (q - p) / 3, p + 2 * (q - p) / 3, q]
            q1 = [a1, a1 + [K_ELL * (R[0] - xb), 0], R - [0, K_ELL * (R[1] - y0)], R.copy()]
            q2 = [R.copy(), R + [0, K_ELL * (y1 - R[1])], b0 + [K_ELL * (R[0] - xb), 0], b0]
            st["segs"] = [line(a0, a1), q1, q2, line(b0, b1)]
            return
    finally:
        ORIGINAL = False


# a d g q have ONE bowl (owner, 2026-11-08: «у g эта часть правильная и подходит и для a и для d и для q, отличия только в окончаниях»):
# g's bowl -- from the pen's start round to the top of its stem, where it arrives almost upright -- is put into a, d, q at their stems;
# each keeps its own ending: a the stem down and the flick, d up the stem to the ascender and down it, q the stem down and the tail right
SHARED_BOWL, BOWL_FROM = set("adq"), "g"
STEM_TOUCH = 0.6  # the bowl's right side has run into the stem this close to its middle


def first_stem_down(segs):
    for k, sg in enumerate(segs):
        if all(abs(pt[0] - sg[0][0]) < 1e-6 for pt in sg) and sg[3][1] - sg[0][1] > 8: return k
    return None


def share_bowl(tidied):
    src = tidied.get(BOWL_FROM)
    if not src: return
    gs = src[0]["segs"]; kg = first_stem_down(gs)
    bowl, joint = [[pt.copy() for pt in sg] for sg in gs[:kg]], gs[kg][0].copy()
    # the bowl after the original (owner, 2026-11-09: «у a, d, g, q правую сторону овала сделай точнее по линии оригинала»): the
    # middle of Nelson's g bowl -- its hole's edge moved out by half the pen -- from where the hand started, round, up the right side
    # until it runs into the stem, then up the stem to the joint
    global CUR, WHOLE, ORIGINAL
    CUR, WHOLE = BOWL_FROM, False
    ring = bowl_ring_from_hole(BOWL_FROM, joint[0])
    if ring is not None:
        start = gs[0][0]
        c = ring.mean(0)
        ang = np.arctan2(ring[:, 1] - c[1], ring[:, 0] - c[0])
        i0 = int(np.argmin(np.abs(np.angle(np.exp(1j * (ang - np.arctan2(start[1] - c[1], start[0] - c[0])))))))
        n = len(ring); path = []
        for k in range(n):  # the way the hand went: over the top to the left (the angle falling, y down)
            q = ring[(i0 - k) % n]
            if k > n // 4 and q[0] >= joint[0] - STEM_TOUCH: break
            path.append(q)
        path.append(np.array([joint[0], path[-1][1]])); path.append(joint.copy())
        ORIGINAL = True
        try: bowl = curve(resample(np.array(path)), None, np.array([0.0, -1.0]))
        finally: ORIGINAL = False
    src[0]["segs"] = [[pt.copy() for pt in sg] for sg in bowl] + gs[kg:]  # g itself
    for label in SHARED_BOWL:
        if label not in tidied: continue
        segs = tidied[label][0]["segs"]; k = first_stem_down(segs)
        xs = segs[k][0][0]; dx = np.array([xs - joint[0], 0.0])
        own = [[pt + dx for pt in sg] for sg in bowl]
        top = np.array([xs, joint[1]])
        start = segs[k][0]
        if start[1] < joint[1] - 2:  # d: on up the stem to the ascender first
            own.append([top, top + (start - top) / 3, top + 2 * (start - top) / 3, start.copy()])
        else:  # a, q: the stem begins where the bowl ends
            b = segs[k][3]; segs[k] = [top, top + (b - top) / 3, top + 2 * (b - top) / 3, b]
        tidied[label][0]["segs"] = own + segs[k:]


# g and y end with j's hook (owner, 2026-11-08: «нижний крюк влево удался только у j, примени такой же к g и y»): j's stem turns into
# its hook at the same height and the hook is j's, moved to the letter's own stem (made upright: y's leant a little)
SHARED_TAIL, TAIL_FROM = set("gy"), "j"


def share_tail(tidied):
    src = tidied.get(TAIL_FROM)
    if not src: return
    js = src[0]["segs"]; kj = first_stem_down(js)
    turn = js[kj][3].copy(); hook = [[pt.copy() for pt in sg] for sg in js[kj + 1:]]
    for label in SHARED_TAIL:
        if label not in tidied: continue
        segs = tidied[label][0]["segs"]
        # the descender: the long way down from the x-line (not necessarily exactly upright: y's)
        k = next((i for i, sg in enumerate(segs) if sg[3][1] - sg[0][1] > 25 and abs(sg[3][0] - sg[0][0]) < 2), None)
        if k is None: continue
        top = segs[k][0].copy(); xs = top[0]; bend = np.array([xs, turn[1]])
        dx = np.array([xs - turn[0], 0.0])
        tidied[label][0]["segs"] = segs[:k] + [[top, top + (bend - top) / 3, top + 2 * (bend - top) / 3, bend]] + [[pt + dx for pt in sg] for sg in hook]


# B's two bellies after the original (owner, 2026-11-09: «B нижнее пузо должно быть чуть больше, проверь по оригиналу»). Measured on
# the underlay: the middle bar's middle at 61.3 (above the x-line: the lower belly is the taller), the bellies' right sides (the middle
# of the stroke) 24.4 and 26.2 right of the stem's middle. The hand's bars keep their lengths; each belly is two ellipse quarters.
BELLIES_FROM_ORIGINAL = set("B")


def original_bellies(label):
    from PIL import Image
    a = np.array(Image.open(UNDERLAYS / f"up_{label}.png"))[:, :, 3] > 128
    cols = np.nonzero(a.any(0))[0]; c0 = cols[0]; stem_c = UL_X + c0 / UL_PX + HALF_INK
    right = lambda y0, y1: max(np.nonzero(a[y, :])[0].max() for y in range(int(y0 * UL_PX), int(y1 * UL_PX)) if a[y, :].any())
    upper = UL_X + right(BASE - 52, X_LINE) / UL_PX - HALF_INK - stem_c
    lower = UL_X + right(X_LINE, BASE + 2) / UL_PX - HALF_INK - stem_c
    span = slice(c0 + int(6 * UL_PX), c0 + int(12 * UL_PX))
    rows = [y / UL_PX for y in range(int(50 * UL_PX), int(75 * UL_PX)) if a[y, span].all()]
    return upper, lower, (min(rows) + max(rows)) / 2


def bellies_from_original(label, strokes):
    upper, lower, mid = original_bellies(label)
    stem = strokes[0]["segs"][0][0][0]
    segs = strokes[1]["segs"]
    if len(segs) != 8: return  # top bar, 2 quarters, bar in, bar out, 2 quarters, bottom bar
    quarter = lambda p0, p3, t0, t1: [p0, p0 + t0 * K_ELL * (abs(p3[0] - p0[0]) if abs(t0[0]) > 0.5 else abs(p3[1] - p0[1])),
                                      p3 - t1 * K_ELL * (abs(p3[0] - p0[0]) if abs(t1[0]) > 0.5 else abs(p3[1] - p0[1])), p3]
    top, bot = segs[0][0][1], segs[7][3][1]
    a = segs[0][3]; b = np.array([segs[2][3][0], mid]); c = np.array([segs[3][3][0], mid]); d = np.array([segs[4][3][0], mid])
    e = segs[7][0]
    ru = np.array([stem + upper, (top + mid) / 2]); rl = np.array([stem + lower, (mid + bot) / 2])
    L, R, U, D = np.array([-1.0, 0]), np.array([1.0, 0]), np.array([0, -1.0]), np.array([0, 1.0])
    line = lambda p, q: [p, p + (q - p) / 3, p + 2 * (q - p) / 3, q]
    strokes[1]["segs"] = [segs[0], quarter(a, ru, R, D), quarter(ru, b, D, L), line(b, c), line(c, d),
                          quarter(d, rl, R, D), quarter(rl, e, D, L), segs[7]]


# whole ovals after the ORIGINAL (owner, 2026-11-09: «шлифуем O, Q и P по такому же принципу» -- as a d g q): the middle line of
# Nelson's stroke all round, from the hole's edge out by half the pen and the outside edge in by half the pen (where the two disagree --
# Q's tail crosses the ring -- the radius is carried over from both sides). The underlay is put on the hand's oval (centre on centre:
# the owner moved it sideways while tracing); the pen starts where the hand started and goes round the way the hand went, back to the
# start. Q's tail: the ink off the ring, a straight line through its middle, ending half a pen short of the ink's ends.
OVALS_FROM_ORIGINAL = set("OQ")


def ink_ring(a):
    """Middle line of a ring of ink (alpha mask a) in underlay px: (centre, angles, radii)."""
    from collections import deque
    h, w = a.shape
    out = np.zeros_like(a); q = deque((y, x) for y in range(h) for x in (0, w - 1))
    q.extend((y, x) for x in range(w) for y in (0, h - 1))
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not a[y, x] and not out[y, x]:
            out[y, x] = True; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    hy, hx = np.nonzero(~a & ~out)
    cy, cx = hy.mean(), hx.mean(); half = HALF_INK * UL_PX
    ts = np.linspace(-np.pi, np.pi, 721)[:-1]; rin, rout = [], []
    for t in ts:
        c, s_ = np.cos(t), np.sin(t)
        r = 0.0
        while not a[int(round(cy + r * s_)), int(round(cx + r * c))]: r += 0.25
        rin.append(r)
        r = 0.0
        while True:  # the last ink along the ray
            x, y = int(round(cx + r * c)), int(round(cy + r * s_))
            if not (0 <= x < w and 0 <= y < h): break
            if a[y, x]: last = r
            r += 0.25
        rout.append(last)
    rin, rout = np.array(rin), np.array(rout)
    good = np.abs((rout - rin) - 2 * half) < 0.35 * 2 * half  # one stroke across: else the tail crosses here
    mid = (rin + rout) / 2
    idx = np.arange(len(ts))
    r = np.interp(idx, np.concatenate([idx[good] - len(ts), idx[good], idx[good] + len(ts)]), np.tile(mid[good], 3))
    return np.array([cx, cy]), ts, r, good


def oval_from_original(label, strokes):
    from PIL import Image
    a = np.array(Image.open(UNDERLAYS / f"up_{label}.png"))[:, :, 3] > 128
    (cx, cy), ts, r, good = ink_ring(a)
    ring_px = np.stack([cx + r * np.cos(ts), cy + r * np.sin(ts)], 1)
    hand = np.array([pt for sg in strokes[0]["segs"] for pt in sg])
    dx = (hand[:, 0].min() + hand[:, 0].max()) / 2 - (UL_X + (ring_px[:, 0].min() + ring_px[:, 0].max()) / 2 / UL_PX)
    ring = np.stack([UL_X + ring_px[:, 0] / UL_PX + dx, ring_px[:, 1] / UL_PX], 1)
    start = strokes[0]["segs"][0][0]; nxt = strokes[0]["segs"][0][3]
    c = ring.mean(0); ang = lambda p: np.arctan2(p[1] - c[1], p[0] - c[0])
    i0 = int(np.argmin(np.abs(np.angle(np.exp(1j * (ts - ang(start)))))))
    step = 1 if np.angle(np.exp(1j * (ang(nxt) - ang(start)))) > 0 else -1
    n = len(ring); path = [ring[(i0 + step * k) % n] for k in range(n + 1)]
    global ORIGINAL
    ORIGINAL = True
    try: strokes[0]["segs"] = curve(resample(np.array(path)), None, None)
    finally: ORIGINAL = False
    if label == "Q" and len(strokes) > 1:
        # the tail: ink farther than the pen from the ring's middle line
        ys, xs = np.nonzero(a)
        pr = np.hypot(xs - cx, ys - cy); pt_ = np.arctan2(ys - cy, xs - cx)
        rr = np.interp(pt_, ts, r, period=2 * np.pi)
        tail = np.stack([xs, ys], 1)[np.abs(pr - rr) > HALF_INK * UL_PX + 2].astype(float)
        m = tail.mean(0); u = np.linalg.svd(tail - m)[2][0]
        if u[1] < 0: u = -u  # down the tail
        pr_ = (tail - m) @ u
        e0, e1 = m + u * (pr_.min() + HALF_INK * UL_PX), m + u * (pr_.max() - HALF_INK * UL_PX)
        P = lambda q: np.array([UL_X + q[0] / UL_PX + dx, q[1] / UL_PX])
        p0, p1 = P(e0), P(e1)
        strokes[1]["segs"] = [[p0, p0 + (p1 - p0) / 3, p0 + 2 * (p1 - p0) / 3, p1]]


# arches after the ORIGINAL (owner, 2026-11-09: «подогнать к оригиналу n и m»): the middle line of Nelson's stroke is the underlay's
# ink thinned to one pixel (Zhang-Suen); the hand's path gives the order and the waypoints -- the stem's top and foot, where it leaves
# the stem for the arch (retrace end), the foot of m's middle stem, the end -- and between a waypoint where the pen leaves a stem and
# the next one the path is the original's middle line (the shortest way along the thinned ink). The stems stay the hand's; the whole
# path is then tidied like any capture.
ARCHES_FROM_ORIGINAL = set("nmh")
ANGLED_LEAVE = ARCHES_FROM_ORIGINAL  # the arch leaves the stem at an angle, as Nelson's ink shows, not along it
FOOT_LEAN, FOOT_BOW_H = 0.15, 0.35  # the bow leaves the foot leaning a little right and bends evenly (not upright for long)
ARCH_CLEAR = 5.0  # how far from the stem the bow from the foot meets the original's arch (where the owner's drawn line joins it)


def thin(img):
    """Zhang-Suen thinning (vectorised): the ink -> its one-pixel middle line."""
    a = np.pad(img.astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            p2, p3, p4, p5, p6, p7, p8, p9 = [np.roll(np.roll(a, dy, 0), dx, 1) for dy, dx in
                                              ((1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1))]
            nb = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            trans = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            c1, c2 = (p2 * p4 * p6, p4 * p6 * p8) if step == 0 else (p2 * p4 * p8, p2 * p6 * p8)
            m = (a == 1) & (nb >= 2) & (nb <= 6) & (trans == 1) & (c1 == 0) & (c2 == 0)
            if m.any(): a[m] = 0; changed = True
        if not changed: break
    return a[1:-1, 1:-1].astype(bool)


def skeleton_route(sk, a_px, b_px):
    """The shortest way along the one-pixel line between two of its pixels (8-connected BFS)."""
    from collections import deque
    prev = {a_px: None}; q = deque([a_px])
    while q:
        y, x = q.popleft()
        if (y, x) == b_px: break
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                n = (y + dy, x + dx)
                if n not in prev and 0 <= n[0] < sk.shape[0] and 0 <= n[1] < sk.shape[1] and sk[n]:
                    prev[n] = (y, x); q.append(n)
    path, c = [], b_px
    while c is not None: path.append(c); c = prev.get(c)
    return path[::-1]


def arches_from_original(cap, tidied_strokes):
    from PIL import Image
    a = np.array(Image.open(UNDERLAYS / f"lo_{cap['label']}.png"))[:, :, 3] > 128
    sk = thin(a)
    segs = tidied_strokes[0]["segs"]
    vertical = lambda sg: all(abs(pt[0] - sg[0][0]) < 1e-6 for pt in sg)
    stem_x = segs[0][0][0]
    cols = np.nonzero(a.any(0))[0]; dx = stem_x - (UL_X + cols[0] / UL_PX + HALF_INK)
    to_px = lambda pnt: ((pnt[1]) * UL_PX, (pnt[0] - dx - UL_X) * UL_PX)
    to_tool = lambda yx: np.array([UL_X + yx[1] / UL_PX + dx, yx[0] / UL_PX])
    skp = np.argwhere(sk)
    nearest = lambda pnt: tuple(skp[np.argmin(((skp - np.array(to_px(pnt))) ** 2).sum(1))])
    # waypoints of the hand: the start, every turn back, every end of a retrace up a stem, the end
    way = [("pt", segs[0][0])]
    for i, sg in enumerate(segs):
        nxt = segs[i + 1] if i + 1 < len(segs) else None
        if nxt is None: way.append(("end", sg[3]))
        elif vertical(sg) and sg[3][1] < sg[0][1] - 3 and not vertical(nxt): way.append(("leave", sg[3]))  # retrace up -> arch
        elif vertical(sg) and sg[3][1] > sg[0][1] and vertical(nxt) and nxt[3][1] < nxt[0][1]: way.append(("pt", sg[3]))  # a foot
        elif vertical(sg) and sg[3][1] > sg[0][1] and nxt[3][1] < nxt[0][1] - 3:  # a foot the hand left straight for the arch (h)
            way.append(("pt", sg[3])); way.append(("leave", sg[3]))
    pts = [way[0][1]]
    for (k0, p0), (k1, p1) in zip(way, way[1:]):
        if k0 == "leave":
            # owner, 2026-11-09 (drawn over n and m): the arch grows from the stem's FOOT -- from the bottom one gentle bow, upright at
            # first and bending more and more to the right, into the original's middle line where the arch is clear of the stem
            # (ARCH_CLEAR); the same for m's second arch from the foot of its middle stem. No retrace up the stem any more.
            pts.pop()  # the hand's leave point on the stem: not used -- the bow starts at the foot (the previous waypoint)
            F = pts[-1]
            route = [to_tool(yx) for yx in skeleton_route(sk, nearest(p0), nearest(p1))]
            r0 = next(i for i, q in enumerate(route) if q[0] >= p0[0] + ARCH_CLEAR and q[1] < X_LINE + 8)
            R0, tR = route[r0], unit(route[min(r0 + 8, len(route) - 1)] - route[r0])
            h = FOOT_BOW_H * np.linalg.norm(R0 - F)
            bow = [F, F + unit(np.array([FOOT_LEAN, -1.0])) * h, R0 - tR * h, R0]
            pts += [bez(bow, t) for t in np.linspace(0, 1, 24)[1:]] + route[r0 + 1:]
        else:
            pts.append(p1)
    d = "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts)
    return {**cap, "strokes": [{"d": d}]}


# C and G after the ORIGINAL (owner, 2026-11-09: «да, сделай C, G и R», after O Q P): open bows have no hole, so their middle line is
# the thinned ink (as n m's arches). The underlay is put centre on centre of the hand's letter; the pen goes along the thinned ink from
# the hand's start to its end, the ends brought back to half a pen from the ink's tips. G: round to the right side and up it, into its
# stem (STEM_TOUCH), up the stem to its top and straight down it to the baseline, as the hand went.
OPEN_FROM_ORIGINAL = set("CGSJU")
STEM_LEAVE = 0.35  # J U: the thinned ink has left the stem's line by this much: the bow begins


def underlay_frame(label, hand):
    """The capital's underlay, its thinned ink and the maps tool <-> underlay px, put centre on centre of the hand's points."""
    from PIL import Image
    a = np.array(Image.open(UNDERLAYS / f"up_{label}.png"))[:, :, 3] > 128
    cols = np.nonzero(a.any(0))[0]
    dx = (hand[:, 0].min() + hand[:, 0].max()) / 2 - (UL_X + (cols[0] + cols[-1]) / 2 / UL_PX)
    to_px = lambda pnt: np.array([pnt[1] * UL_PX, (pnt[0] - dx - UL_X) * UL_PX])
    to_tool = lambda yx: np.array([UL_X + yx[1] / UL_PX + dx, yx[0] / UL_PX])
    return a, dx, to_px, to_tool


def trim_tip(route, a, to_px):
    """The route's last point onto the stroke's middle end: half a pen back from the ink's tip along the way it goes."""
    t = unit(route[-1] - route[-min(8, len(route))])
    d = 0.0
    while True:
        y, x = to_px(route[-1] + t * d).round().astype(int)
        if not (0 <= y < a.shape[0] and 0 <= x < a.shape[1]) or not a[y, x]: break
        d += 0.05
    cut = HALF_INK - d  # the skeleton ran this much too far towards the tip
    while cut > 0 and len(route) > 2:
        step = np.linalg.norm(route[-1] - route[-2])
        if step > cut: route[-1] = route[-1] + unit(route[-2] - route[-1]) * cut; break
        route.pop(); cut -= step
    return route


def open_from_original(label, strokes):
    segs = strokes[0]["segs"]
    hand = np.array([pt for sg in segs for pt in sg])
    a, dx, to_px, to_tool = underlay_frame(label, hand)
    sk = thin(a); skp = np.argwhere(sk)
    nearest = lambda pnt: tuple(skp[np.argmin(((skp - to_px(pnt)) ** 2).sum(1))])
    start = segs[0][0]
    global ORIGINAL
    if label != "G":
        route = [to_tool(yx) for yx in skeleton_route(sk, nearest(start), nearest(segs[-1][3]))]
        route = trim_tip(trim_tip(route[::-1], a, to_px)[::-1], a, to_px)
        # J U: an end that runs straight up and down is a stem -- upright, at the middle of its ink, its tip on the ruling line;
        # the bow leaves it upright where the thinned ink leaves its line (owner, 2026-11-09: «S, J и U по такому же принципу»)
        stems = []
        for r in (route, route[::-1]):
            head = np.array(r[:int(8 / 0.125)])
            if abs(head[-1][0] - head[0][0]) > 0.8 or abs(head[-1][1] - head[0][1]) < 6: stems.append(None); continue
            sx = float(np.median(head[:, 0]))
            k = next(i for i, q in enumerate(r) if abs(q[0] - sx) > STEM_LEAVE)
            stems.append((np.array([sx, snap_y(r[0][1], END_SNAP)]), np.array([sx, r[k][1]]), k))
        lo, hi = (stems[0][2] if stems[0] else 0), len(route) - (stems[1][2] if stems[1] else 0)
        mid = route[lo:hi]
        if stems[0]: mid = [stems[0][1]] + mid[1:]
        if stems[1]: mid = mid[:-1] + [stems[1][1]]
        down = lambda st: np.array([0.0, 1.0]) if st[1][1] > st[0][1] else np.array([0.0, -1.0])
        line = lambda p, q: [p, p + (q - p) / 3, p + 2 * (q - p) / 3, q]
        ORIGINAL = True
        try:
            bow = curve(resample(np.array(mid)), down(stems[0]) if stems[0] else None, -down(stems[1]) if stems[1] else None)
        finally: ORIGINAL = False
        strokes[0]["segs"] = ([line(stems[0][0], stems[0][1])] if stems[0] else []) + bow + \
                             ([line(stems[1][1], stems[1][0])] if stems[1] else [])
        return
    # G: the stem is the hand's last (straight down) piece
    top, foot = segs[-1][0], segs[-1][3]
    up = [to_tool(yx) for yx in skeleton_route(sk, nearest(start), nearest(top))]
    down = [to_tool(yx) for yx in skeleton_route(sk, nearest(top), nearest(foot))]
    stem_x = float(np.median([q[0] for q in down]))
    up = trim_tip(up[::-1], a, to_px)[::-1]
    k = next(i for i, q in enumerate(up) if i > len(up) // 2 and q[0] >= stem_x - STEM_TOUCH)
    y_top, y_foot = snap_y(up[-1][1], END_SNAP), snap_y(max(q[1] for q in down), END_SNAP)
    path = up[:k] + [np.array([stem_x, up[k][1]]), np.array([stem_x, y_top])]
    ORIGINAL = True
    try: bow = curve(resample(np.array(path)), None, np.array([0.0, -1.0]))
    finally: ORIGINAL = False
    p0, p1 = np.array([stem_x, y_top]), np.array([stem_x, y_foot])
    strokes[0]["segs"] = bow + [[p0, p0 + (p1 - p0) / 3, p0 + 2 * (p1 - p0) / 3, p1]]


# R's leg after the ORIGINAL (with its bowl -- P's, ORIGINAL_BOWL): a straight line through the middle of the leg's ink, from the
# bowl's lower bar to half a pen short of the ink's foot (on the baseline when near)
def leg_from_original(label, strokes):
    from PIL import Image
    stem_x = strokes[0]["segs"][0][0][0]
    a = np.array(Image.open(UNDERLAYS / f"up_{label}.png"))[:, :, 3] > 128
    cols = np.nonzero(a.any(0))[0]; dx = stem_x - (UL_X + cols[0] / UL_PX + HALF_INK)
    bar_y = strokes[1]["segs"][-1][3][1]
    ys, xs = np.nonzero(a)
    tx, ty = UL_X + xs / UL_PX + dx, ys / UL_PX
    leg = np.stack([tx, ty], 1)[(ty > bar_y + HALF_INK + 1) & (tx > stem_x + 2 * HALF_INK + 1)]
    m = leg.mean(0); u = np.linalg.svd(leg - m)[2][0]
    if u[1] < 0: u = -u
    pr = (leg - m) @ u
    p1 = m + u * (pr.max() - HALF_INK)
    p1 = m + u * ((snap_y(p1[1], END_SNAP) - m[1]) / u[1])
    p0 = m + u * ((bar_y - m[1]) / u[1])
    strokes[2]["segs"] = [[p0, p0 + (p1 - p0) / 3, p0 + 2 * (p1 - p0) / 3, p1]]


def render_glyph(cap, strokes):
    whole = not cap["label"].islower()
    xs = [pt[0] for s in strokes for seg in s.get("segs", []) for pt in seg] + [s["dot"][0] for s in strokes if "dot" in s]
    x0 = 0 if TOOL else min(xs)
    out = []
    for s in strokes:
        if "dot" in s:
            cx, cy = to_engine(s["dot"][0] - x0, s["dot"][1], whole); r = 2.6; k = 0.5523 * r
            d = (f"M {fmt(cx)} {fmt(cy - r)} C {fmt(cx + k)} {fmt(cy - r)} {fmt(cx + r)} {fmt(cy - k)} {fmt(cx + r)} {fmt(cy)} "
                 f"C {fmt(cx + r)} {fmt(cy + k)} {fmt(cx + k)} {fmt(cy + r)} {fmt(cx)} {fmt(cy + r)} "
                 f"C {fmt(cx - k)} {fmt(cy + r)} {fmt(cx - r)} {fmt(cy + k)} {fmt(cx - r)} {fmt(cy)} "
                 f"C {fmt(cx - r)} {fmt(cy - k)} {fmt(cx - k)} {fmt(cy - r)} {fmt(cx)} {fmt(cy - r)}")
            out.append({"d": d, "name": "точка"}); continue
        segs = s["segs"]; e = lambda pnt: to_engine(pnt[0] - x0, pnt[1], whole)
        d = "M " + " ".join(fmt(v) for v in e(segs[0][0]))
        for seg in segs:
            d += " C " + " ".join(fmt(v) for pnt in seg[1:] for v in e(pnt))
        out.append({"d": d, "name": "штрих"})
    return {"label": cap["label"], "kind": "letter", "sourceLabel": f"british-capture-{cap['label']}", "strokes": out,
            "stretch": 1, "noNormalize": True, "upright": True}


def main():
    global TOOL
    TOOL = "--tool" in sys.argv
    caps = {}
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        for c in json.load(open(f, encoding="utf-8")):
            caps[c["label"]] = c
    tidied = {l: tidy_glyph(c) for l, c in caps.items()}
    for l in ARCHES_FROM_ORIGINAL & set(tidied):  # the original's arches along the hand's path, tidied again
        tidied[l] = tidy_glyph(arches_from_original(caps[l], tidied[l]))
    for l in ORIGINAL_BOWL & set(tidied):
        global CUR, WHOLE
        CUR, WHOLE = l, not l.islower()
        original_bowl(l, tidied[l])
    for l in OVALS_FROM_ORIGINAL & set(tidied): oval_from_original(l, tidied[l])
    for l in OPEN_FROM_ORIGINAL & set(tidied):
        CUR, WHOLE = l, True
        open_from_original(l, tidied[l])
    if "R" in tidied and len(tidied["R"]) == 3: leg_from_original("R", tidied["R"])
    share_bowl(tidied)
    share_tail(tidied)
    for l in BELLIES_FROM_ORIGINAL & set(tidied): bellies_from_original(l, tidied[l])
    res = [render_glyph(caps[l], tidied[l]) for l in caps]
    json.dump({"glyphs": res}, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
