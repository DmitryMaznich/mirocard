"""Vector forms of the four punctuation marks (. , ! ?) for the
punctuation workbook.

Provisional shapes, drawn by hand here as plain Bezier geometry -- propis
has no captured cursive strokes for punctuation (docs/propis.md,
"Characters without captured cursive strokes"). When real captured
trajectories arrive, they replace MARKS below; everything else in this
package only talks to `draw_mark` / `mark_width`.

All coordinates are real mm, relative to the mark's own origin: x=0 is the
mark's left ink edge, y=0 is the ruling's baseline, y grows UP (reportlab
convention). Shapes are designed upright and then sheared by the same
65-degree handwriting slant the propis ruling's diagonal lines use
(propis_ruling.py: angle_from_vertical=65 -> dx/dy = tan(25deg)).

Sizes are tied to the real captured letters at render.py's ROW_MM=25:
x-height (о) ~4.0mm, capitals (Т, С) ~8.0-8.2mm, descenders (р, у) ~3.5mm.
"""

import math

SLANT = math.tan(math.radians(25))  # 0.466: dx per 1mm of height

LINE_W = 0.33      # mm, stroke width of mark bodies (letters use 0.275)
DOT_R = 0.42       # mm, radius of every dot (full stop, the dots of ! and ?)
COMMA_HEAD_R = 0.40


def _shear(pts):
    return [(x + y * SLANT, y) for x, y in pts]


# Each mark: list of primitives in upright mm coordinates.
#   ("dot", cx, cy, r)            filled disc
#   ("path", [(x,y), ...], cmds)  "M"/"C" polyline: cmds is a list of
#                                  ("M", p) / ("C", p1, p2, p3)
# `part` tags let a page show only the "head" of a mark (comma head without
# its tail, ! / ? without the dot, ...) as a partial-model scaffold.
MARKS = {
    ".": [
        ("dot", 0.0, DOT_R, DOT_R, "head"),
    ],
    ",": [
        # small element sitting ON the baseline ...
        ("dot", 0.0, 0.42, COMMA_HEAD_R, "head"),
        # ... plus a short, controlled tail down and slightly left:
        # ends ~2mm under the baseline (a bit over half a descender),
        # never a long vertical stick.
        ("path", [("M", (0.36, 0.52)),
                  ("C", (0.42, -0.35), (0.05, -1.25), (-0.62, -1.95))], "tail"),
    ],
    "!": [
        # capital-height stroke that stops well above the baseline,
        # then a separate dot -- never joined.
        ("path", [("M", (0.0, 6.9)), ("C", (0.0, 5.3), (0.0, 3.8), (0.0, 2.3))], "head"),
        ("dot", 0.0, DOT_R, DOT_R, "dot"),
    ],
    "?": [
        # open hook on top, short neck, no bottom bar (so it can't read as a 2)
        ("path", [("M", (-1.40, 5.75)),
                  ("C", (-1.30, 7.10), (1.50, 7.20), (1.46, 5.75)),
                  ("C", (1.44, 4.70), (0.05, 4.45), (0.0, 3.40)),
                  ("C", (0.0, 3.00), (0.0, 2.65), (0.0, 2.3))], "head"),
        ("dot", 0.0, DOT_R, DOT_R, "dot"),
    ],
}


def _prim_points(prim):
    kind = prim[0]
    if kind == "dot":
        _, cx, cy, r, _ = prim
        (sx, sy), = _shear([(cx, cy)])
        return [(sx - r, sy - r), (sx + r, sy + r)]
    pts = []
    for cmd in prim[1]:
        pts.extend(_shear(list(cmd[1:])))
    w = LINE_W / 2
    return [(x - w, y - w) for x, y in pts] + [(x + w, y + w) for x, y in pts]


def mark_bounds(ch):
    """(minx, maxx, miny, maxy) in upright-sheared mm, before origin shift."""
    pts = [p for prim in MARKS[ch] for p in _prim_points(prim)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), max(xs), min(ys), max(ys)


def mark_width(ch):
    minx, maxx, _, _ = mark_bounds(ch)
    return maxx - minx


def draw_mark(c, ch, x_mm, baseline_mm, gray, parts=None):
    """Draws mark `ch` with its ANCHOR at x_mm -- the point where the
    mark's upright axis (x=0) meets the baseline: the dot of . ! ? and the
    head of , all sit there, so a row of mixed marks lines up by the part
    that touches the line, not by ink edges (a comma's tail reaches left).
    `gray` is a reportlab gray level (0 = black). `parts` (set of part
    tags) limits which primitives are drawn; None = the whole mark."""
    ox = x_mm
    c.saveState()
    c.setStrokeGray(gray)
    c.setFillGray(gray)
    c.setLineWidth(LINE_W)
    c.setLineCap(1)
    c.setLineJoin(1)
    for prim in MARKS[ch]:
        tag = prim[-1]
        if parts is not None and tag not in parts:
            continue
        if prim[0] == "dot":
            _, cx, cy, r, _ = prim
            (sx, sy), = _shear([(cx, cy)])
            c.circle(ox + sx, baseline_mm + sy, r, stroke=0, fill=1)
        else:
            p = c.beginPath()
            for cmd in prim[1]:
                pts = [(ox + x, baseline_mm + y) for x, y in _shear(list(cmd[1:]))]
                if cmd[0] == "M":
                    p.moveTo(*pts[0])
                else:
                    p.curveTo(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1])
            c.drawPath(p, stroke=1, fill=0)
    c.restoreState()
