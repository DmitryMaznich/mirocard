#!/usr/bin/env python3
"""A letter traced by hand (over a Boyan underlay) -> the same pen path, tidied: what is meant to be straight is a straight line,
a hook or a bow is one smooth curve with no jerks, a near-horizontal line (А's bar) is horizontal, a near-slant one runs exactly along
the slant, the letter stands on the baseline and reaches the top of its zone. The hand's own path stays: its strokes, their order and
direction, where the pen lifts, where it turns back sharply (the apex of А). Nothing is taken from the font.

The tidying is done on the PAPER, as the deck prints the letter: the engine lays a row out in the bank's geometry (65deg, capitals 2
lowercase heights) and then maps it to the deck's own (meta.script, propis/scriptGeometry.js: 76deg, capitals 2.53 for propis2_bg),
stretching the zones above and below the lowercase band apart. A line straight in the bank bends where it crosses the band's edges on
paper (the Russian А does on the Bulgarian paper), so the letter is made straight on paper and taken back into the bank through the
inverse of that map, cut where it crosses the band's edges: on each side of them the map is affine, so lines stay lines, curves stay
the same curves, and the printed letter is exactly the tidied one. Paper units: the row as laid out at scale 1 (wordEngine: baseline
64, lowercase band 48).

Per stroke: the turns back (corners) cut it into pieces; in each piece the longest runs that stay within LINE_TOL of a line become
lines; what is left between them is fitted by cubics through anchors (the ends, the lowest / highest points of each bow) whose
tangents are the lines' own directions where they meet one, horizontal at a bow's bottom or top, so every join is smooth.
"""
import math
import re
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import build_digit_glyphs as dg  # noqa: E402
# the bank -> the row (no script): the engine's horizontal stretch about the slant, its scale 48/52 (both measured on a laid-out probe)
B_BASE, B_TOP, R_BASE, R_BAND = 62.0, 10.0, 64.0, 48.0
SIGMA, STRETCH, T65 = R_BAND / (B_BASE - B_TOP), 1.806, math.tan(math.radians(25))
# the paper: set by use_script()
BASE, X_TOP, CAP_TOP, SLANT_DEG_PAPER, SLANT_T, SCRIPT = R_BASE, R_BASE - R_BAND, R_BASE - 2 * R_BAND, 65.0, T65, {}
STEP = 0.6
CORNER_DEG = 100.0   # a turn this sharp is the pen turning back (А's apex), kept sharp
LINE_TOL = 1.1       # a run of the hand this close to a line is a line (the hand shakes about +-1 bank unit)
ARC_SAG, ARC_SAG_STEM, ARC_SAG_PART = 0.5, 1.2, 0.006  # a run bowing more than this (+ this part of its length) at the middle is an arc (_runs)
LINE_MIN = 28.0      # a line is at least this long (a shorter straight bit is part of a bow: А's entry hook)
HORIZ_DEG = 10.0     # a line within this of the horizontal is horizontal
SLANT_DEG = 8.0      # within this of the slant: along the slant
MERGE_DEG = 14.0     # two lines this close in direction, one after the other, are one
MERGE_GAP = 12.0     # ... when no farther apart along the stroke than this
SHORT_LINE, SHORT_DEG = 55.0, 35.0  # see _runs: a line shorter than this, this close in direction to a longer neighbour, is a curve
END_ABSORB = 7.0     # a line ending this close to the end of its piece runs to the end
TRIM, TRIM_PART = 6.0, 0.1  # a line gives this much of its end (or this part of its length) to the curve after it: room to turn smoothly
HANDLE_MIN = 0.3     # see _bezier_fit
BOW_H = 20.0         # a hook at the baseline reaches this high up the line it turns into (0.42 of the lowercase band)
EXT_PROM = 1.5       # a bow's bottom / top / side turns at least this much to count (smaller is the shake of the hand)
HOOK_MAX = 45.0      # a hook is at most this long along the hand
FIT_TOL = 2.0        # a curve strays at most this far from the smoothed hand, else it is split
LOOP_R, LOOP_REACH, LOOP_W = 4.0, 1.6, 4.0  # a loop (tidy_stroke loops) replaces this much of the hand each side of the turn, reaching this far past it, this wide
SNAP = 4.0           # a bow's bottom / top this close to a ruling line stands on it


def parse_path(d):
    """Points along a path of M / L / Q / C commands (dg.parse knows no C, the bank's letters are cubics)."""
    toks = re.findall(r"[MLQC]|-?\d*\.?\d+(?:[eE][+-]?\d+)?", d)
    pts, i, cur, cmd = [], 0, None, None
    num = lambda j: np.array([float(toks[j]), float(toks[j + 1])])
    while i < len(toks):
        if toks[i] in "MLQC": cmd = toks[i]; i += 1; continue
        if cmd == "M": cur = num(i); i += 2; pts.append(cur)
        elif cmd == "L":
            nxt = num(i); i += 2
            pts.extend(cur + (nxt - cur) * t for t in np.linspace(0, 1, 8)[1:]); cur = nxt
        elif cmd == "Q":
            a, nxt = num(i), num(i + 2); i += 4
            pts.extend((1 - t) ** 2 * cur + 2 * (1 - t) * t * a + t ** 2 * nxt for t in np.linspace(0, 1, 10)[1:]); cur = nxt
        elif cmd == "C":
            a, b, nxt = num(i), num(i + 2), num(i + 4); i += 6
            pts.extend((1 - t) ** 3 * cur + 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3 * nxt for t in np.linspace(0, 1, 10)[1:]); cur = nxt
        else: i += 1
    return pts


def use_script(script):
    """The paper of a deck: its meta.script (None: the Russian copybook)."""
    global BASE, X_TOP, CAP_TOP, SLANT_DEG_PAPER, SLANT_T, SCRIPT
    SCRIPT = script or {}
    SLANT_DEG_PAPER = SCRIPT.get("slantDeg", 65.0); SLANT_T = math.tan(math.radians(90 - SLANT_DEG_PAPER))
    BASE, X_TOP = R_BASE, R_BASE - R_BAND
    CAP_TOP = X_TOP - R_BAND * SCRIPT.get("upper", 1.0)


def to_paper(p):
    """Bank points -> paper (the engine's row layout, then scriptPointMap)."""
    p = np.asarray(p, float); h = B_BASE - p[:, 1]
    x = SIGMA * (STRETCH * (p[:, 0] - T65 * h) + T65 * h); y = R_BASE - SIGMA * h
    up, lo = SCRIPT.get("upper", 1.0), SCRIPT.get("lower", 1.0)
    upright = x - (BASE - y) * T65
    y2 = np.where(y < X_TOP, X_TOP - (X_TOP - y) * up, np.where(y > BASE, BASE + (y - BASE) * lo, y))
    return np.stack([upright + (BASE - y2) * SLANT_T, y2], axis=1)


def to_bank(p):
    """The inverse of to_paper."""
    p = np.asarray(p, float); x, y2 = p[:, 0], p[:, 1]
    up, lo = SCRIPT.get("upper", 1.0), SCRIPT.get("lower", 1.0)
    y = np.where(y2 < X_TOP, X_TOP - (X_TOP - y2) / up, np.where(y2 > BASE, BASE + (y2 - BASE) / lo, y2))
    xr = x - (BASE - y2) * SLANT_T + (BASE - y) * T65
    h = (R_BASE - y) / SIGMA
    return np.stack([(xr / SIGMA - T65 * h) / STRETCH + T65 * h, B_BASE - h], axis=1)


def _split_at(cmds, levels):
    """Commands cut wherever they cross one of the heights `levels` (the map is affine between them)."""
    out = [cmds[0]]; cur = np.asarray(cmds[0][1][0], float)
    for c, ps in cmds[1:]:
        ps = [np.asarray(q, float) for q in ps]
        if c == "L":
            a, b = cur, ps[0]
            ts = sorted(t for Y in levels if (a[1] - Y) * (b[1] - Y) < 0 for t in [(Y - a[1]) / (b[1] - a[1])])
            for t in ts: out.append(("L", [a + (b - a) * t]))
            out.append(("L", [b]))
        else:
            P = [cur] + ps
            ys = [q[1] for q in P]
            ts = []
            for Y in levels:
                co = [-ys[0] + 3 * ys[1] - 3 * ys[2] + ys[3], 3 * ys[0] - 6 * ys[1] + 3 * ys[2], -3 * ys[0] + 3 * ys[1], ys[0] - Y]
                ts += [r.real for r in np.roots(co) if abs(r.imag) < 1e-9 and 1e-6 < r.real < 1 - 1e-6]
            prev = 0.0
            for t in sorted(ts) + [1.0]:
                u = (t - prev) / (1 - prev)  # split the rest at u (de Casteljau)
                p01, p12, p23 = P[0] + (P[1] - P[0]) * u, P[1] + (P[2] - P[1]) * u, P[2] + (P[3] - P[2]) * u
                p012, p123 = p01 + (p12 - p01) * u, p12 + (p23 - p12) * u
                m = p012 + (p123 - p012) * u
                out.append(("C", [p01, p012, m])); P = [m, p123, p23, P[3]]; prev = t
        cur = out[-1][1][-1]
    return out


def paper_to_bank_cmds(cmds):
    return [(c, list(to_bank(np.array(ps)))) for c, ps in _split_at(cmds, [X_TOP, BASE])]


def shear_scale(p, k, base=None):
    """Heights from the baseline times k, along the slant (a slant line stays one, a horizontal stays horizontal)."""
    base = BASE if base is None else base
    h = base - p[:, 1]
    return np.stack([p[:, 0] + SLANT_T * (k - 1) * h, base - k * h], axis=1)


def _fit_line(q):
    c = q.mean(axis=0); u, s, vt = np.linalg.svd(q - c); d = vt[0]
    if np.dot(d, q[-1] - q[0]) < 0: d = -d
    dev = np.abs((q - c) @ np.array([-d[1], d[0]]))
    return c, d, dev.max()


def _sagitta(q):
    """How far a run bows off its line at the middle (a parabola fitted across it): a steady bow, not the shake."""
    c, d, _ = _fit_line(q); t, e = (q - c) @ d, (q - c) @ np.array([-d[1], d[0]])
    a = np.linalg.lstsq(np.c_[t ** 2, t, np.ones_like(t)], e, rcond=None)[0][0]
    return abs(a) * ((t.max() - t.min()) / 2) ** 2


def _snap_dir(d):
    ang = math.degrees(math.atan2(-d[1], d[0]))  # 0 = to the right, 90 = up
    for target in (0.0, 180.0, -180.0):
        if abs(ang - target) < HORIZ_DEG: return np.array([math.copysign(1.0, d[0]), 0.0])
    # only a stroke going DOWN is a stem along the slant; an upstroke keeps its own angle (И, М: snapped too, the rising line lay on
    # top of the stem it turns back into at the top, owner 2026-10-18)
    for target in (SLANT_DEG_PAPER - 180.0,):
        if abs(ang - target) < SLANT_DEG:
            v = np.array([math.cos(math.radians(target)), -math.sin(math.radians(target))]); return v
    return d


def _runs(q, top):
    """The straight runs of a piece: [(i, j, centre, direction)] in order along it, not overlapping."""
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(q, axis=0).T))])
    free = np.ones(len(q), bool); found = []
    while True:
        best = None
        for i in range(0, len(q) - 1, 3):
            if not free[i]: continue
            j = i + 1
            while j + 1 < len(q) and free[j + 1] and _fit_line(q[i:j + 2])[2] < LINE_TOL: j += 1
            if s[j] - s[i] >= LINE_MIN and (best is None or s[j] - s[i] > s[best[1]] - s[best[0]]): best = (i, j)
        if best is None: break
        found.append(best); free[max(0, best[0] - 2):best[1] + 3] = False
    found.sort()
    # two runs one after the other going nearly the same way are one line the hand bent (on paper the underlay itself bends where
    # it crosses the lowercase band: the bank's geometry mapped to the deck's): one line through both
    # a run that bows to one side steadily is an arc the hand drew within the tolerance, not a line (Г's flag and stem, Д's sides:
    # owner 2026-10-18 «зачем-то повыпрямлял дуги»); one bent by the map across the band's edge is still joined below
    merged, joined = [], set()
    for i, j in found:
        if merged:
            pi, pj = merged[-1]
            d1, d2 = _fit_line(q[pi:pj + 1])[1], _fit_line(q[i:j + 1])[1]
            if math.degrees(math.acos(min(1.0, abs(float(np.dot(d1, d2)))))) < MERGE_DEG and s[i] - s[pj] < MERGE_GAP:
                merged[-1] = (pi, j); joined.add(pi); continue
        merged.append((i, j))
    def straight_enough(i, j):
        # a stem (going down along the slant) is the straight part of a letter: it takes more bow before it counts as an arc
        stem = _snap_dir(_fit_line(q[i:j + 1])[1])[1] > 0 and abs(math.degrees(math.atan2(-_fit_line(q[i:j + 1])[1][1], _fit_line(q[i:j + 1])[1][0])) - (SLANT_DEG_PAPER - 180.0)) < SLANT_DEG
        return _sagitta(q[i:j + 1]) <= (ARC_SAG_STEM if stem else ARC_SAG) + ARC_SAG_PART * (s[j] - s[i])
    merged = [(i, j) for i, j in merged if i in joined or straight_enough(i, j)]
    # a short line next to a longer one going nearly the same way is the curve running into it, not a line of its own (И: the bow
    # from the foot of the first stem bends gradually into the diagonal, as in the font; a line there leaves an elbow)
    keep, soft = [], []
    for n, (i, j) in enumerate(merged):
        L = s[j] - s[i]
        near = [merged[m] for m in (n - 1, n + 1) if 0 <= m < len(merged)]
        if L < SHORT_LINE and any(s[b] - s[a] > L and min(abs(s[i] - s[b]), abs(s[a] - s[j])) < 2 * MERGE_GAP
                                  and math.degrees(math.acos(min(1.0, abs(float(np.dot(_fit_line(q[i:j + 1])[1], _fit_line(q[a:b + 1])[1])))))) < SHORT_DEG
                                  for a, b in near):
            # still a guide for the curve: it passes the middle of the dropped line along its direction
            c, d, _ = _fit_line(q[i:j + 1]); m = (i + j) // 2
            soft.append([m, c + d * np.dot(q[m] - c, d), d, d])
            continue
        keep.append((i, j))
    merged = keep
    # a line ending this close to the end of the piece runs to it (no flick of the pen at the end of a stroke)
    if merged and s[merged[0][0]] < END_ABSORB: merged[0] = (0, merged[0][1])
    if merged and s[-1] - s[merged[-1][1]] < END_ABSORB: merged[-1] = (merged[-1][0], len(q) - 1)
    out = []
    for i, j in merged:
        # a line stops a little short of where the hand leaves it: the curve after it needs room to turn smoothly
        trim = max(1, int(max(TRIM, TRIM_PART * (s[j] - s[i])) / STEP)); i2, j2 = i + (trim if i > 0 else 0), j - (trim if j < len(q) - 1 else 0)
        # an end near the baseline turns into the hook there: the hook takes the line back up to BOW_H above the baseline (owner,
        # 2026-10-18: the side hooks of А long and round, not a short turn at the foot of a straight line)
        if i > 0:
            while i2 < j2 and q[i2, 1] > BASE - BOW_H: i2 += 1
        if j < len(q) - 1:
            while j2 > i2 and q[j2, 1] > BASE - BOW_H: j2 -= 1
        if s[j2] - s[i2] < LINE_MIN / 2: continue  # what is left of it is part of the hook
        c, d, _ = _fit_line(q[i:j + 1]); d = _snap_dir(d)
        out.append((i2, j2, c, d))
    return out, soft


def _bezier_fit(q, t0, t1):
    """One cubic from q[0] to q[-1] leaving along t0, arriving along t1, as close to q as the handle lengths allow (least squares)."""
    p0, p3 = q[0], q[-1]
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(q, axis=0).T))]); u = s / s[-1] if s[-1] > 0 else s
    b1 = 3 * (1 - u) ** 2 * u; b2 = 3 * (1 - u) * u ** 2
    base = np.outer((1 - u) ** 3 + b1, p0) + np.outer(b2 + u ** 3, p3)
    A = np.stack([(b1[:, None] * t0).ravel(), (-b2[:, None] * t1).ravel()], axis=1)
    a, b = np.linalg.lstsq(A, (q - base).ravel(), rcond=None)[0]
    L = np.hypot(*(p3 - p0))
    if not (0 < a < 1.2 * L and 0 < b < 1.2 * L): a = b = L / 3  # a degenerate fit: the plain third-of-chord handles
    # never shorter than HANDLE_MIN of the chord: a short handle is a tight turn at the anchor (the hand's own wobble) and a straight
    # middle, the jerk this is meant to take out
    a, b = max(a, HANDLE_MIN * L), max(b, HANDLE_MIN * L)
    return p0 + a * t0, p3 - b * t1, p3


def _unit(v):
    n = np.hypot(*v); return v / n if n > 1e-9 else v


def _ruling_y(y, top):
    for line in (BASE, X_TOP, top):
        if abs(y - line) < SNAP: return line
    return None


def _extrema(v):
    """Indexes of the clear local extremes of v (a turn of at least EXT_PROM units each way), not at its ends."""
    out = []
    for k in range(3, len(v) - 3):
        lo, hi = max(0, k - 40), min(len(v), k + 41)
        left, right = v[lo:k], v[k + 1:hi]
        for sign in (1, -1):
            if all(sign * v[k] >= sign * w for w in (left.max() if sign > 0 else left.min(), right.max() if sign > 0 else right.min())):
                if sign * (v[k] - (left.min() if sign > 0 else left.max())) >= EXT_PROM and sign * (v[k] - (right.min() if sign > 0 else right.max())) >= EXT_PROM:
                    if not out or k - out[-1] > 3: out.append(k)
    return out


def _fit_span(sub, t0, t1, depth=0, tol=None):
    """Cubics through sub with end tangents t0, t1: one if it stays within FIT_TOL of the (smoothed) hand, else split where it strays most."""
    c1, c2, e = _bezier_fit(sub, t0, t1)
    u = np.linspace(0, 1, 60)[:, None]
    curve = (1 - u) ** 3 * sub[0] + 3 * (1 - u) ** 2 * u * c1 + 3 * (1 - u) * u ** 2 * c2 + u ** 3 * e
    dev = np.min(np.hypot(sub[:, None, 0] - curve[None, :, 0], sub[:, None, 1] - curve[None, :, 1]), axis=1)
    k = int(np.argmax(dev))
    tol = FIT_TOL if tol is None else tol
    if dev[k] <= tol or depth > 4 or k < 3 or k > len(sub) - 4:
        return [("C", [c1, c2, e])]
    tk = _unit(sub[min(k + 3, len(sub) - 1)] - sub[max(k - 3, 0)])
    return _fit_span(sub[:k + 1], t0, tk, depth + 1, tol) + _fit_span(sub[k:], tk, t1, depth + 1, tol)


def tidy_piece(q, top, t_in=None, t_out=None):
    """One piece (between turns back) -> path commands without the M. t_in / t_out: forced end tangents (None: the hand's)."""
    runs, soft = _runs(q, top)
    # anchors: (index, point, tangent in, tangent out)
    anchors = []
    tan = lambda i: _unit(q[min(i + 3, len(q) - 1)] - q[max(i - 3, 0)])
    anchors.append([0, q[0], None, t_in if t_in is not None else tan(0)])
    lines = []; line_ends = []; first_line = last_line = None
    for i, j, c, d in runs:
        if i == 0: first_line = (c, d)
        if j == len(q) - 1: last_line = (c, d)
        a = c + d * np.dot(q[i] - c, d); b = c + d * np.dot(q[j] - c, d)
        if i == 0: anchors[0] = [0, a, None, d]
        else: anchors.append([i, a, d, d])
        lines.append(i); line_ends.append(j)
        anchors.append([j, b, d, d])
    if anchors[-1][0] != len(q) - 1: anchors.append([len(q) - 1, q[-1], t_out if t_out is not None else tan(len(q) - 1), None])
    else: anchors[-1][3] = None
    # every bottom / top of a bow between them (horizontal there, on the ruling line when near one) and every leftmost / rightmost
    # point across the slant (running along the slant there): the anchors an oval or an S is drawn through
    extra = []; on_ruling = []
    upright = q[:, 0] - (BASE - q[:, 1]) * SLANT_T
    slant_dir = _unit(np.array([SLANT_T, -1.0]))
    for (ia, *_), (ib, *_) in zip(anchors, anchors[1:]):
        if ia in lines or ib - ia < 6: continue
        for k in _extrema(q[ia:ib + 1, 1]):
            p = q[ia + k].copy(); y = _ruling_y(p[1], top)
            if y is not None:
                p[1] = y
                if y == BASE: on_ruling.append(ia + k)  # a hook stands on the baseline; a top on a line above is a bow like any other (К's flag)
            t = np.array([math.copysign(1.0, q[min(ia + k + 2, ib), 0] - q[max(ia + k - 2, ia), 0]), 0.0])
            extra.append([ia + k, p, t, t])
        for k in _extrema(upright[ia:ib + 1]):
            if any(abs(e[0] - (ia + k)) < 4 for e in extra): continue
            t = slant_dir * math.copysign(1.0, -(q[min(ia + k + 2, ib), 1] - q[max(ia + k - 2, ia), 1]))
            extra.append([ia + k, q[ia + k].copy(), t, t])
    extra += [a for a in soft if not any(abs(e[0] - a[0]) < 4 for e in extra)]
    anchors = sorted(anchors + extra, key=lambda a: a[0])
    cmds = []
    for (ia, pa, _, ta), (ib, pb, tb, _) in zip(anchors, anchors[1:]):
        if ia in lines and ib > ia:
            cmds.append(("L", [pb])); continue
        sub = q[ia:ib + 1].copy(); sub[0], sub[-1] = pa, pb
        if len(sub) < 3: cmds.append(("L", [pb])); continue
        # a span from a bow standing on a ruling line, or running into a line, is a hook (BOW_H): one round cubic, never split to
        # follow the hand's own turn there
        hook = ia in on_ruling or ib in on_ruling or ia in line_ends or ib in lines
        # ... a hook is short: a long span (a whole downstroke of Ж, И's upstroke from the foot to the top) follows the hand
        hook = hook and float(np.hypot(*np.diff(q[ia:ib + 1], axis=0).T).sum()) < HOOK_MAX
        cmds.extend([("C", list(_bezier_fit(sub, _unit(ta), _unit(tb))))] if hook else _fit_span(sub, _unit(ta), _unit(tb)))
    return anchors[0][1], cmds, first_line, last_line


def _cross(l1, l2):
    (c1, d1), (c2, d2) = l1, l2
    m = np.array([d1, -d2]).T
    if abs(np.linalg.det(m)) < 1e-6: return None
    t = np.linalg.solve(m, c2 - c1)[0]
    return c1 + t * d1


def _loop_at(q, c):
    """The sharp turn back at q[c] -> a small closed loop (a teardrop out past the turn and back), the points around it replaced."""
    r = int(LOOP_R / STEP)
    a, b = max(1, c - r), min(len(q) - 2, c + r)
    t_in, t_out = _unit(q[a] - q[max(0, a - 4)]), _unit(q[min(len(q) - 1, b + 4)] - q[b])
    h = LOOP_REACH * max(np.hypot(*(q[c] - q[a])), np.hypot(*(q[c] - q[b])))
    # the two sides held apart (the hand drew them on top of each other: a spur, not a loop)
    n = _unit(q[a] - q[b]) if np.hypot(*(q[a] - q[b])) > 1e-6 else np.array([-t_in[1], t_in[0]])
    c1, c2 = q[a] + h * t_in + n * LOOP_W, q[b] - h * t_out - n * LOOP_W
    u = np.linspace(0, 1, 2 * r + 1)[1:-1, None]
    loop = (1 - u) ** 3 * q[a] + 3 * (1 - u) ** 2 * u * c1 + 3 * (1 - u) * u ** 2 * c2 + u ** 3 * q[b]
    return dg.resample(np.vstack([q[:a + 1], loop, q[b:]]), STEP)


def tidy_stroke(p, top, loops=False):
    """One stroke (paper points) -> commands (M ...). loops: a sharp turn back away from the top and the baseline becomes a small loop (Е)."""
    q = dg.resample(np.asarray(p, float), STEP)
    q = dg.smooth(q, STEP)  # the finest shake of the hand only (dg.SIGMA); the lines and fits below do the rest
    keep, dg.CORNER_DEG = dg.CORNER_DEG, CORNER_DEG
    if loops:
        for c in dg.corners(q, STEP)[::-1]:
            if min(abs(q[c, 1] - BASE), abs(q[c, 1] - top)) > SNAP: q = _loop_at(q, c)  # not an apex on the top line, not a foot
    cuts = [0] + dg.corners(q, STEP) + [len(q) - 1]
    dg.CORNER_DEG = keep
    cmds, prev_line = [], None
    for a, b in zip(cuts, cuts[1:]):
        start, c, first_line, last_line = tidy_piece(q[a:b + 1], top)
        if not cmds: cmds.append(("M", [start]))
        else:
            # a turn back: the two pieces meet in one sharp point, where their lines cross when both end in a line
            x = _cross(prev_line, first_line) if prev_line is not None and first_line is not None else None
            if x is not None and np.hypot(*(x - start)) < 6: cmds[-1][1][-1] = x; start = x
            else: cmds[-1][1][-1] = start
        cmds.extend(c)
        prev_line = last_line
    return cmds


def tidy_letter(strokes, capital, script=None, loops=False, adjust=None):
    """Strokes (bank points, the hand's) -> tidied strokes (bank commands): straight and smooth on the paper of `script`, standing on
    its baseline, the top on its zone's top (a capital's: the top line of the Bulgarian ruling)."""
    use_script(script)
    strokes = [to_paper(s) for s in strokes]
    allp = np.concatenate(strokes)
    top = CAP_TOP if capital else X_TOP
    dy = BASE - allp[:, 1].max()
    k = (BASE - top) / (BASE - (allp[:, 1].min() + dy))
    strokes = [shear_scale(s + [0, dy], k) for s in strokes]
    out = [tidy_stroke(s, top, loops) for s in strokes]
    # the tidied letter, once more exactly between its lines (the lines that meet at a sharp top end where they cross)
    pts = np.array([q for cmds in out for q in parse_path(dg.fmt(cmds))])
    k2 = (BASE - top) / (BASE - pts[:, 1].min())
    out = [[(c, list(shear_scale(np.array(ps), k2))) for c, ps in cmds] for cmds in out]
    global LAST_PLACE
    LAST_PLACE = (dy, k, k2)
    if adjust: out = adjust(out)  # a letter's own correction the owner asked for, on paper (build_glyphs.py SHAPES)
    return [paper_to_bank_cmds(c) for c in out], out


LAST_PLACE = (0.0, 1.0, 1.0)


def upright(p):
    """Paper points -> x across the slant (the slant taken out), y kept."""
    p = np.asarray(p, float); return np.stack([p[:, 0] - (BASE - p[:, 1]) * SLANT_T, p[:, 1]], axis=1)


def from_upright(p):
    p = np.asarray(p, float); return np.stack([p[:, 0] + (BASE - p[:, 1]) * SLANT_T, p[:, 1]], axis=1)


def placed_like_last(p):
    """Bank points -> where the last tidy_letter put its letter on paper (a review sheet lays the font's outline under it)."""
    dy, k, k2 = LAST_PLACE
    return shear_scale(shear_scale(to_paper(p) + [0, dy], k), k2)
