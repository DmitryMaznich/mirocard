#!/usr/bin/env python3
"""Digits and signs for «Прописи 2»: raw hand captures -> smooth glyphs at capital height.

  python3 tools/propis2/build_digit_glyphs.py

Reads  tools/propis/captures/digits_signs_raw_2026-10-06.json   (handwriting capture tool, base y=88)
Writes src/topics/renderers/propis2/digitGlyphs.json

What it does to a capture (the hand shakes, the size is a guess):
  1. every stroke is sampled densely (the capture is lines + quadratic curves);
  2. the stroke is cut at its CORNERS (turn sharper than CORNER_DEG over a short window: the bars of 4 and 7, the foot of 2,
     the flag of 5) so smoothing never rounds them off;
  3. every piece between corners is smoothed (Gaussian along the arc length, the ends stay put) and refit as cubic Beziers;
     a piece that is straight within STRAIGHT_TOL (the signs, the stem of 1 and 4, the bar of 7) becomes an exact line;
  4. all pieces of a stroke go back into ONE path (the pen does not lift at a corner);
  5. size: the base moves to y=62 (the deck's baseline) and everything grows TALLER (not wider; the engine widens by itself) by one factor so that a digit is as tall as a
     capital letter (CAP_H), keeping the slant; the signs keep their place relative to the digits.
"""
import json, math, re
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools/propis/captures/digits_signs_raw_2026-10-06.json"
OUT = ROOT / "src/topics/renderers/propis2/digitGlyphs.json"

BASE_CAPTURE = 88.0   # baseline of the capture tool for these captures
BASE_DECK = 62.0      # baseline of the deck (wide.json)
FOOT_Y = 61.5        # where the feet of the digits stand (round ones dip a little under the baseline, as the letters do)
CAP_H = 104.0         # height of a capital letter in the deck (y from -42 to 62)
SPACING = 0.6         # resampling step, units
SIGMA = 2.2           # smoothing along the arc, units
CORNER_DEG = 52.0
CORNER_WIN = 4.0      # units each side to measure a turn
STRAIGHT_TOL = 1.3    # a piece this straight is a line


def parse(d):
    toks = re.findall(r"[MLQC]|-?\d*\.?\d+", d)
    pts, i, cur = [], 0, None
    while i < len(toks):
        c = toks[i]; i += 1
        if c == "M":
            cur = np.array([float(toks[i]), float(toks[i + 1])]); i += 2; pts.append(cur)
        elif c == "L":
            nxt = np.array([float(toks[i]), float(toks[i + 1])]); i += 2
            for t in np.linspace(0, 1, 12)[1:]: pts.append(cur + (nxt - cur) * t)
            cur = nxt
        elif c == "Q":
            c1 = np.array([float(toks[i]), float(toks[i + 1])]); nxt = np.array([float(toks[i + 2]), float(toks[i + 3])]); i += 4
            for t in np.linspace(0, 1, 16)[1:]: pts.append((1 - t) ** 2 * cur + 2 * (1 - t) * t * c1 + t ** 2 * nxt)
            cur = nxt
    return np.array(pts)


def resample(p, step):
    seg = np.hypot(*np.diff(p, axis=0).T)
    keep = np.concatenate([[True], seg > 1e-9])
    p = p[keep]
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    n = max(2, int(s[-1] / step) + 1)
    u = np.linspace(0, s[-1], n)
    return np.stack([np.interp(u, s, p[:, 0]), np.interp(u, s, p[:, 1])], axis=1)


def corners(p, step):
    w = max(1, int(CORNER_WIN / step))
    out = []
    for i in range(w, len(p) - w):
        a = p[i] - p[i - w]; b = p[i + w] - p[i]
        if np.hypot(*a) < 1e-6 or np.hypot(*b) < 1e-6: continue
        ang = math.degrees(math.acos(max(-1, min(1, np.dot(a, b) / (np.hypot(*a) * np.hypot(*b))))))
        out.append((i, ang))
    cs = []
    for i, ang in out:
        if ang < CORNER_DEG: continue
        if cs and i - cs[-1][0] < 2 * w: 
            if ang > cs[-1][1]: cs[-1] = (i, ang)
        else: cs.append((i, ang))
    return [i for i, _ in cs]


def smooth(piece, step):
    n = len(piece)
    if n < 5: return piece
    sig = SIGMA / step
    k = np.arange(-int(3 * sig), int(3 * sig) + 1)
    w = np.exp(-0.5 * (k / sig) ** 2); w /= w.sum()
    pad = len(k) // 2
    # reflect through the end points (point reflection) so the ends keep their direction and do not drift
    head = 2 * piece[0] - piece[1:pad + 1][::-1]
    tail = 2 * piece[-1] - piece[-pad - 1:-1][::-1]
    ext = np.vstack([head, piece, tail])
    sm = np.stack([np.convolve(ext[:, 0], w, mode="valid"), np.convolve(ext[:, 1], w, mode="valid")], axis=1)
    sm[0], sm[-1] = piece[0], piece[-1]
    return sm


def straight(piece):
    a, b = piece[0], piece[-1]
    d = b - a; L = np.hypot(*d)
    if L < 1e-6: return True
    dev = np.abs(d[0] * (piece[:, 1] - a[1]) - d[1] * (piece[:, 0] - a[0])) / L
    return dev.max() < STRAIGHT_TOL


def beziers(piece, step, knot=7.0):
    """Catmull-Rom through knots every ~`knot` units -> cubic Beziers (end tangents follow the first / last chord)."""
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(piece, axis=0).T))])
    m = max(2, int(round(s[-1] / knot)) + 1)
    u = np.linspace(0, s[-1], m)
    k = np.stack([np.interp(u, s, piece[:, 0]), np.interp(u, s, piece[:, 1])], axis=1)
    segs = []
    for i in range(len(k) - 1):
        p0 = k[i - 1] if i > 0 else 2 * k[0] - k[1]
        p1, p2 = k[i], k[i + 1]
        p3 = k[i + 2] if i + 2 < len(k) else 2 * k[-1] - k[-2]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        segs.append((c1, c2, p2))
    return segs


def stroke_path(d):
    p = resample(parse(d), SPACING)
    cuts = [0] + corners(p, SPACING) + [len(p) - 1]
    cmds = []
    for a, b in zip(cuts, cuts[1:]):
        piece = p[a:b + 1]
        if len(piece) < 2: continue
        if not cmds: cmds.append(("M", [piece[0]]))
        if straight(piece):
            cmds.append(("L", [piece[-1]]))
        else:
            for c1, c2, e in beziers(smooth(piece, SPACING), SPACING): cmds.append(("C", [c1, c2, e]))
    return cmds


SLANT = 0.4663  # tan of the slant of the capture grid (23 units of lean over 50 of height, the stem of the captured «1»)
DY = 0.0  # one common vertical correction (set in main): the digits' feet stand on the baseline, as a whole group


def xform(pt, s, x0):
    # TALLER, NOT WIDER: the engine itself stretches every glyph horizontally (stretch 1.806), so the captured widths are already
    # meant to be widened; only the height grows by `s`. The lean of the strokes (SLANT = dx per unit of height, the grid's slant)
    # is kept: a point at height h moves to height s*h and slides along the slant by SLANT*(s-1)*h, so the cross-section width of the
    # digit stays what the hand drew and the strokes still run along the slant lines.
    h = BASE_CAPTURE - pt[1]
    return np.array([pt[0] + SLANT * (s - 1.0) * h, BASE_DECK - h * s + DY])


def to_deck(cmds, s, x0):
    return [(c, [xform(p, s, x0) for p in ps]) for c, ps in cmds]


def fmt(cmds):
    return " ".join(c + " " + " ".join(f"{q[0]:.2f} {q[1]:.2f}" for q in ps) for c, ps in cmds)


# One cell of the slant grid in deck units: 30 page units (5 mm on the wide row, the narrow row is the same at half scale) divided
# by what the engine does to a glyph's x (stretch 1.806, then WIDE_SCALE = 48/52).
GRID_CELL = 30.0 / (1.806 * 48.0 / 52.0)


def grid_u(pt):
    """Where a point is across the slant lines (its x carried down the slant to the baseline)."""
    return pt[0] - SLANT * (BASE_DECK - pt[1])


def off_grid(v):
    """How far `v` (a difference of grid_u) is from a whole number of cells, signed."""
    return v - GRID_CELL * round(v / GRID_CELL)


def stem_of(cmds):
    """Index of the first straight piece that runs along the slant (a stem: 1, 4, the upright of +), or None."""
    for i, (c, ps) in enumerate(cmds):
        if c != "L" or i == 0: continue
        a, b = cmds[i - 1][1][-1], ps[-1]
        if abs(b[1] - a[1]) > 15 and abs((a[0] - b[0]) / (b[1] - a[1]) - SLANT) < 0.03: return i
    return None


def shift_x(cmds, dx, upto=None):
    """Moves a stroke sideways by dx; with `upto`, only its start moves by the whole dx, fading to nothing at command `upto`."""
    n = len(cmds) if upto is None else upto
    return [(c, [q + np.array([dx * (1.0 if upto is None else max(0.0, 1.0 - i / n)), 0.0]) for q in ps]) for i, (c, ps) in enumerate(cmds)]


def on_grid(label, strokes):
    """Puts the digit on the slant grid the way the letters are: the engine sets the START of the first stroke on a slant line,
    so every other start point and every stem must be a whole number of cells from it (the stems then lie ON the lines and
    every red start dot sits on a line). The hand drew them 0.2-0.3 of a cell off."""
    u0 = grid_u(strokes[0][0][1][0])
    out = []
    for k, cmds in enumerate(strokes):
        if k == 0 and label == "7":
            # the downstroke of 7 was a slightly bent line steeper than the grid: it becomes a straight line along the slant, on the
            # slant line nearest to where it ran; the top bar stretches/shrinks to the new corner, the start tick stays
            corner = max(range(len(cmds)), key=lambda i: cmds[i][1][-1][0])
            stem = [q for _, ps in cmds[corner + 1:] for q in ps]
            u_stem = u0 + GRID_CELL * round((np.mean([grid_u(q) for q in stem]) - u0) / GRID_CELL)
            top, foot = cmds[corner][1][-1], cmds[-1][1][-1]
            new_top = np.array([u_stem + SLANT * (BASE_DECK - top[1]), top[1]])
            new_foot = np.array([u_stem + SLANT * (BASE_DECK - foot[1]), foot[1]])
            bar = cmds[2:corner + 1]  # after the tick (M, L)
            dx = new_top[0] - top[0]
            bar = [(c, [q + np.array([dx * (i + 1) / len(bar), 0.0]) for q in ps]) for i, (c, ps) in enumerate(bar)]
            out.append(cmds[:2] + bar + [("L", [new_foot])])
            continue
        if k == 1 and label == "7":
            # the cross bar of 7 is centred on the (moved) downstroke: crossing it in the middle matters more than its start dot
            # being on a line (a bar a cell long cannot have both)
            xs = [q[0] for _, ps in cmds for q in ps]
            y = float(np.mean([q[1] for _, ps in cmds for q in ps]))
            out.append(shift_x(cmds, u_stem + SLANT * (BASE_DECK - y) - (min(xs) + max(xs)) / 2))
            continue
        i = stem_of(cmds)
        if k == 0:
            # the start stays where the engine puts it; the stem gets a whole number of cells away by bending the lead-in (flag of 1)
            out.append(shift_x(cmds, off_grid(grid_u(cmds[i - 1][1][-1]) - u0), upto=i - 1) if i and i > 1 else cmds)  # a stem that IS the start is on its line already
        else:
            ref = cmds[i - 1][1][-1] if i else cmds[0][1][0]
            out.append(shift_x(cmds, -off_grid(grid_u(ref) - u0)))
    return out


def lift_to(cmds, dy):
    """Moves a stroke up/down by `dy` along the slant (so it keeps its place on the slant grid)."""
    return [(c, [np.array([q[0] - SLANT * dy, q[1] + dy]) for q in ps]) for c, ps in cmds]


def bar_y(cmds):
    ys = [q[1] for _, ps in cmds for q in ps]
    return (min(ys) + max(ys)) / 2


def main():
    raw = json.loads(SRC.read_text())
    digits = [it for it in raw if it["label"].isdigit()]
    heights = []
    for it in digits:
        ys = np.concatenate([parse(s["d"])[:, 1] for s in it["strokes"]])
        heights.append(ys.max() - ys.min())
    s = CAP_H / float(np.mean(heights))
    global DY
    bottoms = [BASE_DECK - (BASE_CAPTURE - np.concatenate([parse(st["d"])[:, 1] for st in it["strokes"]]).max()) * s for it in digits]
    DY = FOOT_Y - float(np.mean(bottoms))
    glyphs = []
    for it in raw:
        allp = np.concatenate([parse(st["d"]) for st in it["strokes"]])
        x0 = float(allp[:, 0].min())
        paths = [stroke_path(st["d"]) for st in it["strokes"]]
        if it["label"] == "-":
            # the captured minus sat at the lower third of the digit (on the dashed line); it belongs at the height of the bar of «+»
            plus = [stroke_path(st["d"]) for st in next(p for p in raw if p["label"] == "+")["strokes"]]
            want = bar_y(min(plus, key=lambda c: np.ptp([q[1] for _, ps in c for q in ps])))  # the flat stroke of «+»
            paths = [lift_to(c, want - bar_y(c)) for c in paths]
        strokes = [{"d": fmt(c)} for c in on_grid(it["label"], [to_deck(c, s, x0) for c in paths])]
        glyphs.append({"label": "№" + it["label"], "kind": "digit", "strokes": strokes, "stretch": 1.806, "noJoin": True,
                       "sourceLabel": f"{it['label']} (захват 2026-10-06; сглажен, масштаб x{s:.3f} = высота заглавной, база y=62)"})
    OUT.write_text(json.dumps(glyphs, ensure_ascii=False, indent=1))
    print(f"scale x{s:.3f}; {len(glyphs)} glyphs -> {OUT}")


main()
