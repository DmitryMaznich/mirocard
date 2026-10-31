#!/usr/bin/env python3
"""Kazakh letters built from the Russian bank's strokes, by the owner's recipes (2026-10-30).

  python3 tools/propis2/variants/kk/build_glyphs.py [--preview out.html]   # raw bank coordinates: proportions are NOT the notebook's
  tools/propis2/variants/kk/preview.sh out.png '["Г Ғ","Ғалым"]'            # the real page engine: use this to judge a letter

Bank geometry (tools/propis/wide.json): baseline y=62, top of the lowercase (the narrow row's upper line) y=10,
capitals up to y=-42, 65deg slant. Each recipe names the source letter's strokes (1-based, as on the stroke
catalog sheet) and adds the new strokes; the result goes to variant.json -> glyphs (TODO once the first letters are approved).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BANK = {g["label"]: g for g in json.loads((ROOT / "tools/propis/wide.json").read_text())["glyphs"]}
X_TOP, BASE = 10.0, 62.0


def stem_x(d, y):
    """x where the first straight segment (M .. L ..) of a path crosses height y."""
    (x0, y0), (x1, y1) = [tuple(map(float, p)) for p in re.findall(r"(-?[\d.]+) (-?[\d.]+)", d)[:2]]
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


def bar(cx, y, half=14.0, bend=2.5):
    """Crossbar left to right: the left end dips by `bend`, the right end turns up by the same amount."""
    l, r = cx - half, cx + half
    return {"d": f"M {l:.2f} {y + bend:.2f} C {l + 3:.2f} {y:.2f} {l + 6:.2f} {y:.2f} {l + 9:.2f} {y:.2f} "
                 f"L {r - 9:.2f} {y:.2f} C {r - 6:.2f} {y:.2f} {r - 3:.2f} {y:.2f} {r:.2f} {y - bend:.2f}"}


def short_bar(cx, y, length=14.4):
    """A straight crossbar like э's own (its stroke 2 is 7.2 units long, on the dashed middle line y=36), doubled for ғ at the owner's request, centred on the stem."""
    return {"d": f"M {cx - length / 2:.2f} {y:.2f} L {cx + length / 2:.2f} {y:.2f}"}


def g_bar():
    """Ғ: Г strokes 1 and 2, then a crossbar through the middle of the stem on the narrow row's upper line.
    Г's stroke 3 is its tailStroke (drawn only when a letter follows), kept so Ғ joins like Г."""
    g = BANK["Г"]; s = g["strokes"]
    out = dict(g, label="Ғ", strokes=[s[0], s[1], bar(stem_x(s[0]["d"], X_TOP), X_TOP), s[2]], tailStroke=3,
               sourceLabel="Ғ = Г (штрихи 1, 2) + перекладина на верхней линии узкой строки; соединение — штрих 3 Г")
    return out


def stem_x_between(d, y):
    """x at height y on the stem of г1: the straight run between its 2nd and 3rd points (top of the stem -> bottom)."""
    pts = [tuple(map(float, p)) for p in re.findall(r"(-?[\d.]+) (-?[\d.]+)", d)]
    (x0, y0), (x1, y1) = pts[3], pts[5]  # stem top (after the hat's curve) and the stem's end before the bottom hook
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


def g_bar_lower(y=36.0, length=25.5):
    """ғ: г (г1, one stroke with its own entry and exit) + a crossbar through the middle of the stem.
    The bar is written last, so exitStroke keeps the exit (the connector to the next letter) on stroke 0."""
    g = BANK["г1"]; s = g["strokes"]
    out = {k: v for k, v in g.items() if k != "aliases"}
    out.update(label="ғ", strokes=[s[0], short_bar(stem_x_between(s[0]["d"], y), y, length)], exitStroke=0, noDotStrokes=[1],
               sourceLabel="ғ = г1 + прямая перекладина по пунктиру, длина как в казахской прописи (половина высоты строчной)")
    return out


def anchors_at(d, y):
    """Path anchor points (the ends of each C/M segment) lying at height y: the oval's left and right extremes at its waist."""
    pts = [tuple(map(float, q)) for q in re.findall(r"(-?[\d.]+) (-?[\d.]+)", d)]
    return sorted({round(x, 2) for x, yy in pts[::1] if abs(yy - y) < 1e-6})


def full_bar(d, y):
    """Straight crossbar across the whole oval at height y: from its leftmost to its rightmost point there."""
    xs = anchors_at(d, y); assert len(xs) >= 2, xs
    return {"d": f"M {xs[0]:.2f} {y:.2f} L {xs[-1] if y != 36.0 else xs[1]:.2f} {y:.2f}"}


def g_theta_upper():
    """Ө: О (oval, then the connector as its tailStroke) + a straight bar across the whole oval at its waist (y=10, the narrow row's upper line)."""
    g = BANK["О"]; s = g["strokes"]
    return dict(g, label="Ө", strokes=[s[0], full_bar(s[0]["d"], 10.0), s[1]], tailStroke=2, noDotStrokes=[1],
                sourceLabel="Ө = О + прямая перекладина на всю ширину овала")


def g_theta_lower():
    """ө: о (one stroke with entry and exit) + a straight bar across the oval on the dashed middle line (y=36); written last, the exit stays on stroke 0."""
    g = BANK["о"]; s = g["strokes"]
    return dict(g, label="ө", strokes=[s[0], full_bar(s[0]["d"], 36.0)], exitStroke=0, noDotStrokes=[1],
                sourceLabel="ө = о + прямая перекладина на всю ширину овала по пунктиру")


def tail_x(d, y):
    """x at height y on У's long straight tail (the segment from its top point (y=-42) down to the hook)."""
    pts = [tuple(map(float, q)) for q in re.findall(r"(-?[\d.]+) (-?[\d.]+)", d)]
    i = next(k for k, (_, yy) in enumerate(pts) if yy == -42.0 and k > 2 and pts[k - 1][1] > -20)  # the L ... -42 corner after the loop
    (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


TAIL_BASE_X = 145.07  # where У's straight tail meets the baseline (y=62) when it runs on along its own 65deg line from (193.57, -42)


CONN_DX = float(__import__("os").environ.get("KK_CONN_DX", 26.0))  # Ү/Ұ: raw units the connector runs right while it climbs from the foot (62) to the dashed middle line (36). On a page the next letter stands on a slant line and the engine can nudge the connector end only a few units: 26-30 closes the gap for every following letter (22 left 5.4 units), 26 is the steepest of those


def u_body(dx=None):
    """У's hat and long tail, the tail run straight on its slant to the baseline (no hook), then the connector: a steep straight
    climb to the right (the owner, 2026-10-31: part of the letter, always drawn, "резко вверх", about 45-60deg to the row).
    One stroke, so the letter's exit is its end."""
    d = BANK["У"]["strokes"][0]["d"]
    head = d[: d.index("L 193.57 -42.00") + len("L 193.57 -42.00")]
    x, y = TAIL_BASE_X, 62.0
    return {"d": f"{head} L {x:.2f} {y:.2f} L {x + (dx or CONN_DX):.2f} 36.00"}


def g_u_straight():
    """Ү: У, the tail straight on its slant to the baseline, then the sharp climb of the connector (part of the letter)."""
    g = BANK["У"]
    return dict(g, label="Ү", strokes=[u_body()],
                sourceLabel="Ү = У, хвост строго по наклонной до базовой, затем резкий подъём-соединение (часть буквы)")


def g_u_bar(y=21.9, length=12.7):
    """Ұ: Ү + a crossbar on the tail, like ғ's (straight, 14.4 long, on the dashed middle line y=36). Written last; the exit stays on stroke 0."""
    g = BANK["У"]; body = u_body()
    return dict(g, label="Ұ", strokes=[body, short_bar(tail_x(body["d"], y), y, length)], exitStroke=0, noDotStrokes=[1],
                sourceLabel="Ұ = Ү + прямая перекладина на хвосте: на 61% длины хвоста, длина четверть хвоста (как в казахской прописи)")


STRAIGHT_END = "L 110.29 106.62"  # end of у's straight descender, just before its loop
TAIL_FOOT_X = 131.40              # where that descender crosses the baseline (y=62)


def y_tail_x(y):
    """x at height y on у's straight descender, from its top (155.35, 10) to (110.29, 106.62)."""
    return 155.35 + (110.29 - 155.35) * (y - 10.0) / (106.62 - 10.0)


def y_straight_body():
    """у without the loop: the bowl and the right arm as in у, then the straight descender ending in a point (Kazakh ү)."""
    d = BANK["у"]["strokes"][0]["d"]
    return {"d": d[: d.index(STRAIGHT_END) + len(STRAIGHT_END)]}


TIP = (110.29, 106.62)  # the descender's lowest point
CONN_DX_LOWER = float(__import__("os").environ.get("KK_CONN_LOWER", 47.0))  # ү: raw units right while it climbs from the descender tip (106.6) to the dashed line (36): ~52deg on the page, i.e. ~13deg off the 65deg tail (owner, 2026-10-31: half the 24deg of the first try, which looked like Ү's ~41deg); 47-50 close the gap to every following letter on the page grid, 47 is the sharpest of them


CURVE_RUN = float(__import__("os").environ.get("KK_CURVE_RUN", 30.0))  # how far (raw y units) the connector keeps the tail's direction before it bends
CURVE_END_DEG = float(__import__("os").environ.get("KK_CURVE_END", 38.0))  # raw angle to the row at which it arrives at the contact point


def y_straight_with_exit():
    """у without the loop: bowl, right arm, the straight descender to its lowest point, then the connector (owner, 2026-10-31): it leaves
    that very point along the tail, and after the first ~10% bends gently, like a flat parabola, up to the contact point at the dashed line
    (the same point as the straight version's end). One cubic: first control on the tail's own direction, second on the arrival direction."""
    import math
    b = y_straight_body()
    x0, y0 = TIP
    x3, y3 = TIP[0] + CONN_DX_LOWER, 36.0
    k = math.tan(math.radians(25))  # the tail's 65deg lean: x per unit of height
    x1, y1 = x0 + CURVE_RUN * k, y0 - CURVE_RUN
    arr = math.radians(CURVE_END_DEG)
    run2 = float(__import__("os").environ.get("KK_CURVE_ARR", 25.0))
    x2, y2 = x3 - run2 * math.cos(arr), y3 + run2 * math.sin(arr)
    return {"d": f"{b['d']} C {x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f} {x3:.2f} {y3:.2f}"}


def g_ue_lower():
    """ү: у with a straight pointed descender, no loop; the connector leaves the descender at the baseline."""
    g = {k: v for k, v in BANK["у"].items() if k != "aliases"}
    g.update(label="ү", strokes=[y_straight_with_exit()], exitStroke=0,
             sourceLabel="ү = у с прямым хвостом без петли; соединение — прямая из нижней точки хвоста под очень острым углом к нему")
    return g


def g_u_bar_lower(y=73.8, length=14.7):
    """ұ: ү + a horizontal bar across the descender (from the PDF: 66% down it, 30 units long, centred)."""
    g = g_ue_lower()
    g.update(label="ұ", strokes=[g["strokes"][0], short_bar(y_tail_x(y), y, length)], exitStroke=0, noDotStrokes=[1],
             sourceLabel="ұ = ү + горизонтальная перекладина на хвосте (как в казахской прописи)")
    return g


def tail_of(label, hook_start):
    """The tail of Ц / ц (owner, 2026-10-31: «как у Ц», the outgoing connection too, capital and lowercase): everything after the foot of the
    right stem, i.e. the hook, the retrace down the stem line into the descender loop and the exit up to the dashed line. Returns the path text
    that follows the point `hook_start` of the glyph's single stroke, and that start point."""
    d = BANK[label]["strokes"][0]["d"]
    i = d.index(f"{hook_start[0]:.2f} {hook_start[1]:.2f}") + len(f"{hook_start[0]:.2f} {hook_start[1]:.2f}")
    return d[i:].strip(), hook_start


def shifted(path, dx, dy):
    """A path text with every coordinate pair moved by (dx, dy) (M / L / C / Q only, as the bank writes them)."""
    toks = re.findall(r"[MLCQ]|-?[\d.]+", path)
    out, k = [], 0
    for t in toks:
        if t in "MLCQ": out.append(t); continue
        out.append(f"{float(t) + (dx if k % 2 == 0 else dy):.2f}"); k += 1
    return " ".join(out)


def graft(d, cut, tail_label, tail_start):
    """`d` up to and including the point `cut` (x, y) of its path, then Ц/ц's tail moved so that its start lands on that point."""
    key = f"{cut[0]:.2f} {cut[1]:.2f}"
    head = d[: d.index(key) + len(key)]
    tail, ts = tail_of(tail_label, tail_start)
    return f"{head} {shifted(tail, cut[0] - ts[0], cut[1] - ts[1])}"


def g_kz_upper():
    """Қ: К with Ц's tail instead of its leg's foot hook and exit (the leg is stroke 2, it keeps the exit)."""
    g = BANK["К"]; s = g["strokes"]
    return dict(g, label="Қ", strokes=[s[0], {"d": graft(s[1]["d"], (175.84, 50.58), "Ц", (148.65, 54.05))}],
                sourceLabel="Қ = К, нога заканчивается хвостом и выходом Ц")


def g_kz_lower():
    """қ: к with ц's tail instead of its leg's foot hook and exit."""
    g = BANK["к"]; s = g["strokes"]
    return dict(g, label="қ", strokes=[s[0], {"d": graft(s[1]["d"], (143.31, 55.13), "ц", (135.18, 53.26))}],
                sourceLabel="қ = к, нога заканчивается хвостом и выходом ц")


def g_ng_upper():
    """Ң: Н with Ц's tail instead of its right stem's foot hook and exit."""
    g = BANK["Н"]; s = g["strokes"]
    return dict(g, label="Ң", strokes=[{"d": graft(s[0]["d"], (174.21, 54.05), "Ц", (148.65, 54.05))}],
                sourceLabel="Ң = Н, правая стойка заканчивается хвостом и выходом Ц")


def g_ng_lower():
    """ң: н with ц's tail instead of its right stem's foot hook and exit."""
    g = BANK["н"]; s = g["strokes"]
    return dict(g, label="ң", strokes=[{"d": graft(s[0]["d"], (134.98, 53.68), "ц", (135.18, 53.26))}],
                sourceLabel="ң = н, правая стойка заканчивается хвостом и выходом ц")


def g_schwa_upper():
    """Ә (owner, 2026-10-31): Э's stroke 1 from the hat down its stem, exactly as Э, as far as the point (145.38, 60.02) just above its bottom.
    From there one smooth round arc, as the owner drew it in red on the render: to the baseline, round the bottom-left corner (rounded, not
    squared), up the left side (slightly bulging) and into the belly's closing: a horizontal run right along the narrow row's upper line
    (y=10) into the stem. The exit is Э's own tail from the new lowest point, drawn only when a letter follows."""
    g = BANK["Э"]; s = g["strokes"]
    d = s[0]["d"]
    key = "145.38 60.02"
    assert key in d, "Э's stem point not found"
    head = d[: d.index(key) + len(key)]
    B, E = (141.5, 62.0), (138.6, 44.5)
    C1, C2 = (137.6, 62.0), (136.2, 55.5)       # the corner: C1 is short, so it is rounded; C2 makes the left side bulge a little
    arc = (f"C 143.40 61.60 144.00 62.00 {B[0]:.2f} {B[1]:.2f} "           # on from Э's own path to the lowest point, arriving heading left
           f"C {C1[0]:.2f} {C1[1]:.2f} {C2[0]:.2f} {C2[1]:.2f} {E[0]:.2f} {E[1]:.2f} ")
    top = 160.4
    belly = (f"C 141.10 32.70 {top - 9.4:.2f} 9.00 {top:.2f} 10.00 "      # tangent-continuous with the arc's end
             f"C {top + 5.0:.2f} 10.00 {175.9 - 8.0:.2f} 10.00 175.90 10.00")
    back = f"M {E[0]:.2f} {E[1]:.2f} C {C2[0]:.2f} {C2[1]:.2f} {C1[0]:.2f} {C1[1]:.2f} {B[0]:.2f} {B[1]:.2f}"   # the exit retraces the arc down to the lowest point
    tail = shifted(s[2]["d"][s[2]["d"].index("C 151.12 61.68"):], B[0] - 142.12, B[1] - 61.68)
    return dict(g, label="Ә", strokes=[{"d": f"{head} {arc}{belly}"}, {"d": f"{back} {tail}"}], exitStroke=0, tailStroke=1,
                sourceLabel="Ә = Э до нижней точки стойки, затем скруглённая дуга по эскизу владельца и горизонтальное замыкание по верхней линии строки; выход Э")


def old_card_stroke(label):
    """The first version of the copybook (the archived topic `propis`, tools/propis/topic.json): the letter card's first stroke."""
    cards = json.loads((ROOT / "tools/propis/topic.json").read_text())["cards"]
    return next(c for c in cards if c.get("label") == label)["strokes"][0]["d"]


def bezier_points(P, per=30):
    """Dense points along `M p0 C c1 c2 p ...` given as the list [p0, c1, c2, p, c1, c2, p, ...]."""
    import numpy as np
    P = np.array(P, float); out = [P[0]]
    for j in range((len(P) - 1) // 3):
        p0, c1, c2, p1 = P[3 * j], P[3 * j + 1], P[3 * j + 2], P[3 * j + 3]
        for t in np.linspace(0, 1, per + 1)[1:]:
            u = 1 - t
            out.append(u ** 3 * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t ** 3 * p1)
    return np.array(out)


def smooth_path_d(pts, knots=14, sigma=3.2, step=0.4):
    """A hand-drawn path made smooth (owner, 2026-10-31: «красивая плавная траектория от начала и до конца, исправить все мелкие искривления»):
    the polyline is resampled evenly along its length, smoothed with a Gaussian of width `sigma` units (the ends are mirrored through themselves so
    the start and the end stay put and keep their direction), then drawn again as ONE smooth chain of `knots` cubic Béziers' worth of points
    (Catmull-Rom through points spaced evenly along the length): no small wobbles are left, only the large shape."""
    import numpy as np
    q = np.array(pts, float)
    seg = np.hypot(*np.diff(q, axis=0).T); acc = np.concatenate([[0], np.cumsum(seg)])
    n = max(int(acc[-1] / step), 20)
    ts = np.linspace(0, acc[-1], n)
    r = np.stack([np.interp(ts, acc, q[:, c]) for c in (0, 1)], 1)
    half = int(4 * sigma / step)
    k = np.exp(-0.5 * (np.arange(-half, half + 1) * step / sigma) ** 2); k /= k.sum()
    pad_a = 2 * r[0] - r[1:half + 1][::-1]          # odd reflection: the curve goes on through the start with the same direction
    pad_b = 2 * r[-1] - r[-half - 1:-1][::-1]
    ext = np.vstack([pad_a, r, pad_b])
    sm = np.stack([np.convolve(ext[:, c], k, mode="valid") for c in (0, 1)], 1)
    sm[0], sm[-1] = r[0], r[-1]
    seg = np.hypot(*np.diff(sm, axis=0).T); acc = np.concatenate([[0], np.cumsum(seg)])
    tk = np.linspace(0, acc[-1], knots)
    K = np.stack([np.interp(tk, acc, sm[:, c]) for c in (0, 1)], 1)
    ex = np.vstack([2 * K[0] - K[1], K, 2 * K[-1] - K[-2]])
    out = [f"M {K[0][0]:.2f} {K[0][1]:.2f}"]
    for i in range(1, len(ex) - 2):
        p0, p1, p2, p3 = ex[i - 1], ex[i], ex[i + 1], ex[i + 2]
        c1 = p1 + (p2 - p0) / 6.0; c2 = p2 - (p3 - p1) / 6.0
        out.append(f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}")
    return " ".join(out)


def first_self_crossing(pts, skip=12):
    """Index i and the point where the polyline's segment i first crosses an earlier, non-neighbouring segment (None if it never does)."""
    def inter(p, q, r, t):
        d1, d2 = (q[0] - p[0], q[1] - p[1]), (t[0] - r[0], t[1] - r[1])
        den = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(den) < 1e-12: return None
        u = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den
        v = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / den
        return (p[0] + u * d1[0], p[1] + u * d1[1]) if 0 <= u <= 1 and 0 <= v <= 1 else None
    for i in range(skip, len(pts) - 1):
        for j in range(0, i - skip):
            x = inter(pts[i], pts[i + 1], pts[j], pts[j + 1])
            if x is not None: return i, x
    return None


# о's connector: from the lowest point of the oval to the exit point E, (+39.1, -26) away, leaving it rising at 15 degrees and arriving along а's exit
# (glyphOverrides.js steepenExit): the same curve for every letter that joins "like о"
CONN_RUN, CONN_RISE = 39.1, 26.0


SCHWA_DX = float(__import__("os").environ.get("KK_SCHWA_DX", 58.0))  # raw units right while the connector climbs all the way to the narrow row's upper line. The next letter stands on a slant line, so only some lengths join it (gap 0-0.6 for н ш т к и р п). With ә's start on the slant line of the bowl's left edge, a little earlier (align_start_to_bowl, BACK_U) those are up to 34 and 58-66; 58 is the steepest of the second: ~37deg on the page, the angle of the PDF (owner, 2026-10-31)


def kazakh_tail(bx, by, dx=None, ey=None):
    """The connector of ә: EXACTLY o's (owner, 2026-10-31: «точно такое же соединение, как с о»). o's own connector in the bank is the last cubic of its stroke,
    from the lowest point to the exit point (+39.1, -26) away, redrawn by glyphOverrides.js steepenExit (leaves the bottom rising at 15 degrees, arrives along
    the exit of а); the engine then stretches every bank glyph by `stretch` = 1.806 across (stretchKeepSlantPathD: x' = s x - (s-1) tan25 (62 - y)). ә is drawn
    in the already-wide frame (no stretch), so the same curve is built here and carried through that very transformation about the lowest point."""
    import math
    S, T = float(__import__("os").environ.get("KK_TAIL_S", 1.5)), math.tan(math.radians(25.0))
    ex, ey = 39.1, -26.0                                   # raw offsets of the exit from the lowest point
    run, rise = 153.61 - 135.46, 56.28 - 36.0
    ln = math.hypot(run, rise); ux, uy = run / ln, -rise / ln
    th = math.radians(15.0)
    chord = math.hypot(ex, ey); k = chord * 0.35
    raw = [(0.0, 0.0), (math.cos(th) * k, -math.sin(th) * k), (ex - ux * k, ey - uy * k), (ex, ey)]
    wide = [(S * x - (S - 1) * T * (0.0 - y), y) for x, y in raw]   # offsets from the lowest point, y up = negative; (by - y) = -y
    p = [(bx + x, by + y) for x, y in wide]
    return {"d": f"M {p[0][0]:.2f} {p[0][1]:.2f} C {p[1][0]:.2f} {p[1][1]:.2f} {p[2][0]:.2f} {p[2][1]:.2f} {p[3][0]:.2f} {p[3][1]:.2f}"}


BACK_U = float(__import__("os").environ.get("KK_BACK_U", 8.0))  # how far back along the slant (in x + 0.4663 y units) the start is taken from that line: «чуть-чуть назад»


def align_start_to_bowl(dense):
    """The start of ә (owner, 2026-10-31): the old е's entry begins about 19 units left of the bowl, so ә stood far from the letter before it. The
    letter is NOT redrawn: the very same trajectory is started LATER, at the point of the entry that lies on the same slant line as the left edge of
    the bowl (the slant line touching the bowl on the left: the minimum of x + 0.4663 y over the bowl). What came before that point is cut off."""
    t = 0.4663
    top = min(range(len(dense)), key=lambda i: dense[i][1])                      # the top of the arc: after it comes the right side and the bowl
    bowl = [q for q in dense[top:] if q[1] > dense[0][1] + 2]                   # the bowl: below the entry's height
    u_left = min(q[0] + t * q[1] for q in bowl)                                  # its left edge along the slant
    j = next(i for i, q in enumerate(dense) if q[0] + t * q[1] >= u_left - BACK_U)  # the entry point on that slant line, a little earlier
    return dense[j:]


def g_schwa_lower():
    """ә (owner, 2026-10-31): the FIRST version's lowercase е (the old card, not the bank's е), turned through 180 degrees about the midpoint
    of its start and end (a mirror in the vertical, then in the horizontal), written backwards, and its hand-drawn wobbles smoothed out
    (smooth_path_d). The line ENDS where it crosses the right side (no stub beyond the crossing). The connector to the next letter is a stroke of
    its own, as o's: from the lowest point of the bowl, only when a letter follows (tailStroke). Scaled uniformly (the old cards are in a
    100x150 box, the 65deg slant already in place) so that its x-height fills the bank's band (baseline 62, top 10); no stretch."""
    d = old_card_stroke("е")
    nums = [float(x) for x in re.findall(r"-?[\d.]+", d)]
    xs, ys = nums[0::2], nums[1::2]
    sx, sy, ex, ey = xs[0], ys[0], xs[-1], ys[-1]
    ybot, ytop = max(ys), min(ys)
    k = 52.0 / (ybot - ytop)
    X0 = 124.7                                         # the bank's е starts here; only the start matters (the engine places by it)
    f = lambda x, y: (X0 + (ex - x) * k, 62.0 - (ybot - (sy + ey - y)) * k)
    P = [f(x, y) for x, y in zip(xs, ys)]
    lift = 62.0 - max(q[1] for q in bezier_points(P))   # the turned letter is not symmetric about the start-end midpoint: put its bowl on the baseline
    dense = [(q[0], q[1] + lift) for q in bezier_points(P)[::-1]]  # written backwards: the pen starts at the image of the old END (on the left)
    dense = align_start_to_bowl(dense)
    cross = first_self_crossing(dense)
    if cross: dense = dense[: cross[0] + 1] + [cross[1]]  # the line ends on the crossing
    body = smooth_path_d(dense)
    low = max(dense, key=lambda q: q[1])
    g = BANK["е"]
    res = {k_: v for k_, v in g.items() if k_ not in ("strokes", "sourceLabel", "stretch")}
    res.update(label="ә", strokes=[{"d": body}, kazakh_tail(low[0], low[1])], exitStroke=0, tailStroke=1, tailLift=True, tailContinuous=True, joinAtStart=True,
               sourceLabel="ә = строчная е первой версии прописей (старая карточка), повёрнутая на 180° и сглаженная; соединение прямой вверх под острым углом, как в казахской прописи")
    return res


def g_apex(label):
    """л, м as in the Russian bank, only marked `growToApex`: after a letter whose connector ends on the middle line (ә) the connector is carried up to the first
    top of the letter, as in the Kazakh copybook («Бол»: the connector runs into the left leg of л). The glyph itself is not changed."""
    g = BANK[label]
    out = {k: v for k, v in g.items() if k != "aliases"}
    out["growToApex"] = True
    return out


def stretched_x(x, y, S=1.806, T=0.46630765815499864):
    """x of a bank point after the engine's stretch (stretchKeepSlantPathD about the baseline 62)."""
    return S * x - (S - 1) * T * (62.0 - y)


def g_i_upper():
    """І (owner, 2026-10-31): the opening FLAG of К (its first stroke from its start up to the top of its stem), then the long straight stem of У (from the top
    down to the baseline) with У's bottom hook; the stem is moved sideways so that it starts where the flag ends (the slant is the same, so it stays on its
    slant). The connector to the next letter is У's («после І соединение по принципу У»): from the lowest point of the hook, o's curve. The engine ends it at a fixed
    distance from the START of the letter (the point where Ч's exit arrives); І starts 25 units further left of its stem than У does, so that point is moved
    (the helper glyph ч_iend) to keep the connector exactly as long and as steep as У's."""
    k = BANK["К"]["strokes"][0]["d"]
    flag = k[: k.index("201.04 -42.00") + len("201.04 -42.00")]
    u = BANK["У"]["strokes"][0]["d"]
    stem = u[u.index("L 193.57 -42.00") + len("L 193.57 -42.00"):].strip()      # L 148.78 54.05 C ... the hook ... L 139.19 36.00
    d = f"{flag} {shifted(stem, 201.04 - 193.57, 0.0)}"
    g = BANK["У"]
    out = {kk: v for kk, v in g.items() if kk not in ("sourceLabel", "strokes")}
    out.update(label="І", strokes=[{"d": d}], noOverrides=True, joinFrom={"stroke": 0}, joinLikeLabel="о", joinEndLikeLabel="ч_iend",
               sourceLabel="І = флажок К + прямая стойка У с её крючком; соединение как у У")
    return out


def g_i_end_marker():
    """A helper glyph, not a letter: it starts where І starts and ends where the connector of І should arrive, so that this connector equals У's
    (the same distance from the lowest point of the hook to its end)."""
    S = 1.806
    ch, u = BANK["Ч"]["strokes"][0]["d"], BANK["У"]["strokes"][0]["d"]
    ux, uy = (float(v) for v in re.findall(r"-?[\d.]+", u)[:2])                 # У's start
    sx, sy = -0.0 + 170.00, -14.10                                                 # І's start (the flag of К)
    chx, chy = 175.20, 36.0                                                        # where Ч's exit (= У's connector end) arrives, in У's frame
    lowU = 141.07                                                                  # the lowest point of У's hook (x), I's is 7.47 right of it
    # local (stretched, relative to the start) end of У's connector, and of the same connector under I's own hook
    endU = stretched_x(chx, chy) - stretched_x(ux, uy)
    lowU_local = stretched_x(lowU, 62.0) - stretched_x(ux, uy)
    lowI_local = stretched_x(lowU + 7.47, 62.0) - stretched_x(sx, sy)
    endI = endU + (lowI_local - lowU_local)
    ex = sx + (endI - (-(S - 1) * 0.46630765815499864 * ((62.0 - chy) - (62.0 - sy)) * 1.0)) / S
    return {"label": "ч_iend", "kind": "letter", "stretch": S, "strokes": [{"d": f"M {sx:.2f} {sy:.2f} C {sx:.2f} {sy:.2f} {ex:.2f} {chy:.2f} {ex:.2f} {chy:.2f}"}],
            "sourceLabel": "служебный: точка, где кончается соединение І"}


def g_i_lower():
    """і (owner, 2026-10-31): the stem of и (its second stem, from the peak down, with the hook and the exit) and a dot over it like ё's (1.5 times as big)."""
    d = BANK["и"]["strokes"][0]["d"]
    stem = d[d.index("L 154.66 11.48") + 2:]                                       # 154.66 11.48 L 135.18 53.26 C ... L 161.22 36
    d1 = "M " + stem.strip()
    sx = 154.66 + 0.4663 * 8.5                                                      # a little right of the top of the stem, along the slant, at ё's dot height
    out = {k_: v for k_, v in BANK["и"].items() if k_ not in ("sourceLabel", "strokes")}
    out.update(label="і", strokes=[{"d": d1}, {"d": f"M {sx - 0.5:.2f} 3.00 L {sx + 0.55:.2f} 3.00"}], noDotStrokes=[1], dotStrokes=[1], dotWidth=3,
               sourceLabel="і = вторая стойка и с выходом + точка как у ё")
    return out


RECIPES = [g_bar, g_bar_lower, g_theta_upper, g_theta_lower, g_u_straight, g_u_bar, g_ue_lower, g_u_bar_lower, g_kz_upper, g_kz_lower, g_ng_upper, g_ng_lower, g_schwa_upper, g_schwa_lower, lambda: g_apex("л"), lambda: g_apex("м"), g_i_upper, g_i_end_marker, g_i_lower]


def preview(glyphs, path):
    cells = ""
    for g in glyphs:
        paths = "".join(f'<path d="{s["d"]}" fill="none" stroke="{c}" stroke-width="2.6" stroke-linecap="round"/>'
                        for s, c in zip(g["strokes"], ["#d62728", "#1f77b4", "#2ca02c", "#bbb", "#9467bd"]))
        cells += (f'<div style="display:inline-block;margin:10px;text-align:center"><svg viewBox="100 -55 130 135" width="260" height="270">'
                  f'<line x1="100" x2="230" y1="{BASE}" y2="{BASE}" stroke="#e88"/><line x1="100" x2="230" y1="{X_TOP}" y2="{X_TOP}" stroke="#99e"/>'
                  f'<line x1="100" x2="230" y1="-42" y2="-42" stroke="#99e"/>{paths}</svg><br>{g["label"]}</div>')
    Path(path).write_text(f"<html><body style='font:20px sans-serif'>{cells}</body></html>")


if __name__ == "__main__":
    built = [r() for r in RECIPES]
    if "--preview" in sys.argv: preview(built, sys.argv[sys.argv.index("--preview") + 1])
    else: print(json.dumps(built, ensure_ascii=False, indent=1))
