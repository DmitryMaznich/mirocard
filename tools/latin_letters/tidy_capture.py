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
FREE_TURN = set("M")  # turns left where the hand put them: M's middle stops 0.07 of the x-height above the baseline on the Nelson page
STEM_MEET = 2.5      # a bar's end this close to a stem (a vertical line of another stroke) ends on it
BOW_BAR = 2.0        # a bar whose hand sags this much in the middle is drawn as one arc (f), else straight
BAR_DEV = 0.2         # a whole stroke near-horizontal and within this part of its length from its chord is a bar
K_ELL = 0.5523
OVAL_TURN, OVAL_STEM = 250.0, 28.0  # see line_runs
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
        if err <= QUARTER_TOL: return [ctrl]
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
            q = first[1]; x = prev[1]["b"][0]; m = 0
            while m + 1 < len(q) and abs(q[m + 1][0] - x) <= 0.8 and (q[m + 1][1] - q[0][1]) * prev[1]["dir"][1] <= 0: m += 1
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
            if idx < len(items) - 1 and items[idx + 1][0] == "curve":
                nb = it["b"] - it["dir"] * t
                items[idx + 1][1] = np.vstack([nb, items[idx + 1][1]]); it["b"] = nb
    # where two pieces meet (a turn back), one point: a line's end wins; a curve there runs along that line
    cusp_tan = {}
    for k in range(len(parts) - 1):
        A, B = parts[k][-1], parts[k + 1][0]
        if A[0] == "line": pnt = A[1]["b"].copy()
        elif B[0] == "line": pnt = B[1]["a"].copy()
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
            if idx > 0 and items[idx - 1][0] == "line": q[0] = items[idx - 1][1]["b"]; ts = items[idx - 1][1]["dir"]
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
ORIGINAL_BOWL = set("bp")
ORIGINAL = False  # set while a bowl from the original is drawn
UNDERLAYS = Path(__file__).resolve().parent / "underlays" / "british"
UL_PX, UL_X = 8, 100.0  # the underlay: 8 px a unit, put at x = 100 in the tool
HALF_INK = 3.25 * 26 / 44  # half the Nelson stroke, tool units


def original_bowl_from_hole(label, stem_x, start):
    """The bowl's middle line as the hole's edge moved out by half the pen: reliable all round, also where the bowl's ink runs into the
    stem's (there it lands on the stem's middle). The bowl is the part of it off the stem, from where it leaves the stem to where it
    comes back, in the direction the hand went (`start`: the hand's first point of the bowl)."""
    from PIL import Image
    from collections import deque
    a = np.array(Image.open(UNDERLAYS / f"lo_{label}.png"))[:, :, 3] > 128
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
    off = ring[:, 0] > stem_x + 0.3  # off the stem
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
            pts = original_bowl_from_hole(label, stem_x, segs[0][0])
            st["segs"] = curve(resample(pts), None, None)
            return
    finally:
        ORIGINAL = False


# a d g q have ONE bowl (owner, 2026-11-08: «у g эта часть правильная и подходит и для a и для d и для q, отличия только в окончаниях»):
# g's bowl -- from the pen's start round to the top of its stem, where it arrives almost upright -- is put into a, d, q at their stems;
# each keeps its own ending: a the stem down and the flick, d up the stem to the ascender and down it, q the stem down and the tail right
SHARED_BOWL, BOWL_FROM = set("adq"), "g"


def first_stem_down(segs):
    for k, sg in enumerate(segs):
        if all(abs(pt[0] - sg[0][0]) < 1e-6 for pt in sg) and sg[3][1] - sg[0][1] > 8: return k
    return None


def share_bowl(tidied):
    src = tidied.get(BOWL_FROM)
    if not src: return
    gs = src[0]["segs"]; kg = first_stem_down(gs)
    bowl, joint = [[pt.copy() for pt in sg] for sg in gs[:kg]], gs[kg][0].copy()
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
    for l in ORIGINAL_BOWL & set(tidied):
        global CUR, WHOLE
        CUR, WHOLE = l, False
        original_bowl(l, tidied[l])
    share_bowl(tidied)
    res = [render_glyph(caps[l], tidied[l]) for l in caps]
    json.dump({"glyphs": res}, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
