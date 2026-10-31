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


SLANT_T = 0.4663  # x shift per unit of height along a 65deg slant line


def belly_of_v(attach, top_y=4.0):
    """The lower belly of в (its loop after the stem point (152.19, 36)), mirrored across the slant line through `attach` (the stem
    point of the letter it is joined to), so it lies LEFT of the stem; the belly's top is raised from в's 10 to `top_y` (owner: a bit above
    the narrow row's upper line). Returns (path text of the belly cubics, the belly's lowest point). The last cubic of в (its exit to the
    right) is left out: the exit is the letter's own connector."""
    d = BANK["в"]["strokes"][0]["d"]
    key = "152.19 36.00"
    tail = d[d.index(key) + len(key):]
    k = (62.0 - top_y) / (62.0 - 10.0)  # raise the belly about the baseline
    cut = tail.rfind(" C ")
    tail = tail[:cut]  # without the final exit cubic
    u0 = attach[0] + SLANT_T * attach[1]
    y_att = 62.0 - (62.0 - 36.0) * k
    toks = re.findall(r"[MLCQ]|-?[\d.]+", tail)
    out, nums = [], []
    for t in toks:
        if t in "MLCQ": out.append(t); continue
        nums.append(float(t))
    pts = list(zip(nums[0::2], nums[1::2]))
    res = []
    for x, y in pts:
        y2 = 62.0 - (62.0 - y) * k
        x2 = x + (attach[0] - 152.19)
        y3 = y2 + (attach[1] - y_att)
        u = x2 + SLANT_T * y3
        res.append((2 * u0 - u - SLANT_T * y3, y3))
    text, i = [], 0
    for t in out:
        n = {"C": 3, "L": 1, "Q": 2, "M": 1}[t]
        text.append(t + " " + " ".join(f"{px:.2f} {py:.2f}" for px, py in res[i:i + n])); i += n
    return " ".join(text), res[-1]


def g_schwa_upper():
    """Ә: Э's top and stem, then a belly like в's lower one but mirrored (left of the stem, its top a bit above the row's upper line), then
    Э's own exit (a tail stroke: drawn only when a letter follows)."""
    g = BANK["Э"]; s = g["strokes"]
    d = s[0]["d"]; cut = (165.01, 31.15)
    head = d[: d.index("165.01 31.15") + len("165.01 31.15")]
    belly, low = belly_of_v(cut)
    ex = s[2]["d"]; sx, sy = 142.12, 61.68
    exit_d = shifted(ex, low[0] - sx, low[1] - sy)
    return dict(g, label="Ә", strokes=[{"d": f"{head} {belly}"}, {"d": exit_d}], exitStroke=0, tailStroke=1,
                sourceLabel="Ә = верх и стойка Э + нижнее пузо в, зеркально (слева от стойки), выход Э")


RECIPES = [g_bar, g_bar_lower, g_theta_upper, g_theta_lower, g_u_straight, g_u_bar, g_ue_lower, g_u_bar_lower, g_kz_upper, g_kz_lower, g_ng_upper, g_ng_lower, g_schwa_upper]


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
