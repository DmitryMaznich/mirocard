#!/usr/bin/env python3
"""Letters of the Bulgarian variant (`propis2_bg`) that the shared bank lacks: raw hand captures -> glyphs in variant.json.

  python3 tools/propis2/variants/bg/build_glyphs.py

Reads  tools/propis2/variants/bg/captures/*.json  (handwriting capture tool, a capital drawn on the narrow band: base y=88)
Writes the glyphs into tools/propis2/variants/bg/variant.json `glyphs` (by label; the other glyphs there stay)

Two kinds of capture: a letter of LETTERS (Ъ, drawn freehand, below) and a letter traced over a Boyan underlay (the rest, below).

The same treatment as the digits (tools/propis2/build_digit_glyphs.py, whose helpers are used): the stroke is smoothed between its
corners and refit as cubics, then made as tall as a capital (y -42..62, base 62) — taller, not wider, the slant kept — and its
lowest point stands on the baseline. A letter that ends inside its bowl (Ъ) gets the connector of Б: a separate stroke from under
the bowl to the middle of the band, drawn only when another letter follows (`tailStroke`).
"""
import json, math, re, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "tools/propis2"))
import build_digit_glyphs as dg  # noqa: E402  (the digits' pipeline; its main() runs only as a script)
sys.path.insert(0, str(HERE))
import tidy_trace as tt  # noqa: E402  (also parse_path: the capture tool writes cubics, dg.parse reads no C)

VARIANT = HERE / "variant.json"

# The letters are built on the paper they were fitted on, one by one with the owner (DESIGN: «Тетрадка 1 клас»'s bands, 1.526 :
# 1 : 1.465), then made smaller evenly, across the slant as much as up (CAP_K, rescaled()), to the deck's own paper (meta.script:
# the bands of a teacher's writing video, 1.231 : 1 : 1.211; owner, 2026-10-19): the font stencil they were fitted to is set
# evenly to the capital's height too (stencil_map), so on the new paper it is the same letter over the same font, only smaller
DESIGN = {"slantDeg": 76, "upper": 1.526, "lower": 1.465}
CAP_K = (1 + json.loads(VARIANT.read_text())["meta"]["script"]["upper"]) / (1 + DESIGN["upper"])
DECK_LOWER = json.loads(VARIANT.read_text())["meta"]["script"]["lower"]
CAPTURES = HERE / "captures"
FOOT_Y = 62.0  # the bottom of a capital's bowl on the baseline, as the deck's capitals (Б, В, Ь-like bowls) stand
# Б's connector in wide.json, from the bottom of its bowl: "M 156.94 62.00 C 165.94 62.00 186.34 43.05 196.06 36.00", relative
TAIL = [(9.00, 0.00), (29.40, -18.95), (39.12, -26.00)]
# per letter: what it needs beyond the capture (the bowl it ends in gets Б's connector)
# `flag`: the lead-in up to the top of the stem is smoothed as ONE piece with this sigma (units), its corners not kept: the hand drew
# the flag of Ъ as a sharp «М», the copybook writes a wave (owner, 2026-10-18: «сгладь только флажок»); the rest keeps its corners.
LETTERS = {
    # Ъ: from the font now (owner, 2026-10-18: the freehand one «далёк от образца»); its capture stays in captures/ as the record
    "Ъ": {"font": True, "flag": 3.0, "note": "Ъ (болгарская заглавная: флажок, стойка, овал строчной высоты; без связки: соединения отдельно, владелец 2026-10-19)"},
}


def flag_smoothed_path(d, sigma):
    """dg.stroke_path, but the lead-in (start .. the top of the stem, the highest point of the stroke's first part) is one smooth
    piece: no corners inside it, smoothed with `sigma`; the corner at the top of the stem and everything after it as dg does."""
    p = dg.resample(dg.parse(d), dg.SPACING)
    top = int(np.argmin(p[: max(2, len(p) * 2 // 5), 1]))
    w = max(1, int(dg.CORNER_WIN / dg.SPACING))
    cuts = [0, top] + [c for c in dg.corners(p, dg.SPACING) if c > top + 2 * w] + [len(p) - 1]
    cmds = []
    for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
        piece = p[a:b + 1]
        if len(piece) < 2: continue
        if not cmds: cmds.append(("M", [piece[0]]))
        if i > 0 and dg.straight(piece):
            cmds.append(("L", [piece[-1]]))
            continue
        if i == 0:
            keep, dg.SIGMA = dg.SIGMA, sigma
            sm = dg.smooth(piece, dg.SPACING)
            dg.SIGMA = keep
        else:
            sm = dg.smooth(piece, dg.SPACING)
        for c1, c2, e in dg.beziers(sm, dg.SPACING): cmds.append(("C", [c1, c2, e]))
    return cmds


# Letters traced over the Boyan underlays (make_underlays.py): the underlay already stands on the tool's ruling at the bank's
# geometry, so the capture is taken at the fixed scale of the ruling (x2: the tool's lowercase 26 is the bank's 52, base 88 -> 62)
# and then tidied ON THE DECK'S PAPER (tidy_trace.py: straight lines straight, hooks smooth, the bar horizontal, standing on the
# baseline, a capital reaching the top line). Any captured label not in LETTERS is such a letter.
# BANK_KEPT: traced, but the owner chose the bank's own letter (2026-10-18: «строчную можно взять русскую а»).
BANK_KEPT = set("а")
# FONT_LOWER: the lowercase built from the font's pen path (font_lower); а stays the bank's (BANK_KEPT)
FONT_LOWER = "бвгдежзийклмнопрстуфхцчшщъьюя"
# FONT_ONLY: capitals built from the font's pen path when no capture of them exists (font_letter); a capture, when it comes, wins
FONT_ONLY = "НОПРСТУФХЦЧШЩЮЯ"
# DROPPED: capitals the deck builds itself (propis2 glyphOverrides MARKED_CAPITALS): Й is our И with the breve of the bank's й above
# it, as in the Russian deck (owner, 2026-10-19: «должна быть точно такая же, как И, и с шляпкой над линией на небольшом расстоянии
# сверху ... практически как в русской версии»; the font's Й is shorter, the breve inside the letter's height)
DROPPED = set()  # Й: back as short_breve_i (the deck's own centring missed our И's stems)
# LOOPS: the hand turned back sharply where the font (and the copybook) has a small loop: the waist of Е (font comparison sheet,
# 2026-10-18). tidy_trace makes every sharp turn away from the ruling a loop in these letters.
LOOPS = set()  # Е: no loop after all (owner, 2026-10-19: «там не должно быть петли ... две дуги соединяются»)


def _fit_ellipse(p):
    """Least-squares ellipse through points (Fitzgibbon): centre, unit axes e1 (the one nearer the horizontal), e2, semi-axes a, b."""
    x, y = p[:, 0], p[:, 1]
    D = np.c_[x * x, x * y, y * y, x, y, np.ones_like(x)]
    S = D.T @ D
    C = np.zeros((6, 6)); C[0, 2] = C[2, 0] = 2; C[1, 1] = -1
    w, v = np.linalg.eig(np.linalg.solve(S, C))
    A, B, Cc, Dd, E, F = np.real(v[:, np.argmax(np.real(w))])
    M = np.array([[A, B / 2], [B / 2, Cc]])
    c = np.linalg.solve(2 * M, [-Dd, -E])
    k = c @ M @ c - F
    ev, evec = np.linalg.eigh(M)
    axes = np.sqrt(k / ev)
    i = int(np.argmax(np.abs(evec[0])))  # the axis running more across the page
    return c, evec[:, i], evec[:, 1 - i], axes[i], axes[1 - i]


def oval_lower_bowl(strokes, stroke=1, widen=1.12):
    """В: the lower bowl (after the turn back at the waist) redrawn as an even oval, wider than the hand's (owner, 2026-10-18:
    «нижнее пузо ... чуть-чуть увеличить», then «нужно было сделать равномерный такой овал», not stretched right and down).
    The oval is the ellipse that best fits the hand's bowl, made `widen` times wider across, standing on the baseline and moved
    along it until it passes through the turn at the waist; the stroke runs round it from there to where the hand's end lies on it."""
    cmds = strokes[stroke]
    ends = np.array([ps[-1] for _, ps in cmds])
    up = tt.upright(ends)
    waist = [k for k in range(1, len(cmds) - 1) if tt.X_TOP - 25 < ends[k, 1] < tt.X_TOP + 10]
    w = min(waist, key=lambda k: up[k, 0])  # the turn back: the leftmost point there
    bowl = np.array(tt.parse_path(tt.dg.fmt([("M", [ends[w]])] + cmds[w + 1:])))
    c, e1, e2, a, b = _fit_ellipse(bowl[3:])
    a *= widen
    P = lambda t, c: c + a * np.cos(t) * e1 + b * np.sin(t) * e2
    dP = lambda t: -a * np.sin(t) * e1 + b * np.cos(t) * e2
    ts = np.linspace(0, 2 * np.pi, 721)
    c = c + [0, tt.BASE - max(P(t, c)[1] for t in ts)]  # its bottom on the baseline
    # along the baseline until the waist lies on it (on its upper left)
    cusp = bowl[0]
    def miss(dx):
        cc = c + [dx, 0]
        pts = np.array([P(t, cc) for t in ts])
        d = np.hypot(*(pts - cusp).T)
        d[(pts[:, 0] > cc[0]) | (pts[:, 1] > cc[1])] = np.inf  # on its upper left only (the waist is where the bowl begins)
        return d.min()
    dx = min(np.linspace(-40, 40, 801), key=miss)
    c = c + [dx, 0]
    near = lambda q: ts[int(np.argmin([np.hypot(*(P(t, c) - q)) for t in ts]))]
    t0, t1 = near(cusp), near(bowl[-1])
    # round the way the hand went (through the bowl's rightmost point)
    tr = near(bowl[np.argmax(bowl[:, 0])])
    span = (t1 - t0) % (2 * np.pi)
    if not ((tr - t0) % (2 * np.pi) < span): span -= 2 * np.pi
    n = int(np.ceil(abs(span) / (np.pi / 2)))
    lower = []
    for k in range(n):
        ta, tb = t0 + span * k / n, t0 + span * (k + 1) / n
        h = 4 / 3 * np.tan((tb - ta) / 4)
        lower.append(("C", [P(ta, c) + h * dP(ta), P(tb, c) - h * dP(tb), P(tb, c)]))
    head = cmds[:w + 1]
    head[-1] = (head[-1][0], head[-1][1][:-1] + [P(t0, c)])  # the waist exactly on the oval
    strokes[stroke] = head + lower
    return strokes


PAPER = {}  # label -> its tidied strokes on paper, for a letter that takes a part from another (tidy() below)
# label -> its strokes as tidied before snap_to_font: Г takes Б's hat and stem height from Б as it was before Б was snapped onto
# the font (2026-10-19); Г gets its own turn
PAPER_UNSNAPPED = {}
STENCIL_AT = HERE / "stencil_at.json"  # where the font stencil stood under each snapped letter (review_sheet.py lays it there too)


def hat_like(source, stroke=1, src_stroke=1):
    """Г, П: the hat (the flag over the stem; `stroke` here, `src_stroke` there) is Б's, placed the same way against the stem's top (owner, 2026-10-18: «верхние шляпы
    должны быть одинаковые ... по текущей шляпе от Б»). Б's capture comes before Г's (captures/ in order)."""
    def adjust(strokes):
        src = PAPER_UNSNAPPED.get(source, PAPER[source])
        # the same height as there (both stand on the same ruling: the hat on the top line); across, as far from the stem as there,
        # the stem measured at the height where the source's stem begins
        top = np.asarray(src[0][0][1][0], float)
        stem = np.array(tt.parse_path(tt.dg.fmt(strokes[0])))
        at = stem[np.argmin(np.abs(stem[:, 1] - top[1]))]
        offset = np.array([at[0] - top[0], 0.0])
        strokes[stroke] = [(c, [np.asarray(q, float) + offset for q in ps]) for c, ps in src[src_stroke]]
        return strokes
    return adjust


def hat_to_stem(hat=2, stem=1):
    """П: the hat's flat part runs on to the right until its end lies on the slant line through the top of the right stem
    (owner, 2026-10-19: «удлини шляпу вправо, чтобы край находился на одной наклонной прямой с краем правого вертикального
    штриха»). The flat line gets longer and the rising tip at its end moves along with it, its shape kept."""
    def adjust(strokes):
        h = strokes[hat]
        top = np.asarray(strokes[stem][0][1][0], float)  # the stem starts at its top
        end = np.asarray(h[-1][1][-1], float)
        dx = top[0] + (top[1] - end[1]) * tt.SLANT_T - end[0]
        k = max(i for i in range(len(h)) if h[i][0] == "L")  # the flat part
        strokes[hat] = (h[:k] + [("L", [np.asarray(h[k][1][0], float) + [dx, 0.0]])]
                        + [(c, [np.asarray(q, float) + [dx, 0.0] for q in ps]) for c, ps in h[k + 1:]])
        return strokes
    return adjust


def stem_like(source, stroke=0):
    """Г: the stem begins as high as Б's (owner, 2026-10-18: «вертикальные штрихи должны тоже одинаковые по высоте ... по
    оригинальному шрифту»; in Boyan Maga both stems begin about a quarter of a capital's height under the hat, Б's 24.7 units on
    paper, Г's 22.1, the hand's Г 18.6). The stroke is stretched from the baseline along the slant, so the stem stays on its line and
    its foot on the baseline."""
    def adjust(strokes):
        target = np.array(tt.parse_path(tt.dg.fmt(PAPER_UNSNAPPED.get(source, PAPER[source])[stroke])))[:, 1].min()
        top = np.array(tt.parse_path(tt.dg.fmt(strokes[stroke])))[:, 1].min()
        k = (tt.BASE - target) / (tt.BASE - top)
        strokes[stroke] = [(c, list(tt.shear_scale(np.array(ps, float), k))) for c, ps in strokes[stroke]]
        return strokes
    return adjust


DRAFT = HERE / "boyan_glyphs.draft.json"   # the font's centre line per letter (font_glyphs.py), bank units
UNDERLAY_DX = HERE / "underlay_dx.json"    # where the underlay put it on the capture canvas (make_underlays.py)
FONT_FLAGS = HERE / "font_flags.json"      # the exact centre line of some flags, from the outline (font_flags.py)


def font_centre(label):
    """The Boyan letter's centre line, each stroke as paper points, where the underlay showed it under the capture being tidied
    (call from a SHAPES function: tidy_trace has the capture's placing then). No font file needed."""
    g = {d["label"]: d for d in json.loads(DRAFT.read_text())}[label]
    dx = json.loads(UNDERLAY_DX.read_text())["dx"][label]
    import make_underlays as mu
    out = []
    for st in g["strokes"]:
        tool = np.array([mu.bank_to_tool(*p) for p in tt.parse_path(st["d"])]) + [dx, 0.0]
        out.append(tt.placed_like_last(np.array([dg.xform(q, 2.0, 0.0) for q in tool])))
    return out


def stencil_map(label, like=None):
    """bank points -> paper: the Boyan letter at the font's own proportions, as a stencil on the deck's paper. Through the deck's
    geometry (tidy_trace.to_paper), then scaled evenly (across the slant as much as up) until its centre line stands on the baseline
    and reaches the capital's top line, as the tidied letters do (the font's centre line stops short of both by half its pen).
    `like` (paper points): set across the slant on their middle. Not where the underlay was under the hand (font_centre): the
    hand's own height must not change the font's width (owner, 2026-10-18: Л «уже» than the font's)."""
    g = {d["label"]: d for d in json.loads(DRAFT.read_text())}[label]
    allp = tt.upright(tt.to_paper(np.vstack([tt.parse_path(st["d"]) for st in g["strokes"]])))
    lo, hi = allp[:, 1].max(), allp[:, 1].min()
    if label.islower():
        # a lowercase letter: the font's own lowercase already fills the deck's band (font_glyphs.py sets the bank so), its
        # ascenders and descenders stretched by meta.script with the paper's: taken as it is, only moved across onto `like`
        s, lo = 1.0, tt.BASE
        dx = 0.0
        if like is not None:
            u = tt.upright(like)
            dx = (u[:, 0].min() + u[:, 0].max()) / 2 - (allp[:, 0].min() + allp[:, 0].max()) / 2
        def fn_lower(p):
            q = tt.upright(tt.to_paper(np.asarray(p, float)))
            return tt.from_upright(np.c_[q[:, 0] + dx, q[:, 1]])
        return fn_lower
    # a letter going under the baseline (Р У Ф Ц Щ): its foot is not its lowest point; the font's centre line stands that much
    # over the baseline (half its pen, as measured on Л, М: 3.3 units on paper)
    if lo > tt.BASE + 3: lo = tt.BASE - 3.3
    s = (tt.BASE - tt.CAP_TOP) / (lo - hi)
    dx = 0.0
    if like is not None:
        u = tt.upright(like)
        dx = (u[:, 0].min() + u[:, 0].max()) / 2 - (allp[:, 0].min() + allp[:, 0].max()) / 2 * s
    def fn(p):
        q = tt.upright(tt.to_paper(np.asarray(p, float)))
        return tt.from_upright(np.c_[q[:, 0] * s + dx, tt.BASE - (lo - q[:, 1]) * s])
    return fn


def font_stencil(label, like=None):
    """The Boyan letter's centre line (boyan_glyphs.draft.json) through stencil_map: each stroke as paper points."""
    fn = stencil_map(label, like)
    g = {d["label"]: d for d in json.loads(DRAFT.read_text())}[label]
    return [fn(np.array(tt.parse_path(st["d"]))) for st in g["strokes"]]


def _line_fit(p):
    c = p.mean(axis=0); d = np.linalg.svd(p - c)[2][0]
    return c, d / np.hypot(*d)


def _on_slant(line):
    """A stem's line kept where it is but turned exactly onto the copybook's slant (meta.script slantDeg: the guide lines of the
    Bulgarian ruling): stems follow the guides, never the font's or the hand's own lean (owner, 2026-10-18)."""
    return line[0], tt._unit(np.array([tt.SLANT_T, -1.0]))


def _top_on(stem):
    """The top of a stem: where its line reaches the capital's top line (the top stays on the ruling, the stem on the slant)."""
    return np.array([_x_at(stem, tt.CAP_TOP), tt.CAP_TOP])


def _set_end(cmd, p):
    c, ps = cmd
    return (c, list(ps[:-1]) + [np.asarray(p, float)])


def _x_at(line, y):
    c, d = line
    return c[0] + (y - c[1]) * d[0] / d[1]


def spread_like_font(strokes, stroke=0, lo=None, hi=None):
    """Л (and letters like it): the two sides that meet at the top (the rising left side, the stem coming down) moved across onto
    the font's own sides (font_stencil: the font at its own proportions, as tall as the letter), each by the shift its line needs at every height, hooks and all; the top is where the moved sides cross
    (owner, 2026-10-18: «раздвинуть левый и правый штрихи точно по шрифтовой подложке, чтобы совпало»). Only the sides' place:
    the hand's hooks and its pen path stay. The top: the left side's moved end (the right side starts from it)."""
    lo = tt.X_TOP + 10 if lo is None else lo        # the sides are measured between these heights (clear of hooks and the top)
    hi = tt.CAP_TOP + 15 if hi is None else hi
    cmds = strokes[stroke]
    font = np.vstack(font_stencil(PAPER_LABEL[0], like=np.array(tt.parse_path(tt.dg.fmt(cmds)))))
    ftop = int(np.argmin(font[:, 1]))
    pick = lambda p: p[(p[:, 1] > hi) & (p[:, 1] < lo)]
    f_left, f_right = _line_fit(pick(font[:ftop + 1])), _on_slant(_line_fit(pick(font[ftop:])))
    ends = np.array([ps[-1] for _, ps in cmds])
    top = int(np.argmin(ends[:, 1]))  # the command that ends at the top
    ours = np.array(tt.parse_path(tt.dg.fmt(cmds)))
    otop = int(np.argmin(ours[:, 1]))
    o_left, o_right = _line_fit(pick(ours[:otop + 1])), _on_slant(_line_fit(pick(ours[otop:])))
    def moved(part, ol, fl):
        return [(c, [np.array([q[0] + _x_at(fl, q[1]) - _x_at(ol, q[1]), q[1]]) for q in ps]) for c, ps in part]
    left = [cmds[0]] + moved(cmds[1:top + 1], o_left, f_left)
    left[0] = ("M", [np.array([q[0] + _x_at(f_left, q[1]) - _x_at(o_left, q[1]), q[1]]) for q in cmds[0][1]])
    right = moved(cmds[top + 1:], o_right, f_right)
    # the top: one point, on the top line, on the stem's slanted line (each side moved by its own shift would leave it in two places
    # and bend the stem off the slant: 74deg instead of 76, owner 2026-10-18); the left side runs up to it
    left[-1] = _set_end(left[-1], _top_on(f_right))
    strokes[stroke] = left + right
    return strokes


def _apexes(p):
    """Indexes of the tops of a pen path: where it turns back down near its highest (М: two)."""
    near = np.where(p[:, 1] < p[:, 1].min() + 8)[0]
    groups, out = [], []
    for i in near:
        if groups and i - groups[-1][-1] <= 2: groups[-1].append(i)
        else: groups.append([i])
    return [g[int(np.argmin(p[g, 1]))] for g in groups]


def m_from_l(strokes, source="Л", stroke=0):
    """М: Л twice, exactly as Л is tidied, no distortion (owner, 2026-10-18: «должна отрисовываться точно по лекалу первой части
    без искривлений ... рисуется сначала заглавная Л, и из выходного штриха сразу идёт как будто бы часть Л»). The first Л runs to
    the foot of its stem; there, at that bottom on the baseline, the second Л begins at the bottom of its own entry hook and goes
    on to its end. Both cuts are bows standing on the baseline with a level tangent (tidy_trace), so the join is smooth. The
    hand's М gives nothing but the label: its strokes are replaced."""
    L = PAPER[source][stroke]
    ends = np.array([ps[-1] for _, ps in L])
    bottoms = [k for k in range(len(L)) if abs(ends[k, 1] - tt.BASE) < 1e-6]
    entry, foot = bottoms[0], bottoms[1]
    off = ends[foot] - ends[entry]
    second = [(c, [np.asarray(q, float) + off for q in ps]) for c, ps in L[entry + 1:]]
    strokes = [list(L[:foot + 1]) + second]
    return strokes


def _sides(p):
    """A path that goes up and down between the top line and the baseline (Л, М) -> its runs between the tops and the feet:
    [rising side, stem, rising side, stem, ...] as point arrays (the tops from _apexes, a foot the lowest point between two tops)."""
    tops = _apexes(p)
    cuts = [0]
    for a, b in zip(tops, tops[1:]):
        cuts += [a, a + int(np.argmax(p[a:b, 1]))]
    cuts += [tops[-1], len(p) - 1]
    return [p[i:j + 1] for i, j in zip(cuts, cuts[1:]) if j > i]


def fit_across(strokes, stroke=0, lo=None, hi=None):
    """М: the whole letter squeezed (or widened) evenly across the slant and moved along the line, so that its sides lie on the
    font's (font_stencil, the font at its own proportions; owner, 2026-10-18: «М нужно также точно по шрифтовому образцу сжать»).
    One factor for the whole letter, fitted by least squares over all its sides at every height between `lo` and `hi`: both
    halves stay the same Л, the stems stay on the slant (they run straight up across the slant), the tops on the top line, the
    feet on the baseline; the rising sides get steeper with the squeeze, as the font's are."""
    lo = tt.X_TOP + 10 if lo is None else lo
    hi = tt.CAP_TOP + 15 if hi is None else hi
    ours = tt.upright(np.array(tt.parse_path(tt.dg.fmt(strokes[stroke]))))
    font = tt.upright(np.vstack(font_stencil(PAPER_LABEL[0])))
    o_sides, f_sides = _sides(ours), _sides(font)
    ys = np.linspace(hi, lo, 25)
    A, rhs = [], []
    for o, f in zip(o_sides, f_sides):
        for y in ys:
            if not (min(o[:, 1].min(), f[:, 1].min()) <= y <= max(o[:, 1].max(), f[:, 1].max())): continue
            uo = o[np.argmin(np.abs(o[:, 1] - y)), 0]; uf = f[np.argmin(np.abs(f[:, 1] - y)), 0]
            A.append([uo, 1.0]); rhs.append(uf)
    k, dx = np.linalg.lstsq(np.array(A), np.array(rhs), rcond=None)[0]
    def squeeze(ps):
        u = tt.upright(np.array(ps, float))
        return list(tt.from_upright(np.c_[u[:, 0] * k + dx, u[:, 1]]))
    strokes[stroke] = [(c, squeeze(ps)) for c, ps in strokes[stroke]]
    FITS[PAPER_LABEL[0]] = (round(float(k), 3), round(float(dx), 2))
    return strokes


FITS = {}  # label -> (factor across the slant, shift) that fit_across found, for the record


def from_font(strokes):
    """М: the font's own pen path (its centre line as a stencil, font_stencil), tidied like a hand's (tidy_trace.tidy_stroke:
    stems straight on the slant, bows smooth, feet on the baseline), set where the hand's letter stood across the slant. The
    owner painted over the font where М's strokes must go (2026-10-18): the rising sides bow up into the stems and run close
    beside them under the tops, the entry hook is the font's, wider than Л's; neither Л twice nor Л squeezed gives that."""
    like = np.vstack([tt.parse_path(tt.dg.fmt(c)) for c in strokes])
    PAPER_UNSNAPPED[PAPER_LABEL[0]] = [list(c) for c in strokes]  # where the stencil stands (_font_frame, the review sheet)
    out = [tt.tidy_stroke(p, tt.CAP_TOP) for p in font_stencil(PAPER_LABEL[0], like=like)]
    # every top up its stem's line to the capital's top line (the font's first top stops short of it; a capital's tops stand on
    # the line, А's and Л's do): the rise's end and its last handle move up with it, so the rise stays smooth into the top
    for cmds in out:
        for k in range(1, len(cmds) - 1):
            end, nxt = np.asarray(cmds[k][1][-1], float), cmds[k + 1]
            if end[1] > tt.CAP_TOP + 8 or nxt[0] != "L": continue
            stem = (end, tt._unit(np.asarray(nxt[1][0], float) - end))
            d = np.array([_x_at(stem, tt.CAP_TOP), tt.CAP_TOP]) - end
            c, ps = cmds[k]
            cmds[k] = (c, [np.asarray(q, float) + (d if i >= len(ps) - 2 else 0) for i, q in enumerate(ps)])
    for cmds in out: _bow_rises(cmds)
    return out


RISE_BOW = 14.0      # at most this far a rise of М bows off its chord, towards the lower right (paper units; less if it would near the stem)
RISE_MEET_DEG = 6.0  # a rise arrives at its top this much flatter than the stem leaves it: they meet at the top, not before
RISE_ARC_DEG = 7.0    # the first rise of М: an even arc turning this much each side of its chord
RISE_CLEAR = 0.08    # ... and on the way up stays left of the stem by this part of its depth under the top (never crosses it)


def _bow_rises(cmds):
    """М's rising sides (from the end of a foot's or the entry's hook up to a top) redrawn as one even bow each (one cubic): more bow than the
    font's centre line has, and arriving at the top at an angle of its own, so the rise and the stem meet only at the top
    (owner, 2026-10-18: «первый штрих чуть больше прогиб и к верху ... не сливается со вторым, а соединяются в верхней точке.
    У третьего штриха тоже больше прогиб в середине»). From the bottom of the hook below it (on the baseline, leaving level)."""
    ends = [np.asarray(ps[-1], float) for _, ps in cmds]
    tops = [k for k in range(len(cmds)) if ends[k][1] < tt.CAP_TOP + 1e-6]
    stem_ang = math.radians(tt.SLANT_DEG_PAPER)
    for t in reversed(tops):
        s = t - 1
        while s > 0 and abs(ends[s][1] - tt.BASE) > 1e-6: s -= 1
        even = t == tops[0] and cmds[s + 1][0] == "C" and s + 1 < t
        if even:
            # the first rise: an even arc from where the entry hook ends to the top (owner, 2026-10-18: the deep bow from the hook's
            # bottom «слишком резко ... должна быть плавная дуга от выхода крюка до верхней точки»); it leaves RISE_ARC_DEG flatter
            # than its chord and arrives as much steeper (no steeper than the stem less RISE_MEET_DEG); the hook's last handle is
            # turned onto the new tangent so the hook runs into it smoothly
            s += 1
        p0, a = ends[s], ends[t]
        chord = a - p0; L = float(np.hypot(*chord)); u = chord / L
        n = np.array([-u[1], u[0]])
        if n[0] < 0: n = -n  # towards the lower right (y down: the right of an upward chord)
        th1 = stem_ang - math.radians(RISE_MEET_DEG)
        if even:
            ch = math.atan2(-u[1], u[0])
            th1 = min(th1, ch + math.radians(RISE_ARC_DEG))
            th0 = 2 * ch - th1  # mirrored about the chord: one even arc
            t0 = np.array([math.cos(th0), -math.sin(th0)])
            c, ps = cmds[s]
            h = float(np.hypot(*(np.asarray(ps[-1], float) - np.asarray(ps[-2], float))))
            cmds[s] = (c, [ps[0], p0 - t0 * h, ps[-1]])
        else:
            # from the bottom of the hook below it (on the baseline, level): hook and rise one bow, so it can bow deeper than from
            # the hook's end without running into the stem near the top
            t0 = tt._unit(p0 - np.asarray(cmds[s][1][-2], float))
        t1 = np.array([math.cos(th1), -math.sin(th1)])
        tm = tt._unit(a - p0)
        # the stem it meets at the top: the rise must stay clear of it all the way up (a bow towards it would cross it)
        stem = (a, tt._unit(np.array([-tt.SLANT_T, 1.0])))
        def bow(h0, h1):
            return [("C", [p0 + t0 * h0 * L, a - t1 * h1 * L, a])]
        def sag(segs):
            pts = np.array(tt.parse_path(tt.dg.fmt([("M", [p0])] + segs)))
            return float(np.max((pts - p0) @ n))
        def clear(segs):
            pts = np.array(tt.parse_path(tt.dg.fmt([("M", [p0])] + segs)))[:-3]
            room = np.array([_x_at(stem, y) for y in pts[:, 1]]) - pts[:, 0]
            return np.all(room >= RISE_CLEAR * (pts[:, 1] - tt.CAP_TOP))
        # one cubic (no joint in it): leaving the hook along its tangent, arriving at the top along t1; the longer the handles the
        # deeper the bow: the deepest one up to RISE_BOW that stays clear of the stem
        if even:
            # equal handles, as long as a circle's arc of that turn would have them (4/3 tan(turn/4) of the radius)
            turn = th1 - th0
            h = 4 / 3 * math.tan(turn / 4) * (L / 2 / math.sin(turn / 2)) / L if turn > 1e-6 else 1 / 3
            best = bow(h, h)
        else:
            cands = [bow(h0, h1) for h0 in np.arange(0.05, 0.91, 0.025) for h1 in np.arange(0.05, 0.81, 0.025)]
            cands = [c for c in cands if clear(c) and sag(c) <= RISE_BOW]
            # the bow nearest the font's line between the hook and the top (owner, 2026-10-19: the middle stroke's way up «прогиб
            # в этом месте слишком большой ... по серой линии шрифта»); the deepest one only when there is no font's line to go by
            S = _font_frame(PAPER_LABEL[0])[1] if PAPER_LABEL[0] in json.loads(FONT_SKELETON.read_text())["letters"] else None
            def off_font(segs):
                pts = dg.resample(np.array(tt.parse_path(tt.dg.fmt([("M", [p0])] + segs))), 0.5)
                pts = pts[(pts[:, 1] > tt.CAP_TOP + 15) & (pts[:, 1] < tt.BASE - 8)]
                return float(np.mean(np.min(np.hypot(pts[:, None, 0] - S[None, :, 0], pts[:, None, 1] - S[None, :, 1]), axis=1)))
            best = (min(cands, key=off_font) if S is not None else max(cands, key=sag)) if cands else bow(1 / 3, 1 / 3)
        cmds[s + 1:t + 1] = best


def both(*fns):
    def adjust(strokes):
        for fn in fns: strokes = fn(strokes)
        return strokes
    return adjust


def font_flag(cmds, label, tol=0.3):
    """The flag on the top left (from the start up over the top and into the stem: К Н Ф Ю, and Ъ through К) redrawn from the
    font's own centre line, its dip in the middle as deep as the font's (owner, 2026-10-18: «крючки у букв К, Н, Ю, Ъ, Ф сделай
    тщательнее по форме крючка из шрифта, там глубже прогиб в середине крючка»; the tidying's smoothing had flattened it).
    The font's path (font_stencil, set on this letter) up to where it comes down to the height our stem's line begins, moved
    across so that point lies on that line; fitted by cubics within `tol` (no lines, no smoothing first: the font's line is
    smooth), leaving along the font's own start and arriving along our stem."""
    j = next(i for i in range(1, len(cmds)) if cmds[i][0] == "L")  # our stem: the first line
    a, b = np.asarray(cmds[j - 1][1][-1], float), np.asarray(cmds[j][1][0], float)
    stem_dir = tt._unit(b - a)
    like = np.array(tt.parse_path(tt.dg.fmt(cmds)))
    exact = json.loads(FONT_FLAGS.read_text())["flags"] if FONT_FLAGS.exists() else {}
    if label in exact:  # the flag's centre line from the outline itself (font_flags.py): the draft's is smoothed
        f = dg.resample(stencil_map(label, like=like)(np.array(exact[label], float)), 0.6)
    else:
        f = dg.resample(np.asarray(font_stencil(label, like=like)[0], float), 0.6)
    top = int(np.argmin(f[: len(f) // 2, 1]))  # the flag's top: the highest point in the first half of the path
    cut = top + int(np.argmax(f[top:, 1] >= a[1]))  # where it has come down to our stem's start
    flag = f[:cut + 1]
    flag = flag + [_x_at((a, stem_dir), flag[-1][1]) - flag[-1][0], 0.0]
    t0 = tt._unit(flag[min(4, len(flag) - 1)] - flag[0])
    segs = tt._fit_span(flag, t0, stem_dir, tol=tol)
    return [("M", [flag[0]])] + segs + cmds[j:]  # the stem's line runs on from the flag's end, which lies on it


def rise_like_font(strokes, label="А", tol=0.3, deg=4, ease=3):
    """А: the rise (from the end of the entry hook up to the top) as the font draws it, bowing to the right in the middle (owner,
    2026-10-19: «первый штрих должен иметь чуть больший прогиб в середине вправо ... максимально приближенное к линиям шрифта»;
    the tidying had made it two straight lines). The outline's exact centre line (font_flags.json "А:0") set by stencil_map. Where
    the bar and the stem join it the skeleton runs off into them (a zigzag at the bar, a kink under the top), so those bands are
    left out and the rise is the smooth curve x(y) (across the slant, degree `deg`) through the rest of it, from our hook's end to
    our top. The font's rise reaches the top line ~3 units right of our top (which stays on our stem, on the slant): that shift is
    taken up near the ends (weight w**`ease`), so the middle keeps the font's line and its bow. Fitted by cubics within `tol`.
    The hook, the top, the stem and the bar stay as they are."""
    cmds = strokes[0]
    j = next(i for i in range(1, len(cmds)) if cmds[i][0] == "L")  # the rise: the first line, after the hook
    ends = [np.asarray(ps[-1], float) for _, ps in cmds]
    k = j + int(np.argmin([e[1] for e in ends[j:]]))  # it ends at the top
    a, top = ends[j - 1], ends[k]
    bar_y = float(np.mean(np.array(tt.parse_path(dg.fmt(strokes[1])))[:, 1])) if len(strokes) > 1 else -1e9  # Л: no bar
    like = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes])
    exact = json.loads(FONT_FLAGS.read_text())["flags"][f"{label}:0"]
    f = dg.resample(stencil_map(label, like=like)(np.array(exact, float)), 0.6)
    t = int(np.argmin(f[:, 1]))
    i = int(np.argmin(np.hypot(*(f[:t] - a).T)))
    u = tt.upright(f[i:t + 1])
    ok = (np.abs(u[:, 1] - bar_y) > 6.0) & (u[:, 1] > tt.CAP_TOP + 4.0)
    poly = np.polyfit(u[ok, 1], u[ok, 0], deg)
    ua, ut = tt.upright(np.array([a, top]))
    ys = np.linspace(ua[1], ut[1], 160)
    xs = np.polyval(poly, ys)
    w = (ys - ua[1]) / (ut[1] - ua[1])
    xs = xs + (1 - w) ** ease * (ua[0] - xs[0]) + w ** ease * (ut[0] - xs[-1])
    r = tt.from_upright(np.c_[xs, ys])
    c = cmds[j - 1][1]
    t0 = tt._unit(np.asarray(c[-1], float) - np.asarray(c[-2], float)) if len(c) == 3 else tt._unit(r[4] - r[0])
    t1 = tt._unit(r[-1] - r[-5])
    strokes[0] = cmds[:j] + tt._fit_span(r, t0, t1, tol=tol) + cmds[k + 1:]
    return strokes


def stem_on_font(strokes, label, k=0, band=12.0):
    """The stem (the last line of the stroke, down from the top) moved across onto the middle of the font's stem, still on the
    slant: the mean offset to the font's skeleton along it, leaving out `band` units at the top (where the rise joins it) and at
    the bottom (where it bends into the hook). The top moves along the top line to stay on it; the line before it (the rise)
    ends there."""
    PAPER_UNSNAPPED.setdefault(label, [list(c) for c in strokes])
    ink, S, pen = _font_frame(label)
    cmds = list(strokes[k])
    lines = [i for i in range(1, len(cmds)) if cmds[i][0] == "L"]
    top_i = min(lines, key=lambda i: cmds[i][1][0][1])  # the line ending at the top
    stem = [i for i in lines if i > top_i]
    a = np.asarray(cmds[top_i][1][0], float); b = np.asarray(cmds[stem[-1]][1][0], float)
    d = tt._unit(b - a); n = np.array([-d[1], d[0]])
    L = np.hypot(*(b - a))
    P = a + np.outer(np.linspace(band / L, 1 - band / L, 60), b - a)
    q = S[np.argmin(np.hypot(P[:, None, 0] - S[None, :, 0], P[:, None, 1] - S[None, :, 1]), axis=1)]
    off = float(np.median((q - P) @ n))
    sh = n * off
    new_top = a + sh; new_top = new_top + d * (tt.CAP_TOP - new_top[1]) / d[1]
    cmds[top_i] = ("L", [new_top])
    for i in stem: cmds[i] = ("L", [np.asarray(cmds[i][1][0], float) + sh])
    strokes[k] = cmds
    return strokes


def hooks_like_font(strokes, label="А", tol=0.1, ease=3):
    """А: the entry hook (from the start round the bottom up to where the rise begins) and the exit hook (from the end of the
    stem's line round the bottom to the end) as the font draws them (owner, 2026-10-19: «подгони ... и входящие, и исходящие крюки
    по шрифту»; the stems and the bar already lie on the font). The outline's exact centre line (font_flags.json "А:0") set by
    stencil_map: no joins there, so it is taken as it is, from its start to its point nearest the rise's start, and from its point
    nearest the stem's end to its end. The end that joins our line is moved onto it, the shift taken up near that end (weight
    w**`ease`), so the rest is the font's; the join keeps the font's direction into the rise and our stem's out of the stem. Each
    hook is then stretched up or down from its join (by under 2%) until its bottom stands on the baseline: the font's lay 0.3
    under it and 0.4 over it.
    Fitted by cubics within `tol`. Before rise_like_font, which takes its start direction from the new entry hook."""
    cmds = strokes[0]
    like = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes])
    f = dg.resample(stencil_map(label, like=like)(np.array(json.loads(FONT_FLAGS.read_text())["flags"][f"{label}:0"], float)), 0.6)
    top = int(np.argmin(f[:, 1]))
    lines = [i for i in range(1, len(cmds)) if cmds[i][0] == "L"]
    j, last = lines[0], lines[-1]  # the rise's first line; the stem's last
    a, b = np.asarray(cmds[j - 1][1][-1], float), np.asarray(cmds[last][1][-1], float)
    stem = tt._unit(b - np.asarray(cmds[last - 1][1][-1], float))

    def eased(p, at_end, target):
        s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))]); w = (s_ / s_[-1])[:, None]
        w = w ** ease if at_end else (1 - w) ** ease
        p = p + w * (target - (p[-1] if at_end else p[0]))
        y0 = target[1]
        p[:, 1] = y0 + (p[:, 1] - y0) * (tt.BASE - y0) / (p[:, 1].max() - y0)  # the bottom on the baseline
        return p

    turns = _turns(f)
    turn = turns[0] if turns else top  # the walk runs off into the bar after the rise has begun
    ia = int(np.argmin(np.hypot(*(f[:turn] - a).T)))
    entry = eased(f[:ia + 1], True, a)
    ib = top + int(np.argmin(np.hypot(*(f[top:] - b).T)))
    exit_ = eased(f[ib:], False, b)
    t_in = tt._unit(entry[-1] - entry[-5])
    head = [("M", [entry[0]])] + tt._fit_span(entry, tt._unit(entry[4] - entry[0]), t_in, tol=tol)
    tail = tt._fit_span(exit_, stem, tt._unit(exit_[-1] - exit_[-5]), tol=tol)
    strokes[0] = head + cmds[j:last + 1] + tail
    return strokes


FONT_SKELETON = HERE / "font_skeleton.json"  # font_flags.py SKELETON: the whole skeleton of some letters, bank units


def _small_loops(P, s_, near=0.5, max_len=60.0, min_len=4.0, min_area=8.0):
    """Where a stroke crosses itself within `max_len` units of its own length (a small loop): (start, end) sample indices."""
    out, i = [], 0
    while i < len(P):
        far = (s_ - s_[i] > min_len) & (s_ - s_[i] < max_len)
        d = np.where(far, np.hypot(*(P - P[i]).T), np.inf)
        j = int(np.argmin(d))
        q = P[i:j + 1]
        area = 0.5 * abs(np.sum(q[:, 0] * np.roll(q[:, 1], -1) - np.roll(q[:, 0], -1) * q[:, 1]))
        if d[j] < near and area > min_area:  # a loop, not a sharp turn back whose two sides start close together (З's waist)
            out.append((i, j)); i = j + 1
        else: i += 1
    return out


def _line_groups(cmds, deg=2.0):
    """Runs of consecutive line commands going the same way (within `deg`): one straight line cut into pieces."""
    groups = []
    for k in range(1, len(cmds)):
        if cmds[k][0] != "L": continue
        a = np.asarray(cmds[k - 1][1][-1], float); b = np.asarray(cmds[k][1][0], float); d = tt._unit(b - a)
        if groups and groups[-1][-1] == k - 1:
            pa = np.asarray(cmds[k - 2][1][-1], float) if k >= 2 else a
            if abs(np.degrees(np.arctan2(*d[::-1]) - np.arctan2(*tt._unit(a - pa)[::-1])) % 360) < deg or \
               abs((np.degrees(np.arctan2(*d[::-1]) - np.arctan2(*tt._unit(a - pa)[::-1])) % 360) - 360) < deg:
                groups[-1].append(k); continue
        groups.append([k])
    return groups


def _curved_lines(cmds, S, F, fork_r, bend=0.3, force=False):
    """A straight line of the tidied hand where the font's line is not straight (Ж's left arc): made a curve, so snap_to_font bends
    it onto the font. Measured on the middle 60% of the line (a stem curving into its hook at an end stays a line: snap_to_font
    ends it where the font leaves it): the font's offset across it, less its straight trend, varies by more than `bend` units."""
    out = list(cmds)
    for grp in _line_groups(cmds):
        # only a line between two curves: the zigzag's lines (Ж, line to line) are straight in the font too
        if cmds[grp[0] - 1][0] != "C" or grp[-1] + 1 >= len(cmds) or cmds[grp[-1] + 1][0] != "C": continue
        if force:
            for k in grp:
                p0 = np.asarray(out[k - 1][1][-1], float); p1 = np.asarray(cmds[k][1][0], float)
                out[k] = ("C", [p0 + (p1 - p0) / 3, p0 + 2 * (p1 - p0) / 3, p1])
            continue
        a = np.asarray(cmds[grp[0] - 1][1][-1], float); b = np.asarray(cmds[grp[-1]][1][-1], float)
        d = tt._unit(b - a); n = np.array([-d[1], d[0]])
        u = np.linspace(0.2, 0.8, 40)
        P = a + np.outer(u, b - a)
        if len(F): P = P[np.min(np.hypot(P[:, None, 0] - F[None, :, 0], P[:, None, 1] - F[None, :, 1]), axis=1) > fork_r]
        if len(P) < 10: continue
        q = S[np.argmin(np.hypot(P[:, None, 0] - S[None, :, 0], P[:, None, 1] - S[None, :, 1]), axis=1)]
        off = (q - P) @ n; t = (P - a) @ d
        res = off - np.polyval(np.polyfit(t, off, 1), t)
        if np.ptp(res) <= bend: continue
        for k in grp:
            p0 = np.asarray(out[k - 1][1][-1], float); p1 = np.asarray(cmds[k][1][0], float)
            out[k] = ("C", [p0 + (p1 - p0) / 3, p0 + 2 * (p1 - p0) / 3, p1])
    return out


def snap_to_font(strokes, label, fork_r=7.0, reach=8.0, sigma=2.0, tol=0.1, leave=0.5, arcs=(), below=None, keep_lines=False, plain=False):
    """A traced letter moved onto the font's lines without changing its path (owner, 2026-10-19, Б: «максимально приблизь наши
    линии, расширь их, раздвинь без изменения траектории к размерам и линиям шрифта»). Every point of every stroke moves across
    its own path (along its normal only, so the path keeps its length, order and turns) onto the font's skeleton (font_skeleton.json
    set by stencil_map). Near a fork (where the bowl leaves the stem) the skeleton bends off into the other stroke, so there the
    shift is carried over from both sides; it is smoothed along the stroke (`sigma` paper units). A straight line (a stem) moves
    by one shift, so it stays straight and on the slant. A stroke starting on another one starts on it again after the move.
    Hooks keep their bottom on the baseline, tops their top line. Curves refitted by cubics within `tol`. `arcs`: strokes that
    are one arc in the font, their straight pieces bent onto it too (Ж's left element: its line made a corner, owner 2026-10-19).
    `below`: only what lies below that height moves (eased in over 10 units above it); `keep_lines`: straight lines stay where they
    are (М: its stems and the rises' meeting with them at the tops, as the owner approved them, stay; its lower parts go onto the
    font)."""
    PAPER_UNSNAPPED[label] = [list(c) for c in strokes]
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    like = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes])
    fn = stencil_map(label, like=like)
    INK = np.vstack([fn(np.array(poly, float)) for poly in sk["outline"]]) if "outline" in sk else np.zeros((0, 2))
    S = fn(np.array(sk["pts"], float)); F = fn(np.array(sk["forks"], float).reshape(-1, 2)) if sk["forks"] else np.zeros((0, 2))
    old = [np.array(tt.parse_path(dg.fmt(c))) for c in strokes]
    # half the pen: how far the outline lies from the skeleton
    PEN = float(np.median(np.min(np.hypot(S[::7, None, 0] - INK[None, :, 0], S[::7, None, 1] - INK[None, :, 1]), axis=1))) if len(INK) else 3.3
    out = []
    if not plain: strokes = [_curved_lines(c, S, F, fork_r, force=n in arcs) for n, c in enumerate(strokes)]
    for cmds in strokes:
        # samples per command, so lines can be kept lines
        pts, owner = [np.asarray(cmds[0][1][0], float)], [0]
        for k, (c, ps) in enumerate(cmds[1:], 1):
            p0 = pts[-1]; ps = [np.asarray(q, float) for q in ps]
            n = 24
            for t in np.linspace(0, 1, n + 1)[1:]:
                pts.append(p0 + t * (ps[0] - p0) if c == "L" else (1-t)**3*p0 + 3*(1-t)**2*t*ps[0] + 3*(1-t)*t**2*ps[1] + t**3*ps[2])
                owner.append(k)
        P = np.array(pts); owner = np.array(owner)
        T = np.gradient(P, axis=0); T /= np.hypot(*T.T)[:, None] + 1e-9
        N = np.c_[-T[:, 1], T[:, 0]]
        d = np.hypot(P[:, None, 0] - S[None, :, 0], P[:, None, 1] - S[None, :, 1])
        q = S[d.argmin(axis=1)]
        off = np.sum((q - P) * N, axis=1)
        ok = d.min(axis=1) < reach
        if len(F): ok &= np.min(np.hypot(P[:, None, 0] - F[None, :, 0], P[:, None, 1] - F[None, :, 1]), axis=1) > fork_r
        # the stroke's two ends: the skeleton stops half a pen short of the ink, so their nearest point lies along, not across
        s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
        ok &= (s_ > 2.0) & (s_ < s_[-1] - 2.0)
        off = np.interp(s_, s_[ok], off[ok]) if ok.sum() > 1 else np.zeros(len(P))
        # where the font leaves a straight line (a stem curving into its hook earlier than ours does), the line ends there and the
        # curve next to it takes over that stretch: the line kept to its end would make a corner with the font's bend
        for k in range(1, len(cmds)):
            if cmds[k][0] != "L": continue
            idx = np.nonzero(owner == k)[0]
            if len(idx) < 6: continue
            m = np.median(off[idx])
            if k + 1 < len(cmds) and cmds[k + 1][0] == "C":
                n_ = 0
                while n_ < len(idx) - 3 and abs(off[idx[-1 - n_]] - m) > leave: n_ += 1
                if n_: owner[idx[len(idx) - n_:]] = k + 1
            if cmds[k - 1][0] == "C" and k > 1:
                n_ = 0
                while n_ < len(idx) - 3 and abs(off[idx[n_]] - m) > leave: n_ += 1
                if n_: owner[idx[:n_]] = k - 1
        # straight lines move whole; a line split into collinear pieces (Ж's zigzag, cut at the lowercase line) moves as one, and a
        # stroke starting on a line moves with it
        groups = _line_groups(cmds)
        for grp in groups:
            m = np.isin(owner, grp) | ((owner == 0) & (grp[0] == 1))
            off[m] = off[np.isin(owner, grp)].mean()
        if keep_lines:
            for grp in groups: off[np.isin(owner, grp)] = 0.0
        if below is not None:
            wy = np.clip((P[:, 1] - (below - 25.0)) / 25.0, 0, 1); off = off * wy * wy * (3 - 2 * wy)
        g = np.exp(-0.5 * ((s_[:, None] - s_[None, :]) / sigma) ** 2)
        lines = np.isin(owner, [k for k in range(1, len(cmds)) if cmds[k][0] == "L"]) | ((owner == 0) & any(g_[0] == 1 for g_ in groups))
        sm = (g @ off) / g.sum(axis=1)
        off = np.where(lines, off, sm)
        # a curve next to a line eases from the line's shift into its own over `blend` units: no kink where a stem meets its hook
        blend = 8.0
        for k in set(owner[owner > 0]):
            if cmds[k][0] != "L": continue
            idx = np.nonzero(owner == k)[0]
            for end in (idx[0] - 1, idx[-1]):
                if end < 0: continue
                dist = np.abs(s_ - s_[end])
                w = np.clip(dist / blend, 0, 1); w = w * w * (3 - 2 * w)
                near = (~lines) & (dist < blend)
                off[near] = off[end] * (1 - w[near]) + off[near] * w[near]
        disp = N * off[:, None]
        # a small loop (Е's waist) moves whole, its shape kept: snapping its two sides across would fold it onto one line
        loops = [] if plain else _small_loops(P, s_)
        for i, j in loops:
            u = ((s_[i:j + 1] - s_[i]) / (s_[j] - s_[i]))[:, None]
            disp[i:j + 1] = disp[i] * (1 - u) + disp[j] * u
        Q = P + disp
        # ... and as long as the font's: scaled evenly about where it crosses itself until its tip is the centre of the pen's round
        # end there (the outline's furthest point that way, less half the pen)
        for i, j in loops:
            c = (Q[i] + Q[j]) / 2
            k_ = i + int(np.argmax(np.hypot(*(Q[i:j + 1] - c).T)))
            dvec = tt._unit(Q[k_] - c)
            rel = INK - c
            along, across = rel @ dvec, np.abs(rel @ np.array([-dvec[1], dvec[0]]))
            reach_ = along[(across < 4.0) & (along > 0)].max() - PEN
            Q[i:j + 1] = c + (Q[i:j + 1] - c) * (reach_ / np.hypot(*(Q[k_] - c)))
        out.append((Q, owner, groups))
    new = []
    for (P, owner, groups), cmds, o in zip(out, strokes, old):
        res = [("M", [P[0]])]
        gi = {k: n for n, grp in enumerate(groups) for k in grp}
        def gline(n):
            q = P[np.isin(owner, groups[n])]; return q[0], tt._unit(q[-1] - q[0])
        k = 1
        while k < len(cmds):
            if cmds[k][0] == "L":
                e = P[owner == k][-1]
                if k + 1 < len(cmds) and cmds[k + 1][0] == "L" and gi[k + 1] != gi[k]:
                    # two lines meeting at a corner (the zigzag's tops and bottom): the corner where the moved lines cross
                    (a1, d1), (a2, d2) = gline(gi[k]), gline(gi[k + 1])
                    y0 = float(np.asarray(cmds[k][1][-1], float)[1])
                    if min(abs(y0 - tt.CAP_TOP), abs(y0 - tt.BASE)) < 5.0:
                        # a top on the top line, a bottom on the baseline: on the stem's moved line (the one nearer the slant)
                        y0 = tt.CAP_TOP if abs(y0 - tt.CAP_TOP) < 5.0 else tt.BASE
                        sl = tt._unit(np.array([tt.SLANT_T, -1.0]))
                        a_, d_ = (a1, d1) if abs(d1 @ sl) > abs(d2 @ sl) else (a2, d2)
                        e = a_ + d_ * (y0 - a_[1]) / d_[1]
                    else:
                        tt_ = np.linalg.solve(np.c_[d1, -d2], a2 - a1)
                        e = a1 + tt_[0] * d1
                res.append(("L", [e])); k += 1; continue
            k2 = k
            while k2 < len(cmds) and cmds[k2][0] == "C": k2 += 1
            i0 = int(np.argmax(owner == k)) - 1; i1 = int(np.nonzero(owner == k2 - 1)[0][-1])
            seg = P[i0:i1 + 1]
            t0 = tt._unit(seg[1] - seg[0]); t1 = tt._unit(seg[-1] - seg[-2])
            # along the line it leaves or joins: a stem runs into its hook without a corner
            if k > 1 and cmds[k - 1][0] == "L": t0 = tt._unit(P[owner == k - 1][-1] - P[owner == k - 1][0])
            if k2 < len(cmds) and cmds[k2][0] == "L": t1 = tt._unit(P[owner == k2][-1] - P[owner == k2][0])
            res += tt._fit_span(seg, t0, t1, tol=tol)
            k = k2
        new.append(res)
    # a stroke that started on another one (Б's bowl on the stem) starts on it again
    for i, o in enumerate(old):
        for j, o2 in enumerate(old):
            if i == j: continue
            dd = np.hypot(*(dg.resample(o2, 0.3) - o[0]).T)
            if dd.min() < 2.5:  # Б 1.6, Ж 1.3 off the stroke they start on
                other = dg.resample(np.array(tt.parse_path(dg.fmt(new[j]))), 0.3)
                p0 = np.asarray(new[i][0][1][0], float)
                tgt = other[np.argmin(np.hypot(*(other - p0).T))]
                sh = tgt - p0
                # the start moved onto it, the first cubic's handles moved less and less along it: no step at the start
                first = new[i][1]
                if first[0] == "C":
                    c1, c2, e = [np.asarray(q, float) for q in first[1]]
                    first = ("C", [c1 + sh * 2 / 3, c2 + sh / 3, e])
                new[i] = [("M", [p0 + sh]), first] + new[i][2:]
    return new


def flat_hat_to_font_end(strokes, label, stroke=1, flat_deg=10.0, tol=0.1):
    """After snap_to_font: the hat's run along the top is a straight line to where the font's hat ends (owner, 2026-10-19, Б: the
    font's run is practically straight and goes on a little further than ours; following the skeleton made it wavy, and snapping
    across never lengthens a stroke). The run starts where the hat's direction first comes within `flat_deg` of level; it ends at the
    centre of the pen's round end: the outline's furthest point along the top, less half the hat's thickness, halfway between the
    outline's top and bottom there. The curve before it is refitted to run into it without a corner."""
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    fn = stencil_map(label, like=np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in PAPER_UNSNAPPED[label]]))
    ink = np.vstack([fn(np.array(poly, float)) for poly in sk["outline"]])
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[stroke]))), 0.3)
    d = np.diff(p, axis=0); ang = np.degrees(np.arctan2(-d[:, 1], d[:, 0]))
    level = (np.abs(ang) < flat_deg) & (d[:, 0] > 0)
    i0 = int(np.argmax(level))  # where the curve over the top first comes level
    band = ink[np.abs(ink[:, 1] - p[i0:, 1].mean()) < 8]
    x_ink = band[:, 0].max()
    mid = band[np.abs(band[:, 0] - (p[i0, 0] + x_ink) / 2) < 1.0]
    r = (mid[:, 1].max() - mid[:, 1].min()) / 2
    at = band[np.abs(band[:, 0] - (x_ink - r)) < 1.0]
    end = np.array([x_ink - r, (at[:, 1].max() + at[:, 1].min()) / 2])
    run = tt._unit(end - p[i0])
    head = p[:i0 + 1]
    strokes[stroke] = [("M", [head[0]])] + tt._fit_span(head, tt._unit(head[4] - head[0]), run, tol=tol) + [("L", [end])]
    return strokes


# Е's waist as the owner drew it over the font (2026-10-19, a zoomed review sheet): paper units from the tip of the waist, the upper
# arc from where it leaves our line to the tip, the lower arc from the tip to where it joins our line again
WAIST_UPPER = [(-18.0, -10.1), (-15.75, -7.5), (-13.75, -5.5), (-11.25, -4.0), (-7.25, -2.6), (-3.25, -1.1), (0.0, 0.0)]
WAIST_LOWER = [(0.0, 0.0), (-4.25, 0.0), (-7.25, 0.1), (-10.75, 1.0), (-14.25, 2.25), (-18.25, 4.0), (-22.25, 6.25), (-25.75, 9.1)]


def _catmull(pts, before, after, n=12):
    """A smooth curve through pts (Catmull-Rom), its end directions set by the points `before` and `after` it."""
    P = np.vstack([before, pts, after]); out = [P[1]]
    for k in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[k - 1], P[k], P[k + 1], P[k + 2]
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


def waist_cusp(strokes, label="Е", tol=0.1):
    """Е's waist: no loop, two arcs meeting at a point (owner, 2026-10-19: «там не должно быть петли, там просто две дуги
    соединяются ... с нижнего конца этой дуги влево выходит нижняя дуга»), along the owner's own drawing of it (WAIST_UPPER,
    WAIST_LOWER, from the tip): the upper arc comes in gently from above into the tip of the font's waist (the centre of the pen's
    round end there), the lower arc leaves it a little below level and runs on down to the left without a bulge. The way there and
    back the hand drew (a narrow loop after snap_to_font) is replaced between where the drawing meets our line."""
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    fn = stencil_map(label, like=np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in PAPER_UNSNAPPED[label]]))
    ink = np.vstack([fn(np.array(poly, float)) for poly in sk["outline"]])
    S = fn(np.array(sk["pts"], float))
    pen = float(np.median(np.min(np.hypot(S[::7, None, 0] - ink[None, :, 0], S[::7, None, 1] - ink[None, :, 1]), axis=1)))
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[0]))), 0.3)
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    i, j = _small_loops(p, s_)[0]
    t = i + int(np.argmax(p[i:j + 1, 0]))  # the tip: the loop's rightmost point
    band = ink[np.abs(ink[:, 1] - p[t, 1]) < 6]
    x_ink = band[band[:, 0] < p[t, 0] + 15, 0].max()
    at = band[np.abs(band[:, 0] - (x_ink - pen)) < 1.0]
    T = np.array([x_ink - pen, (at[:, 1].max() + at[:, 1].min()) / 2])
    up, lo = T + np.array(WAIST_UPPER), T + np.array(WAIST_LOWER)
    a = int(np.argmin(np.hypot(*(p[:i] - up[0]).T)))
    b = j + int(np.argmin(np.hypot(*(p[j:] - lo[-1]).T)))
    upper = np.vstack([p[:a], _catmull(np.vstack([p[a], up[1:]]), p[a - 3], 2 * up[-1] - up[-2])])
    lower = np.vstack([_catmull(np.vstack([lo[:-1], p[b]]), 2 * lo[0] - lo[1], p[b + 3]), p[b + 1:]])
    def fit(q):
        return tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    strokes[0] = [("M", [upper[0]])] + fit(upper) + fit(lower)
    return strokes


def zigzag_middle(strokes, k=1, near=10.0):
    """Ж's middle element, built as the owner described it (2026-10-19): it starts on the left element's arc, goes up the diagonal
    to its top (as snap_to_font left it, on the top line), comes down exactly along the ruling's slant to the baseline, and goes up
    again parallel to the first diagonal, as far as it started from the slant: its two ends equally far from the down stroke."""
    pts = np.array([np.asarray(ps[-1], float) for _, ps in strokes[k]])
    T = pts[int(np.argmin(pts[:, 1]))]
    S0 = pts[0]
    arc = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[0]))), 0.1)
    d1 = tt._unit(T - S0); n1 = np.array([-d1[1], d1[0]])
    cand = arc[np.hypot(*(arc - S0).T) < near]
    S = cand[int(np.argmin(np.abs((cand - T) @ n1)))]  # where the diagonal, carried on down, meets the arc
    sl = tt._unit(np.array([-tt.SLANT_T, 1.0]))
    B = T + sl * (tt.BASE - T[1]) / sl[1]
    E = B + (T - S)
    strokes[k] = [("M", [S]), ("L", [T]), ("L", [B]), ("L", [E])]
    return strokes


def zigzag_right(strokes, label="Ж", k=2, mid=1, rms=0.25, tol=0.1):
    """Ж's right element (owner, 2026-10-19): the top of its arc smooth along the font's line, and the whole element moved left
    until the middle element's right end lies on it. The arc over the top (from the start to below where the middle element meets
    it) is the smoothing spline through the font's skeleton points along it (its corners were the skeleton's raster steps), within
    `rms` units of them; then the element is moved along the row so that it passes through the middle element's end."""
    from scipy.interpolate import UnivariateSpline
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    fn = stencil_map(label, like=np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in PAPER_UNSNAPPED[label]]))
    S = fn(np.array(sk["pts"], float))
    E = np.asarray(strokes[mid][-1][1][-1], float)
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    top = int(np.argmin(p[:, 1]))
    j = top + int(np.argmax(p[top:, 1] > E[1] + 12.0))  # below where the middle element meets it
    q = S[np.argmin(np.hypot(p[:j + 1, None, 0] - S[None, :, 0], p[:j + 1, None, 1] - S[None, :, 1]), axis=1)]
    t = np.arange(len(q)) * 0.3
    w = np.ones(len(q)); w[-8:] = 50.0  # the end stays on the rest of the line
    q[-8:] = p[j - 7:j + 1]
    sx = UnivariateSpline(t, q[:, 0], w=w, s=len(q) * rms ** 2); sy = UnivariateSpline(t, q[:, 1], w=w, s=len(q) * rms ** 2)
    arc = np.c_[sx(t), sy(t)]
    p = np.vstack([arc, p[j + 1:]])
    # moved along the row: where it comes down past the middle element's end, it passes through it
    after = p[top:]
    i = int(np.argmin(np.abs(after[:, 1] - E[1])))
    p = p + np.array([E[0] - after[i, 0], 0.0])
    strokes[k] = [("M", [p[0]])] + tt._fit_span(p, tt._unit(p[4] - p[0]), tt._unit(p[-1] - p[-5]), tol=tol)
    return strokes


def _font_frame(label):
    """The font's outline points, skeleton points and half its pen, on the deck's paper where stencil_map put the letter."""
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    fn = stencil_map(label, like=np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in PAPER_UNSNAPPED[label]]))
    ink = np.vstack([fn(np.array(poly, float)) for poly in sk["outline"]])
    S = fn(np.array(sk["pts"], float))
    pen = float(np.median(np.min(np.hypot(S[::7, None, 0] - ink[None, :, 0], S[::7, None, 1] - ink[None, :, 1]), axis=1)))
    return ink, S, pen


def _reach(ink, at, d, pen, band=4.0):
    """How far from `at` along `d` the font's ink goes (within `band` across), less half the pen: the centre of its round end."""
    rel = ink - at
    along, across = rel @ d, np.abs(rel @ np.array([-d[1], d[0]]))
    m = (across < band) & (along > -2.0)
    return (along[m].max() if m.any() else 0.0) - pen


def rise_into_stem(strokes, k=0, gap=2.5, tol=0.1):
    """И: the rise runs into the stem in the upper third and goes on up along it to the top: one line there, the stem straight on
    the slant as in А (owner, 2026-10-19: «сверху нет петли ... в верхней трети фактически соединяются в одну линию ... левый штрих
    сливается с правым»). The rise, from where it is still `gap` units off the stem's line, bends into that line (a cubic arriving
    along it) where the font's two strokes become one, no lower than a third of the way down from the top line; then straight up
    the line to the top. The stem down from the top is the same line."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    top = min(_turns(p, k=8), key=lambda i: p[i, 1])
    T = p[top]
    stem = p[top:top + 60]
    sd = tt._unit(stem[-1] - stem[0]); sn = np.array([-sd[1], sd[0]])
    dist = np.abs((p[:top] - T) @ sn)
    rb = int(np.argmax(p[:top, 1]))
    merge = rb + int(np.argmax(dist[rb:] < 0.6))  # where snap_to_font laid the rise onto the stem: the font's strokes are one
    y_m = min(p[merge, 1], tt.CAP_TOP + (tt.BASE - tt.CAP_TOP) / 3)
    M = T + sd * (y_m - T[1]) / sd[1]  # on the stem's line
    r = rb + int(np.argmax(dist[rb:] < gap)) - 1
    while r > rb and p[r, 1] < y_m + 6: r -= 1  # the bend begins below the merge
    A = p[r]; tA = tt._unit(p[r] - p[r - 3]); up = -sd; L = np.hypot(*(M - A)); u = np.linspace(0, 1, 60)[:, None]
    bend = (2*u**3 - 3*u**2 + 1) * A + (u**3 - 2*u**2 + u) * L * tA + (-2*u**3 + 3*u**2) * M + (u**3 - u**2) * L * up
    def fit(q): return tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    a = np.vstack([p[:r], bend])
    rest = p[top:]
    strokes[k] = [("M", [a[0]])] + fit(a) + [("L", [T])] + fit(rest)
    return strokes


def short_i(strokes, label="Й", source="И"):
    """Й: the body is И as finished (PAPER), made evenly smaller (across the slant as much as up, about the baseline) to the font's
    body of Й (its skeleton's top below the breve) and set on the font's body; the breve is the font's, snapped and carried to its
    ends. И was approved by the owner (2026-10-19); in the font Й's body is И's, the breve makes the whole letter taller, so on the
    deck's paper, where the letter stands between the same lines, the body is smaller."""
    snapped = ends_to_font(snap_to_font(strokes, label), label, which=((1, 0), (1, -1)))
    breve = snapped[1]
    ink, S, pen = _font_frame(label)
    bp = np.array(tt.parse_path(dg.fmt(breve)))
    body_S = S[S[:, 1] > bp[:, 1].max() + 3.0]
    top_j = body_S[:, 1].min()
    src = PAPER[source]
    allp = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in src])
    k = (tt.BASE - top_j) / (tt.BASE - allp[:, 1].min())
    us, uj = tt.upright(allp), tt.upright(body_S)
    dx = (uj[:, 0].min() + uj[:, 0].max()) / 2 - (us[:, 0].min() + us[:, 0].max()) / 2 * k
    def move(q):
        u = tt.upright(np.asarray(q, float).reshape(-1, 2))
        return tt.from_upright(np.c_[u[:, 0] * k + dx, tt.BASE - (tt.BASE - u[:, 1]) * k])
    body = [[(c, [move(q)[0] for q in ps]) for c, ps in cmds] for cmds in src]
    return body + [breve]


def flag_corner(strokes, k=0, clear=2.0, tol=0.1):
    """К: the stem starts at the top line and the flag runs into it at an angle, a corner, not bending down into it (owner,
    2026-10-19: «вертикальная часть ... начинается от горизонтальной линии, и флажок должен входить в неё под углом»). The stem's
    line is carried up to the top line; the flag is kept up to the dip in its middle and rises from there in one even curve
    into the stem's top, arriving straight at it."""
    cmds = strokes[k]
    j = next(i for i in range(1, len(cmds)) if cmds[i][0] == "L")  # the stem: the first line
    a, b = np.asarray(cmds[j - 1][1][-1], float), np.asarray(cmds[j][1][0], float)
    d = tt._unit(b - a)
    T = a + d * (tt.CAP_TOP - a[1]) / d[1]  # the stem's line at the top line
    flag = dg.resample(np.array(tt.parse_path(dg.fmt(cmds[:j]))), 0.3)
    ux = tt.upright(flag)[:, 0]; uT = tt.upright(T[None])[0, 0]
    n = int(np.argmax(ux > uT - clear)) if (ux > uT - clear).any() else len(flag)
    # from the dip in the middle of the flag (its lowest point after the first wave) one even curve rises into the stem's top:
    # the flag's own end bends down into the stem, and joining onto it left a kink
    half = len(flag) * 2 // 5
    n = half + int(np.argmax(flag[half:n, 1])) + 1
    f = flag[:max(n, 5)]
    t_end = tt._unit(f[-1] - f[max(-len(f), -7)])
    L = np.hypot(*(T - f[-1])); u = np.linspace(0, 1, 30)[:, None]
    bridge = (2*u**3 - 3*u**2 + 1) * f[-1] + (u**3 - 2*u**2 + u) * L * t_end + (-2*u**3 + 3*u**2) * T + (u**3 - u**2) * L * tt._unit(T - f[-1])
    q = np.vstack([f, bridge[1:]])
    strokes[k] = [("M", [q[0]])] + tt._fit_span(q, tt._unit(q[4] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol) + cmds[j:]
    return strokes


def end_like_font(strokes, label, k, end=0, span=25.0, rms=0.15, tol=0.1):
    """A stroke's end (its last `span` units, and on to where the font's stroke ends) laid along the font's own line (К's top
    hook on the right: owner, 2026-10-19, «верхний крюк правого элемента сделать ближе к шрифтовой линии»). The way is found
    along the font's skeleton as a graph (neighbouring points joined), from the skeleton point at `span` units before our end to
    the skeleton's end nearest ours, then smoothed (a spline within `rms` of it: the raster's steps out, its shape kept)."""
    from scipy.spatial import cKDTree
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra
    from scipy.interpolate import UnivariateSpline
    ink, S, pen = _font_frame(label)
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    if end == 0: p = p[::-1]
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    j = int(np.argmin(np.abs(s_ - (s_[-1] - span))))
    tree = cKDTree(S)
    step = float(np.median(tree.query(S[::11], k=2)[0][:, 1]))
    pairs = np.array(sorted(tree.query_pairs(step * 2.5)))  # the raster's diagonal neighbours, sheared onto the paper
    w = np.hypot(*(S[pairs[:, 0]] - S[pairs[:, 1]]).T)
    G = coo_matrix((np.r_[w, w], (np.r_[pairs[:, 0], pairs[:, 1]], np.r_[pairs[:, 1], pairs[:, 0]])), shape=(len(S), len(S))).tocsr()
    deg = np.diff(G.indptr)
    ends = np.nonzero(deg == 1)[0]
    a = int(tree.query(p[j])[1])
    b = int(ends[np.argmin(np.hypot(*(S[ends] - p[-1]).T))])
    _, pred = dijkstra(G, indices=a, return_predecessors=True)
    route = [b]
    while route[-1] != a and pred[route[-1]] >= 0: route.append(int(pred[route[-1]]))
    r = dg.resample(S[route[::-1]], 0.3)
    t = np.arange(len(r)) * 0.3
    wt = np.ones(len(r)); wt[:6] = 50.0
    r[0] = p[j]
    sx = UnivariateSpline(t, r[:, 0], w=wt, s=len(r) * rms ** 2); sy = UnivariateSpline(t, r[:, 1], w=wt, s=len(r) * rms ** 2)
    r = np.c_[sx(t), sy(t)]
    q = np.vstack([p[:j], r])
    if end == 0: q = q[::-1]
    strokes[k] = [("M", [q[0]])] + tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    return strokes


INK_W = 2 * 48 / (4.94 * 150 / 25) / CAP_K  # the deck's pen on the Bulgarian paper (review_sheet.py INK_W), on DESIGN's paper


def touch_stem(strokes, k=1, stem_k=0, ease=14.0, tol=0.1):
    """К: the right stroke's point nearest the stem just touches it as the deck draws them (their centre lines one pen apart),
    not run into it (owner, 2026-10-19: «правый штрих всё-таки должен касаться левого, буквально касаться, а не сливаться. В
    шрифте ошибка в написании в этом месте»). That point moves across the stem's line, the path beside it less and less over
    `ease` units, so its shape is kept."""
    cmds = strokes[stem_k]
    j = next(i for i in range(1, len(cmds)) if cmds[i][0] == "L")
    a, b = np.asarray(cmds[j - 1][1][-1], float), np.asarray(cmds[j][1][0], float)
    d = tt._unit(b - a); n = np.array([-d[1], d[0]])
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    off = (p - a) @ n
    side = np.sign(np.median(off))
    c = int(np.argmin(off * side))
    shift = n * side * (INK_W - off[c] * side)
    # before the point: the shift grows evenly from below the top hook, so the diagonal coming down to it turns a little and stays
    # straight (an eased bump bowed it: owner, «заметный прогиб на подходе к поясу»); after it: eased over `ease` units
    top = int(np.argmax(p[:c, 1] > tt.CAP_TOP + 15.0))
    w_up = np.clip((s_ - s_[top]) / (s_[c] - s_[top]), 0, 1)
    w_dn = np.clip(1 - (s_ - s_[c]) / ease, 0, 1); w_dn = w_dn * w_dn * (3 - 2 * w_dn)
    w = np.where(s_ <= s_[c], w_up, w_dn)[:, None]
    p = p + w * shift
    strokes[k] = [("M", [p[0]])] + tt._fit_span(p, tt._unit(p[3] - p[0]), tt._unit(p[-1] - p[-4]), tol=tol)
    return strokes


BANK_WIDE = HERE.parent.parent.parent / "propis" / "wide.json"


def breve_i(made, label="Й", base="И", lower_marked="й", lower_plain="и", scale=1.25):
    """Й: our И exactly, with the bank's й breve above it (owner, 2026-10-19: the body «точно такая же, как И, и с шляпкой над
    линией на небольшом расстоянии ... практически как в русской версии»; the breve «точно посередине между двумя наклонными этих
    вертикальных штрихов»). Height and size as the deck sets the marks of its own Й (glyphOverrides.js markedCapital: as far above
    the capital's top as above the lowercase, 1.25 times larger); across: its middle exactly halfway between the lines of the two
    stems, carried up the slant to the breve's height. Those lines: the leftmost and the rightmost ink of И at the lowercase line."""
    wide = {g["label"]: g for g in json.loads(BANK_WIDE.read_text())["glyphs"]}
    marks = wide[lower_marked]["strokes"][len(wide[lower_plain]["strokes"]):]
    mp = np.vstack([np.array(tt.parse_path(m["d"])) for m in marks])
    mx, my = (mp[:, 0].min() + mp[:, 0].max()) / 2, (mp[:, 1].min() + mp[:, 1].max()) / 2
    lower_top = min(np.array(tt.parse_path(st["d"]))[:, 1].min() for st in wide[lower_plain]["strokes"])
    body = next(g for g in made if g["label"] == base)
    bp = np.vstack([np.array(tt.parse_path(st["d"])) for st in body["strokes"]])
    cy = bp[:, 1].min() - (lower_top - my) * scale
    def placed(cx):
        return [np.c_[(q[:, 0] - mx) * scale + cx, (q[:, 1] - my) * scale + cy] for q in (np.array(tt.parse_path(m["d"])) for m in marks)]
    # the stems on paper: where И's ink crosses the lowercase line, its leftmost and rightmost crossing, up the slant
    ink = dg.resample(tt.to_paper(bp), 0.2)
    near = ink[np.abs(ink[:, 1] - tt.X_TOP) < 0.3]
    paper0 = tt.to_paper(np.vstack(placed(0.0)))
    yb = (paper0[:, 1].min() + paper0[:, 1].max()) / 2
    up = lambda x, y: x + (y - yb) * tt.SLANT_T  # a point's slant line at the breve's height
    centre = (up(near[:, 0].min(), tt.X_TOP) + up(near[:, 0].max(), tt.X_TOP)) / 2
    now = (paper0[:, 0].min() + paper0[:, 0].max()) / 2
    k = tt.to_paper(np.array([[1.0, cy]]))[0, 0] - tt.to_paper(np.array([[0.0, cy]]))[0, 0]  # paper per bank unit across
    cx = (centre - now) / k
    breve = []
    for m in marks:
        d = m["d"]
        nums = [float(v) for v in __import__("re").findall(r"-?\d*\.?\d+(?:[eE][+-]?\d+)?", d)]
        it = iter(nums)
        out = __import__("re").sub(r"-?\d*\.?\d+(?:[eE][+-]?\d+)?", lambda _: "{:.2f}", d)
        vals = []
        for x, y in zip(it, it): vals += [(x - mx) * scale + cx, (y - my) * scale + cy]
        breve.append({"d": out.format(*vals)})
    g = dict(body); g["label"] = label; g["strokes"] = body["strokes"] + breve
    g["sourceLabel"] = f"{label}: {base} + кратка {lower_marked} (банк), посередине между стойками"
    g["exitStroke"] = 0  # the next letter joins from the body, never from the breve (it ends furthest right)
    return g


def close_smooth(strokes, k=0, span=12.0, tol=0.1):
    """О: the oval closes on itself without a notch: its last `span` units are redrawn to arrive back at its start along the
    start's own direction (the font's oval is one smooth closed line; the hand's end ran past the start at an angle)."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    t0 = tt._unit(p[6] - p[0])
    # the end: where the path comes nearest the start again (it may run past it)
    late = np.nonzero(s_ > s_[-1] * 0.7)[0]
    e = late[int(np.argmin(np.hypot(*(p[late] - p[0]).T)))]
    a = int(np.argmin(np.abs(s_ - (s_[e] - span))))
    A, tA = p[a], tt._unit(p[a] - p[a - 3])
    L = np.hypot(*(p[0] - A)); u = np.linspace(0, 1, 50)[:, None]
    tail = (2*u**3 - 3*u**2 + 1) * A + (u**3 - 2*u**2 + u) * L * tA + (-2*u**3 + 3*u**2) * p[0] + (u**3 - u**2) * L * t0
    q = np.vstack([p[:a], tail])
    strokes[k] = [("M", [q[0]])] + tt._fit_span(q, t0, t0, tol=tol)
    return strokes


def oval_start(strokes, k=0, down=1 / 8, round_r=14.0, sigma=4.0, tol=0.1):
    """О (owner, 2026-10-19): the oval starts not at its very top but on its right side, «на одну седьмую правой половины вниз.
    Можно даже одну восьмую», and goes up over the top as before; and the top is round, not the font's little peak («верхний
    горбик убери ... там немножко острый край овала»). The closed line is smoothed around the top (within `round_r` units of it,
    eased in), then started `down` of the right half's length below the top; it ends where it starts, along the same direction."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    if np.hypot(*(p[-1] - p[0])) < 1.0: p = p[:-1]
    n = len(p)
    seg = np.hypot(*np.diff(np.vstack([p, p[:1]]), axis=0).T)
    s_ = np.concatenate([[0], np.cumsum(seg)])[:n]; total = s_[-1] + seg[-1]
    top = int(np.argmin(p[:, 1]))
    d_top = np.abs((s_ - s_[top] + total / 2) % total - total / 2)  # distance along the loop from the top
    w = np.clip(1 - d_top / round_r, 0, 1); w = (w * w * (3 - 2 * w))[:, None]
    m = int(round(sigma * 3 / 0.3)); kern = np.exp(-0.5 * (np.arange(-m, m + 1) * 0.3 / sigma) ** 2); kern /= kern.sum()
    ext = np.vstack([p[-m:], p, p[:m]])
    sm = np.c_[np.convolve(ext[:, 0], kern, "valid"), np.convolve(ext[:, 1], kern, "valid")]
    p = p * (1 - w) + sm * w
    p = tt.shear_scale(p, (tt.BASE - tt.CAP_TOP) / (tt.BASE - p[:, 1].min()))  # the rounding lowered the top: back on the top line
    top = int(np.argmin(p[:, 1])); bot = int(np.argmax(p[:, 1]))
    # the right half: from the top the way the pen does NOT go first (it goes left over the top), i.e. backwards along the loop
    back = (top - np.arange(n)) % n
    right = back[: int((top - bot) % n) + 1]
    rs = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p[right], axis=0).T))])
    start = right[int(np.argmin(np.abs(rs - rs[-1] * down)))]
    q = np.vstack([p[start:], p[:start], p[start:start + 1]])
    t0 = tt._unit(q[4] - q[0])
    strokes[k] = [("M", [q[0]])] + tt._fit_span(q, t0, t0, tol=tol)
    return strokes


def reversed_strokes(strokes, ks=(0,)):
    """These strokes written the other way round (П: its left stem from the top down into the hook, not up from the hook as the
    font's pen path goes: owner, 2026-10-19, «пусть левая стойка пишется сверху вниз»). Same line, commands in reverse order."""
    for k in ks:
        cmds = strokes[k]
        pts = [np.asarray(cmds[0][1][0], float)]
        segs = []
        for c, ps in cmds[1:]:
            segs.append((c, pts[-1], [np.asarray(q, float) for q in ps])); pts.append(np.asarray(ps[-1], float))
        out = [("M", [pts[-1]])]
        for c, p0, ps in reversed(segs):
            out.append(("L", [p0]) if c == "L" else ("C", [ps[1], ps[0], p0]))
        strokes[k] = out
    return strokes


def ef_three(strokes, k=0, off=1.0, tol=0.1):
    """Ф in three strokes, as it is written (owner, 2026-10-19): the flag and the stem in one go down into the hook below the line;
    a pen lift; the left ear, from the stem at the top round to the left and back to the stem at the bottom; a lift; the right
    ear, from the stem at the top round to the right and back to the stem at the bottom. The font's pen path ran stem, left ear
    (from the bottom), right ear, descender in one. The parts are cut where the path leaves the stem's line (`off` units) and
    meets it again; the ears' ends sit on that line; the stem runs on into the descender through the gap between."""
    cmds = strokes[k]
    j = next(i for i in range(1, len(cmds)) if cmds[i][0] == "L")
    a, b = np.asarray(cmds[j - 1][1][-1], float), np.asarray(cmds[j][1][0], float)
    d = tt._unit(b - a); n = np.array([-d[1], d[0]])
    p = dg.resample(np.array(tt.parse_path(dg.fmt(cmds))), 0.3)
    dist = np.abs((p - a) @ n)
    ib = int(np.argmin(np.hypot(*(p - b).T)))  # the stem's end (the line's last point)
    lb = ib + int(np.argmax(dist[ib:] > off))  # the path leaves the stem's line: the left ear begins
    # the top junction: where the path, round the left ear, comes back to the stem's line near the top
    up = np.nonzero((np.arange(len(p)) > lb + 30) & (p[:, 1] < tt.X_TOP))[0]
    jt = int(up[np.argmin(dist[up])])
    # the right ear comes back to the line at the bottom: from there the descender
    # the right ear: past its lowest point on the right it turns back up to the stem; it ends where it first reaches the line
    after = np.arange(len(p)) > jt + 30
    far = int(np.argmax(np.where(after, dist, -1)))  # its widest point, well away from the stem
    jb = far + int(np.argmax(dist[far:] < off))
    on = lambda q: a + d * ((q - a) @ d)  # a point onto the stem's line
    left = p[lb:jt + 1][::-1].copy(); left[0] = on(left[0]); left[-1] = on(left[-1])
    right = p[jt:jb + 1].copy(); right[0] = on(right[0]); right[-1] = on(right[-1])
    # the stem straight on through the junction into the descender: the line to its point at the descender's start, then on
    k0 = jb + int(np.argmax(dist[jb:] > off))
    # the line ends 12 units before the descender leaves it and bends smoothly into the hook (ending it right there kinked)
    stem_end = on(p[max(k0 - 40, jb)])
    desc = p[min(k0 + 30, len(p) - 6):]
    L = np.hypot(*(desc[0] - stem_end)); u = np.linspace(0, 1, 20)[:, None]
    t1 = tt._unit(desc[4] - desc[0])
    bridge = (2*u**3 - 3*u**2 + 1) * stem_end + (u**3 - 2*u**2 + u) * L * d + (-2*u**3 + 3*u**2) * desc[0] + (u**3 - u**2) * L * t1
    def fit(q, t0=None, t1_=None):
        return tt._fit_span(q, tt._unit(q[3] - q[0]) if t0 is None else t0, tt._unit(q[-1] - q[-4]) if t1_ is None else t1_, tol=tol)
    first = cmds[:j + 1] + [("L", [stem_end])] + fit(np.vstack([bridge, desc[1:]]), d)
    strokes[k] = first
    strokes.insert(k + 1, [("M", [left[0]])] + fit(left))
    strokes.insert(k + 2, [("M", [right[0]])] + fit(right))
    return strokes


def fit_between_lines(strokes):
    """The whole letter between the capital's top line and the baseline, made evenly smaller (across the slant as much as up,
    from the top line, about its middle): Ф, whose font hook went below the line (owner, 2026-10-19: «переусердствовал с
    высотой ... на высоту нижнего крюка больше, чем высота любой другой буквы заглавной»; the Russian deck's Ф also stands
    between the two lines)."""
    allp = tt.upright(np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes]))
    k = (tt.BASE - tt.CAP_TOP) / (allp[:, 1].max() - tt.CAP_TOP)
    cx = (allp[:, 0].min() + allp[:, 0].max()) / 2
    def move(q):
        u = tt.upright(np.asarray(q, float).reshape(-1, 2))
        return tt.from_upright(np.c_[cx + (u[:, 0] - cx) * k, tt.CAP_TOP + (u[:, 1] - tt.CAP_TOP) * k])[0]
    return [[(c, [move(q) for q in ps]) for c, ps in cmds] for cmds in strokes]


def ears_on_baseline(strokes, ears=(1, 2)):
    """Ф as the font draws it: the ears' bottom on the baseline, the flag on the capital's top line (owner, 2026-10-19: «уши должны
    быть на базовой линии»): the letter made evenly bigger (across the slant as much as down, from the top line, about its
    middle) until they meet it. The stem then runs on below (stem_down)."""
    allp = tt.upright(np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes]))
    ear = max(np.array(tt.parse_path(dg.fmt(strokes[e])))[:, 1].max() for e in ears)
    k = (tt.BASE - tt.CAP_TOP) / (ear - tt.CAP_TOP)
    cx = (allp[:, 0].min() + allp[:, 0].max()) / 2
    def move(q):
        u = tt.upright(np.asarray(q, float).reshape(-1, 2))
        return tt.from_upright(np.c_[cx + (u[:, 0] - cx) * k, tt.CAP_TOP + (u[:, 1] - tt.CAP_TOP) * k])[0]
    return [[(c, [move(q) for q in ps]) for c, ps in cmds] for cmds in strokes]


def mirror_ear(strokes, src=1, dst=2):
    """Ф's right ear as its left one mirrored across the stem (owner, 2026-10-19: «правое ухо полностью симметричным левому»):
    across the line through the left ear's ends (they sit on the stem), the slant taken out; drawn the same way, top to bottom."""
    q = tt.upright(np.array([strokes[src][0][1][0], strokes[src][-1][1][-1]], float))
    a, d = q[0], tt._unit(q[1] - q[0])
    def flip(p):
        u = tt.upright(np.asarray(p, float).reshape(-1, 2))[0] - a
        return tt.from_upright((a + 2 * np.dot(u, d) * d - u).reshape(1, 2))[0]
    return strokes[:dst] + [[(c, [flip(p) for p in ps]) for c, ps in strokes[src]]] + strokes[dst + 1:]


def smooth_middle(strokes, ya=-22.0, yb=42.0, gap=0.4, mid=40.0):
    """Х: the middle of both strokes, where the font's two lines merge into one (the snapped strokes bent there, crossing back and
    forth), as one smooth arc each (owner, 2026-10-19: «дуги в этом месте сделай плавными и правильными ... не пересекались»):
    each cut at heights `ya` and `yb` (where the lines are still apart, near the letter's middle `mid` across the slant) and the
    piece between replaced by one cubic going on along the stroke at both cuts; its handles as long as make the two arcs come
    `gap` from each other at their closest (far less than the pen: there they read as one line), never crossing."""
    def cut(cmds):
        c = tt._split_at(cmds, [ya, yb])
        ends = [(i, np.asarray(ps[-1], float)) for i, (_, ps) in enumerate(c)]
        def at(y): return min((e for e in ends if abs(e[1][1] - y) < 1e-6), key=lambda e: abs(tt.upright(e[1].reshape(1, 2))[0, 0] - mid))[0]
        i, j = sorted((at(ya), at(yb)))
        A, B = np.asarray(c[i][1][-1], float), np.asarray(c[j][1][-1], float)
        prev = np.asarray(c[i][1][-2] if c[i][0] == "C" else c[i - 1][1][-1], float)
        nxt = np.asarray(c[j + 1][1][0], float)
        return c, i, j, A, B, tt._unit(A - prev), tt._unit(nxt - B)
    C = [cut(strokes[k]) for k in (0, 1)]
    def build(h):
        out = []
        for c, i, j, A, B, tA, tB in C:
            L = np.hypot(*(B - A)) * h
            out.append(c[:i + 1] + [("C", [A + tA * L, B - tB * L, B])] + c[j + 1:])
        return out
    def min_gap(st):
        U = [tt.upright(dg.resample(np.array(tt.parse_path(dg.fmt(x))), 0.2)) for x in st]
        def xs(u, y): return [u[i, 0] + (u[i + 1, 0] - u[i, 0]) * (y - u[i, 1]) / (u[i + 1, 1] - u[i, 1]) for i in range(len(u) - 1) if (u[i, 1] - y) * (u[i + 1, 1] - y) <= 0 and u[i, 1] != u[i + 1, 1]]
        return min(min(xs(U[1], y), key=lambda x: abs(x - mid)) - min(xs(U[0], y), key=lambda x: abs(x - mid)) for y in np.arange(ya + 0.5, yb, 0.25))
    lo, hi = 0.05, 0.6
    for _ in range(30):
        h = (lo + hi) / 2
        if min_gap(build(h)) > gap: lo = h
        else: hi = h
    return build(lo) + list(strokes[2:])


def _design_height(label, y):
    """The height on DESIGN's paper that rescaled() puts at height `y` of the deck's paper (as it moves `label`)."""
    fy, _, _ = frame_map(FRAME_LIKE.get(label, label), DESIGN, json.loads(VARIANT.read_text())["meta"]["script"])
    tt.use_script(DESIGN)
    a, b = tt.BASE - 200.0, tt.BASE + 200.0
    for _ in range(60):
        m = (a + b) / 2
        if fy(m) < y: a = m
        else: b = m
    return (a + b) / 2


def i_with_loop(strokes, label="И", tol=0.1):
    """Ц as И with the font's loop (owner, 2026-10-19: «бери И и приделай петлю»): И as approved, cut where its last hook,
    rising from the baseline, reaches the height of Ц's turn back down (the top of the small hook before the loop), and from
    there Ц's own loop (snapped onto the font), moved across so it starts there; a corner at the turn, as the font has."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[0]))), 0.3)
    it = int(np.argmax(p[:, 1] > tt.BASE + 5))           # the loop goes under the baseline here
    back = max(0, it - int(40 / 0.3))
    c = back + int(np.argmin(p[back:it, 1]))              # the turn: the top of the hook before it
    tail = p[c:]
    I = PAPER[label][0]
    cut = tt._split_at(I, [tail[0, 1]])
    j = max(i for i, (_, ps) in enumerate(cut) if abs(np.asarray(ps[-1])[1] - tail[0, 1]) < 1e-6)
    head = cut[:j + 1]
    at = np.asarray(head[-1][1][-1], float)
    tail = tail + (at - tail[0])
    # the loop's bottom on the deck's bottom line (Ц's font loop goes deeper than И's frame puts that line): what lies under the
    # baseline made shorter along the slant
    low = _design_height(label, tt.R_BASE + tt.R_BAND * json.loads(VARIANT.read_text())["meta"]["script"]["lower"])
    under = tail[:, 1] > tt.BASE
    tail[under] = tt.shear_scale(tail[under], (low - tt.BASE) / (tail[:, 1].max() - tt.BASE))
    PAPER_UNSNAPPED.pop(PAPER_LABEL[0], None)  # the font stencil goes on the finished letter (it is И's, not Ц's font)
    return [head + tt._fit_span(tail, tt._unit(tail[3] - tail[0]), tt._unit(tail[-1] - tail[-4]), tol=tol)] + strokes[1:]


def i_doubled(strokes, label="И", h=30.0):
    """Ш as И with its second element once more (owner, 2026-10-19: Ц was «бери И и приделай петлю»): И as approved, and the
    stretch from its first stem going down through height `h` (under where the rise merges into the next stem) to its second stem
    going down through `h` (the bottom, the rise, the top, back down) written again from there, then the rest of И (the last
    stem's bottom and the exit), moved on by the same step."""
    cut = tt._split_at(PAPER[label][0], [h])
    at = [i for i, (_, ps) in enumerate(cut) if abs(np.asarray(ps[-1])[1] - h) < 1e-6]
    def down(i): return np.asarray(cut[i + 1][1][-1], float)[1] > h  # the stroke goes on downward from crossing i
    downs = [i for i in at if down(i)]
    i1, i2 = downs[0], downs[1]
    d = np.asarray(cut[i2][1][-1], float) - np.asarray(cut[i1][1][-1], float)
    move = lambda part: [(c, [np.asarray(q, float) + d for q in ps]) for c, ps in part]
    PAPER_UNSNAPPED.pop(PAPER_LABEL[0], None)
    return [cut[:i2 + 1] + move(cut[i1 + 1:i2 + 1]) + move(cut[i2 + 1:])] + strokes[1:]


def stems_to_font(strokes, label, n=3, top=-38.0, yr=(-42.0, 46.0), near=3.0, gap=3.0, rounds=3):
    """The letter's stems put onto the font's, all exactly on the slant (owner, 2026-10-19, Ш: «немного растянуть, подтянуть
    вертикальные штрихи к линиям шрифта ... все стойки чуть выровнять по наклонной или по стойкам шрифта, сейчас угол чуть
    разный»). Each of the last `n` lines crossing height `top` (in the upper part only the stems cross it) is followed down
    (`yr`, its points within `near` across the slant, going along it) and fitted by a line, on the letter and on the font's
    skeleton set on it (stencil_map, its median per height); every point is moved across the slant by a smooth monotone map
    through the pairs at its own height: the letter's stem there -> the font's stem's middle, so each stem ends on the slant
    in the font's place and what lies between them is stretched evenly."""
    from scipy.interpolate import PchipInterpolator
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    def clusters(xs):
        xs = sorted(xs); cl = []
        for x in xs:
            if cl and x - cl[-1][-1] < gap: cl[-1].append(x)
            else: cl.append([x])
        return [float(np.mean(c)) for c in cl][-n:]
    def fit(P, x0, along=None):
        lines = []
        for x in x0:
            m = (np.abs(P[:, 0] - x) < near) & (P[:, 1] > yr[0]) & (P[:, 1] < yr[1])
            if along is not None: m &= along
            q = P[m]
            if along is None:  # the skeleton: the median across the slant per height (a rise passing near drops out)
                ys = np.arange(yr[0], yr[1], 2.0)
                q = np.array([[np.median(q[(q[:, 1] >= y) & (q[:, 1] < y + 2), 0]), y + 1] for y in ys if ((q[:, 1] >= y) & (q[:, 1] < y + 2)).sum() > 2])
            lines.append(np.polyfit(q[:, 1], q[:, 0], 1))  # x = k y + c
        return lines
    for _ in range(rounds):
        pts = [tt.upright(dg.resample(np.array(tt.parse_path(dg.fmt(c))), 0.2)) for c in strokes]
        P = np.vstack(pts)
        D = np.vstack([np.gradient(p, axis=0) for p in pts])
        steep = np.abs(D[:, 0]) < 0.35 * np.abs(D[:, 1])
        fn = stencil_map(label, like=np.vstack([tt.from_upright(p) for p in pts]))
        S = tt.upright(fn(np.array(sk["pts"], float)))
        mine = fit(P, clusters([q[0] for q in P if abs(q[1] - top) < 0.15]), steep)
        font = fit(S, clusters([q[0] for q in S if abs(q[1] - top) < 0.4]))
        dst = np.array([np.polyval(l, (yr[0] + yr[1]) / 2) for l in font])
        lo, hi = P[:, 0].min() - 1, P[:, 0].max() + 1
        def move(q):
            u = tt.upright(np.asarray(q, float).reshape(-1, 2))
            src = np.array([np.polyval(l, u[0, 1]) for l in mine])
            f = PchipInterpolator(np.r_[lo, src, hi], np.r_[lo + dst[0] - src[0], dst, hi + dst[-1] - src[-1]])
            u[:, 0] = f(u[:, 0])
            return tt.from_upright(u)[0]
        strokes = [[(c, [move(q) for q in ps]) for c, ps in cmds] for cmds in strokes]
    return strokes


def yu_from_parts(strokes):
    """Ю in three strokes (owner, 2026-10-19): Н's left element (flag, stem, hook) on the font's stem; a short bar from the
    stem to the right at the font's height; then exactly the letter О, as it is written on its own, across the slant where the font's
    oval is, its left side going through the bar's end («точно буква О с прохождением в крайней левой точке через конец штриха 2»).
    The font's own pen path (`strokes`) only says where: its stem and its oval."""
    p = tt.upright(dg.resample(np.array(tt.parse_path(dg.fmt(strokes[0]))), 0.5))
    mid = (p[:, 1] > -40) & (p[:, 1] < 0)
    stem_x = float(np.median(p[mid & (p[:, 0] < np.percentile(p[mid, 0], 40)), 0]))
    oval = p[p[:, 0] > stem_x + 15]
    oval_mid = (oval[:, 0].min() + oval[:, 0].max()) / 2
    # Н's left element, moved across onto the stem
    A = PAPER["Н"][0]
    a = tt.upright(dg.resample(np.array(tt.parse_path(dg.fmt(A))), 0.5))
    am = (a[:, 1] > -40) & (a[:, 1] < 0)
    dx = stem_x - float(np.median(a[am, 0]))
    shift = lambda cmds, d: [(c, [tt.from_upright(tt.upright(np.asarray(q, float).reshape(1, 2)) + [d, 0])[0] for q in ps]) for c, ps in cmds]
    A = shift(A, dx)
    # О as it is, its middle across the slant on the font oval's
    O = PAPER["О"][0]
    o = tt.upright(dg.resample(np.array(tt.parse_path(dg.fmt(O))), 0.3))
    O = shift(O, oval_mid - (o[:, 0].min() + o[:, 0].max()) / 2)
    # the bar at the font's height (owner: «подними туда, где он был»), ending where О's left side crosses that height
    flat = p[(np.abs(np.gradient(p[:, 1])) < 0.05) & (p[:, 1] > tt.X_TOP - 15) & (p[:, 1] < tt.BASE - 30)]
    bar_y = float(np.median(flat[:, 1]))
    q = dg.resample(np.array(tt.parse_path(dg.fmt(O))), 0.2)
    xs = [q[i, 0] + (q[i + 1, 0] - q[i, 0]) * (bar_y - q[i, 1]) / (q[i + 1, 1] - q[i, 1]) for i in range(len(q) - 1) if (q[i, 1] - bar_y) * (q[i + 1, 1] - bar_y) <= 0 and q[i, 1] != q[i + 1, 1]]
    left = np.array([min(xs), bar_y])
    start = tt.from_upright(np.array([[stem_x, bar_y]]))[0]
    B = [("M", [start]), ("L", [left])]
    PAPER_UNSNAPPED.pop(PAPER_LABEL[0], None)
    return [A, B, O]


def ya_lift(strokes, near=1.0, tol=0.1):
    """Я with a pen lift (owner, 2026-10-19: «болгары делают отрыв после рисования первого штриха и овала: штрих - овал - отрыв -
    правый штрих»): the font's one stroke cut where the oval comes back to the stem; the stretch it then ran up the stem to the
    top is dropped; the right stem is its own stroke, from the top down into its hook."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[0]))), 0.2)
    n = len(p)
    top = int(n * 0.4) + int(np.argmin(p[int(n * 0.4):, 1]))   # the turn at the top of the stem
    down = p[top:]
    i = top
    while i > 0 and np.min(np.hypot(*(down - p[i - 1]).T)) < near: i -= 1   # back down the stem it went up along
    A, B = p[:i + 1], p[top:]
    fit = lambda q: [("M", [q[0]])] + tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    return [fit(A), fit(B)] + strokes[1:]


def perfect_oval(strokes, k=0, tol=0.1):
    """A lowercase oval that runs on into the stem (б): a true ellipse (owner, 2026-10-19: «овал должен быть идеальным, то есть
    нужно начинать овал правее и ниже»). The ellipse fitted to the snapped oval (its start, where the pen came in with a point
    at the top right, left out), moved across until the stem's line touches it; the stroke starts at that touching point, goes
    once round the ellipse (up over the top first, as before) and from the same point on up the stem as the font has it."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.2)
    n = len(p)
    b = int(np.argmax(p[: int(n * 0.7), 1]))                 # the oval's bottom
    j = b + int(np.argmax(p[b:, 1] < p[0, 1]))                # back up past the start's height: the stem from here
    away = int(np.argmax(np.hypot(*(p[:b] - p[0]).T) > 10))   # the pen's way in, left out of the fit
    C, e1, e2, a, bb = _fit_ellipse(p[away:j])
    stem = p[j:j + int(25 / 0.2)]                              # the stem's lower part: its line
    c0 = np.polyfit(stem[:, 1], stem[:, 0], 1)                 # x = c0[0] y + c0[1]
    def pts(t, dx=0.0):
        return C + [dx, 0] + a * np.cos(t)[:, None] * e1 + bb * np.sin(t)[:, None] * e2
    T = np.linspace(0, 2 * np.pi, 3600, endpoint=False)
    e = pts(T)
    dist = e[:, 0] - np.polyval(c0, e[:, 1])                   # >0: right of the stem's line
    dx = -dist.max()                                           # moved across so the line just touches it
    e = pts(T, dx)
    i = int(np.argmax(dist))
    # round from there, the way that goes up first
    ring = np.vstack([e[i:], e[:i + 1]])
    if ring[5, 1] > ring[0, 1]: ring = ring[::-1]
    S = ring[0]
    up = p[j:]
    m = int(np.argmin(np.abs(up[:, 1] - (S[1] - 12))))         # the stem joined a little above the touching point
    lead = np.array([S + (up[m] - S) * t for t in np.linspace(0, 1, 30)])[1:]
    path = np.vstack([ring, lead, up[m + 1:]])
    tu = tt._unit
    out = list(strokes)
    out[k] = [("M", [ring[0]])] + tt._fit_span(ring, tu(ring[3] - ring[0]), tu(ring[-1] - ring[-4]), tol=tol)
    rest = np.vstack([ring[-1:], lead, up[m + 1:]])
    out[k] += tt._fit_span(rest, tu(ring[-1] - ring[-4]), tu(rest[-1] - rest[-4]), tol=tol)
    return out


def bowl_oval(strokes, k=0, tol=0.1, lead=12.0):
    """A lowercase bowl hanging off the stem (в): a true ellipse, the stroke's end going on round it until the oval closes (owner,
    2026-10-19: «окончание идёт по овалу, чтобы внизу сформировался идеальный овал»). The ellipse fitted to the lower part of
    the stem and the bowl (the end, where the pen went off flat, left out), moved across until the stem's line touches it on its
    left; the stem runs down into that point and the stroke goes once round the ellipse from there (down first) back to it."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.2)
    b = int(np.argmax(p[:, 1]))                                       # the bowl's bottom
    i40 = b - int(np.argmax(p[b::-1, 1] < tt.BASE - 24))             # the stem, back up from the bottom
    iup = b - int(np.argmax(p[b::-1, 1] < tt.X_TOP))                  # where the stem crossed the x-line going down
    tail = len(p) - int(12 / 0.2)
    C, e1, e2, a, bb = _fit_ellipse(p[i40:tail])
    stem = p[iup:i40]
    c0 = np.polyfit(stem[:, 1], stem[:, 0], 1)
    T_ = np.linspace(0, 2 * np.pi, 3600, endpoint=False)
    e = C + a * np.cos(T_)[:, None] * e1 + bb * np.sin(T_)[:, None] * e2
    # from the baseline up to the x-line, as the font's bowl (owner: «овал чуть выше, чтобы коснулся линии сетки сверху»)
    e = e + [0, tt.BASE - e[:, 1].max()]
    e = tt.shear_scale(e, (tt.BASE - tt.X_TOP) / (tt.BASE - e[:, 1].min()))
    gap = e[:, 0] - np.polyval(c0, e[:, 1])
    e = e - [gap.min(), 0]
    i = int(np.argmin(gap))
    ring = np.vstack([e[i:], e[:i + 1]])
    if ring[5, 1] < ring[0, 1]: ring = ring[::-1]                    # down first
    S = ring[0]
    m = iup + int(np.argmin(np.abs(p[iup:b, 1] - (S[1] - lead))))    # the stem (going down) joined that far above the touching point
    head = p[:m + 1]
    link = np.array([p[m] + (S - p[m]) * t for t in np.linspace(0, 1, 30)])[1:]
    path = np.vstack([head, link, ring[1:]])
    tu = tt._unit
    out = list(strokes)
    # the part before the stem as it was (cut at the join), then the join and the oval
    cut = tt._split_at(strokes[k], [p[m, 1]])
    j = max(n for n, (_, ps) in enumerate(cut) if abs(np.asarray(ps[-1])[1] - p[m, 1]) < 1e-6 and n < len(cut) - 1 and np.hypot(*(np.asarray(ps[-1]) - p[m])) < 1.0)
    rest = np.vstack([np.asarray(cut[j][1][-1], float), link, ring[1:]])
    out[k] = cut[:j + 1] + tt._fit_span(rest, tu(rest[3] - rest[0]), tu(rest[-1] - rest[-4]), tol=tol)
    return out


def o_lower(strokes, k=0, tol=0.1):
    """о (lowercase): a true ellipse fitted to the snapped oval, its bottom on the baseline and its top's ink just touching the
    x-line (as л, м), along the slant; once round the font's way, from a start on the right side as О's."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.2)
    C, e1, e2, a, bb = _fit_ellipse(p[int(3 / 0.2): len(p) - int(3 / 0.2)])
    T_ = np.linspace(0, 2 * np.pi, 3600, endpoint=False)
    e = C + a * np.cos(T_)[:, None] * e1 + bb * np.sin(T_)[:, None] * e2
    e = e + [0, tt.BASE - e[:, 1].max()]
    top = tt.X_TOP + INK_W * CAP_K / 2
    e = tt.shear_scale(e, (tt.BASE - top) / (tt.BASE - e[:, 1].min()))
    i = int(np.argmin(e[:, 1]))
    ring = np.vstack([e[i:], e[:i]])
    if ring[5, 0] > ring[0, 0]: ring = ring[::-1]                      # from the top the pen goes left first, as the font's
    # started on the right side an eighth of the right half down from the top, as О (owner, 2026-10-20: «чуть правее и чуть
    # ниже ... в пропорции, как в заглавной»)
    bot = int(np.argmax(ring[:, 1]))
    rh = np.vstack([ring[:1], ring[bot:][::-1]])                       # the right half, from the top down
    rs = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(rh, axis=0).T))])
    j = len(ring) - int(np.argmin(np.abs(rs - rs[-1] / 8)))
    ring = np.vstack([ring[j:], ring[:j + 1]])
    out = list(strokes)
    out[k] = [("M", [ring[0]])] + tt._fit_span(ring, tt._unit(ring[3] - ring[0]), tt._unit(ring[-1] - ring[-4]), tol=tol)
    return out


def smooth_in_band(strokes, k=0, sigma=3.0, tol=0.1):
    """A round lowercase letter without turns (с): the snapped line smoothed (no shake), then stretched in height along the slant
    so its bottom is on the baseline and its top's ink just touches the x-line (as л, м, о)."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    for _ in range(2): p = _smooth_runs(p, [], sigma=sigma)
    top = tt.X_TOP + INK_W * CAP_K / 2
    y0, y1 = p[:, 1].min(), p[:, 1].max()
    ny = top + (p[:, 1] - y0) * (tt.BASE - top) / (y1 - y0)
    p = np.c_[p[:, 0] - (ny - p[:, 1]) * tt.SLANT_T, ny]
    out = list(strokes)
    out[k] = _fit_corners(p, [], tol=tol)
    return out


def _turned_to_slant(G, gt):
    """г's element turned whole, a little, about the middle of its stem, so the stem's straight part runs exactly on the slant
    (owner, 2026-10-20, for п, р, т: «развернуть элемент целиком чуть-чуть»); `gt`: its top's index."""
    band = tt.BASE - tt.X_TOP
    gb = gt + int(np.argmax(G[gt:, 1]))
    st = G[gt:gb + 1]
    st = st[(st[:, 1] > tt.X_TOP + 0.3 * band) & (st[:, 1] < tt.BASE - 0.3 * band)]
    c = np.polyfit(st[:, 1], st[:, 0], 1)                       # x = c[0] y + c[1]
    v, t = np.array([-c[0], -1.0]), np.array([tt.SLANT_T, -1.0])  # up along the stem, up along the slant
    ang = math.atan2(v[0] * t[1] - v[1] * t[0], v @ t)          # the turn that takes the one onto the other
    ym = 0.5 * (tt.X_TOP + tt.BASE)
    O = np.array([np.polyval(c, ym), ym])
    ca, sa = math.cos(ang), math.sin(ang)
    d = G - O
    return O + np.c_[ca * d[:, 0] - sa * d[:, 1], sa * d[:, 0] + ca * d[:, 1]]


def down_to_base(strokes):
    """The letter stretched down along the slant, its top where it is, until its bottom stands on the baseline (owner, 2026-10-19,
    г: «растяни, чтобы внизу касался линии, как в шрифтовой»)."""
    allp = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes])
    top, bot = allp[:, 1].min(), allp[:, 1].max()
    k = (tt.BASE - top) / (bot - top)
    return [[(c, list(tt.shear_scale(np.array(ps, float), k, base=top))) for c, ps in cmds] for cmds in strokes]


def oval_on_stem(strokes, k=0, tol=0.1, lead=10.0):
    """д: its oval a true ellipse from the baseline up to the x-line, the stem's line touching it on its right (as б's and в's,
    owner 2026-10-19: «овал должен быть идеальным»)."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.2)
    top = p[p[:, 1] < tt.X_TOP + 20][:40]
    c0 = np.polyfit(top[:, 1], top[:, 0], 1)                       # the stem's line: x = c0[0] y + c0[1]
    off = np.abs(p[:, 0] - np.polyval(c0, p[:, 1])) > 2.0
    i1 = int(np.argmax(off)); i2 = i1 + int(np.argmax(~off[i1:]))   # the oval: where the pen leaves the stem and comes back
    C, e1, e2, a, bb = _fit_ellipse(p[i1:i2])
    # the stem exactly on the slant (owner, 2026-10-19: «вертикальный штрих идёт вниз чётко по наклонной»), through the font's at
    # the top
    m = top.mean(axis=0)
    c0 = np.array([-tt.SLANT_T, m[0] + tt.SLANT_T * m[1]])
    T_ = np.linspace(0, 2 * np.pi, 3600, endpoint=False)
    e = C + a * np.cos(T_)[:, None] * e1 + bb * np.sin(T_)[:, None] * e2
    e = e + [0, tt.BASE - e[:, 1].max()]
    e = tt.shear_scale(e, (tt.BASE - tt.X_TOP) / (tt.BASE - e[:, 1].min()))
    over = e[:, 0] - np.polyval(c0, e[:, 1])
    e = e - [over.max(), 0]
    i = int(np.argmax(over))
    T = e[i]
    # started as а (owner, 2026-10-19: «должна начинаться как а, потом вертикальный штрих переходит в петлю»): on the oval's upper
    # right, round it up over the top first, down the left, along the bottom and up its right to the stem; up the stem to the
    # x-line; back down it and on into the loop
    # the start as а's (owner, 2026-10-19: «сделай начало как у буквы а»; the bank's а starts on its oval's right, 0.28 of the
    # band down from the x-line, by the stem): round the oval up first, over the top, down the left, along the bottom and up its
    # right to where the stem touches it
    mid = e[:, 0].mean()
    s0 = int(np.argmin(np.where(e[:, 0] > mid, np.abs(e[:, 1] - (tt.X_TOP + 0.28 * (tt.BASE - tt.X_TOP))), np.inf)))
    n = len(e)
    fwd = np.r_[e[s0:], e[:s0]]
    if fwd[5, 1] > fwd[0, 1]: fwd = np.r_[e[s0::-1], e[:s0:-1]]   # up first
    it = int(np.argmin(np.hypot(*(fwd[n // 4:] - T).T))) + n // 4
    oval = fwd[:it + 1]
    y0 = tt.X_TOP
    up = np.c_[np.polyval(c0, np.linspace(T[1], y0, 60)), np.linspace(T[1], y0, 60)]
    lo = i2 + int(np.argmax(p[i2:, 1]))                              # the loop's bottom: the stem goes down until here
    yL = p[lo, 1] - 16                                               # straight down to here, then into the loop
    down = np.c_[np.polyval(c0, np.linspace(y0, yL, 200)), np.linspace(y0, yL, 200)]
    j = i2 + int(np.argmin(np.abs(p[i2:lo, 1] - (yL + 7))))         # the font's loop taken from here
    A, B = down[-1], p[j]
    tA, tB = tt._unit(down[-1] - down[-2]), tt._unit(p[j + 3] - p[j])
    L = np.hypot(*(B - A)) / 3
    link = np.array([(1 - t) ** 3 * A + 3 * (1 - t) ** 2 * t * (A + tA * L) + 3 * (1 - t) * t ** 2 * (B - tB * L) + t ** 3 * B for t in np.linspace(0, 1, 30)])[1:]
    first = np.vstack([oval, up[1:]])
    second = np.vstack([down, link, p[j + 1:]])
    out = list(strokes)
    tu = tt._unit
    out[k] = [("M", [first[0]])] + tt._fit_span(first, tu(first[3] - first[0]), tu(first[-1] - first[-4]), tol=tol) \
        + tt._fit_span(second, tu(second[3] - second[0]), tu(second[-1] - second[-4]), tol=tol)
    return out


def _corners(p, deg=60.0, w=6):
    """Indices of a dense path where it turns sharply (more than `deg` over `w` points each way), the sharpest of each run."""
    out = []
    for i in range(w, len(p) - w):
        a, b = p[i] - p[i - w], p[i + w] - p[i]
        c = np.dot(a, b) / (np.hypot(*a) * np.hypot(*b) + 1e-9)
        if c < math.cos(math.radians(deg)):
            if out and i - out[-1][0] <= w:
                if c < out[-1][1]: out[-1] = (i, c)
            else: out.append((i, c))
    return [i for i, _ in out]


def _fit_corners(p, corners, tol=0.1):
    """A dense path refitted by cubics, piece by piece between its corners (kept sharp)."""
    cuts = [0] + [c for c in corners if 3 < c < len(p) - 4] + [len(p) - 1]
    cmds = [("M", [p[0]])]
    for a, b in zip(cuts, cuts[1:]):
        q = p[a:b + 1]
        if len(q) < 5: cmds.append(("L", [q[-1]])); continue
        cmds += tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    return cmds


def zh_lower(strokes, k=0, ext=3.0):
    """ж (lowercase): from the x-line to the baseline, the middle zigzag's points on the lines, the left arc's end drawn on a
    little further as the font's (owner, 2026-10-19: «растянуть по вертикали до линий, особенно средний штрих; конец левой дуги
    чуть продлить, как у шрифтовой»)."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    T = tt.SLANT_T
    def along(q, dy):  # moved up or down along the slant
        return np.c_[q[:, 0] - dy * T, q[:, 1] + dy]
    # the whole letter between the x-line and the baseline
    top, bot = p[:, 1].min(), p[:, 1].max()
    p = tt.shear_scale(p, (tt.BASE - tt.X_TOP) / (bot - top), base=bot)
    p = along(p, tt.BASE - p[:, 1].max())
    cs = _corners(p)
    # the left arc's end (its first turn back) drawn on along its own curve
    c = cs[0]
    q = p[c - 25:c + 1]
    s_ = np.r_[0, np.cumsum(np.hypot(*np.diff(q, axis=0).T))]
    fx, fy = np.polyfit(s_, q[:, 0], 2), np.polyfit(s_, q[:, 1], 2)
    ss = np.linspace(s_[-1], s_[-1] + ext, 18)[1:]
    e = np.c_[np.polyval(fx, ss), np.polyval(fy, ss)]
    p = np.vstack([p[:c + 1], e, e[::-1][1:], p[c:]])
    cs = _corners(p)
    # the zigzag: its top corner up to the x-line, its bottom corner down to the baseline, along the slant, the lines on either
    # side of them following evenly
    mids = [i for i in cs[1:] if 0.25 * len(p) < i < 0.75 * len(p)]
    ti = min(mids, key=lambda i: p[i, 1]); bi = max(mids, key=lambda i: p[i, 1])
    anchors = sorted({cs[0] + 20, ti, bi, max(cs) - 0})
    dys = {ti: tt.X_TOP - p[ti, 1], bi: tt.BASE - p[bi, 1]}
    idx = np.arange(len(p))
    d = np.interp(idx, anchors, [dys.get(a, 0.0) for a in anchors], left=0, right=0)
    p = along(p, d) if False else np.c_[p[:, 0] - d * T, p[:, 1] + d]
    out = list(strokes)
    out[k] = _fit_corners(p, _corners(p))
    return out


def desc_to_line(strokes):
    """What hangs under the baseline stretched down along the slant until its lowest point is on the bottom line of the deck's
    paper (the lines touched, as the owner asks of every letter: г «чтобы внизу касался линии, как в шрифтовой»)."""
    low = tt.BASE + tt.R_BAND * tt.SCRIPT.get("lower", 1.0)
    out = []
    for cmds in strokes:
        p = dg.resample(np.array(tt.parse_path(dg.fmt(cmds))), 0.3)
        out.append(p)
    bot = max(p[:, 1].max() for p in out)
    k = (low - tt.BASE) / (bot - tt.BASE)
    res = []
    for p in out:
        under = p[:, 1] > tt.BASE
        p = p.copy(); p[under] = tt.shear_scale(p[under], k)
        res.append(_fit_corners(p, _corners(p)))
    return res


def waist_to_font_tip(strokes, label, k=0, back=14.0):
    """з (lowercase): the waist's point (where the upper arc turns back into the lower) drawn out to the left to the tip of the
    font's (the centre of the pen's round end there; owner, 2026-10-19: «соединение верхнего и нижнего элементов чуть длиннее
    влево, внимательно проверь на шрифтовой букве»); the arcs on either side follow it over `back` units, fading."""
    ink, S, pen = _font_frame(label)
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    cs = [i for i in _corners(p) if tt.X_TOP + 10 < p[i, 1] < tt.BASE]
    c = min(cs, key=lambda i: p[i, 0])
    band = ink[np.abs(ink[:, 1] - p[c, 1]) < 3.0]
    tip_x = band[:, 0].min() + pen
    dx = tip_x - p[c, 0]
    s_ = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    w = np.clip(1 - np.abs(s_ - s_[c]) / back, 0, 1)
    w = 0.5 - 0.5 * np.cos(np.pi * w)
    p = p.copy(); p[:, 0] += dx * w
    # both arms come into the tip inside the font's narrow wedge (owner: «к ней оба элемента уже должны подойти под минимальным
    # углом, ещё раз тщательно проверь серую линию»): over `near` units from the tip each arm is set at the pen's half inside the
    # wedge's edge on its side (where the wedge is narrower than the pen, both on its middle), fading out beyond
    sk = json.loads(FONT_SKELETON.read_text())["letters"][label]
    fn = stencil_map(label, like=np.vstack([np.array(tt.parse_path(dg.fmt(c_))) for c_ in PAPER_UNSNAPPED[label]]))
    polys = [fn(np.array(poly, float)) for poly in sk["outline"]]
    tip = p[c].copy()
    def edges(x):
        ys = []
        for P in polys:
            a, b = P, np.roll(P, -1, axis=0)
            m = (a[:, 0] - x) * (b[:, 0] - x) < 0
            t = (x - a[m, 0]) / (b[m, 0] - a[m, 0])
            ys += list(a[m, 1] + t * (b[m, 1] - a[m, 1]))
        ys = [y for y in ys if abs(y - tip[1]) < 9]
        return (min(ys), max(ys)) if len(ys) >= 2 else None
    near = 16.0
    s_ = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    for i in range(len(p)):
        d = abs(s_[i] - s_[c])
        if d > near or i == c: continue
        e = edges(p[i, 0])
        if e is None: continue
        lo_, hi_ = e
        mid = (lo_ + hi_) / 2
        y = min(lo_ + pen, mid) if i < c else max(hi_ - pen, mid)
        w = 1.0 if d < near * 0.5 else 0.5 + 0.5 * math.cos(math.pi * (d - near * 0.5) / (near * 0.5))
        p[i, 1] += (y - p[i, 1]) * w
    # the lower arm, as the owner drew it (2026-10-20): out of the tip level to the right, flat, then bending down in one smooth
    # curve into the arm `join` units on
    join = 17.0
    s_ = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    jj = int(np.argmin(np.abs(s_ - (s_[c] + join))))
    A, B = p[c], p[jj]
    tB = tt._unit(p[jj + 3] - p[jj])
    L = np.hypot(*(B - A))
    h0, h1 = A + np.array([0.62 * L, 0.0]), B - tB * 0.32 * L
    t = np.linspace(0, 1, 60)[1:-1, None]
    arm = (1 - t) ** 3 * A + 3 * (1 - t) ** 2 * t * h0 + 3 * (1 - t) * t ** 2 * h1 + t ** 3 * B
    # the upper arm too, one smooth curve from `join` units back into the tip, arriving there nearly flat (8 degrees down), at the
    # least angle to the lower arm (owner: «у верхнего сгладь небольшое искривление у дуги на подходе к соединению с нижним»)
    ju = int(np.argmin(np.abs(s_ - (s_[c] - join))))
    U = p[ju]; tU = tt._unit(p[ju + 3] - p[ju - 3])
    tT = np.array([-math.cos(math.radians(8)), math.sin(math.radians(8))])
    Lu = np.hypot(*(A - U))
    g0, g1 = U + tU * 0.35 * Lu, A - tT * 0.5 * Lu
    upper = (1 - t) ** 3 * U + 3 * (1 - t) ** 2 * t * g0 + 3 * (1 - t) * t ** 2 * g1 + t ** 3 * A
    p = np.vstack([p[:ju + 1], upper, p[c:c + 1], arm, p[jj:]])
    out = list(strokes)
    out[k] = _fit_corners(p, _corners(p))
    return out


def to_band(strokes):
    """The letter stretched along the slant until its top is on the x-line and its bottom on the baseline (the lines touched)."""
    allp = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes])
    top, bot = allp[:, 1].min(), allp[:, 1].max()
    k = (tt.BASE - tt.X_TOP) / (bot - top)
    def f(ps):
        q = tt.shear_scale(np.array(ps, float), k, base=bot)
        d = tt.BASE - bot
        return list(np.c_[q[:, 0] - d * tt.SLANT_T, q[:, 1] + d])
    return [[(c, f(ps)) for c, ps in cmds] for cmds in strokes]


def _smooth_runs(p, corners, sigma=1.5, step=0.3):
    """A dense path smoothed (gaussian, `sigma` units) piece by piece between its corners, which stay where they are."""
    from scipy.ndimage import gaussian_filter1d
    cuts = [0] + list(corners) + [len(p) - 1]
    out = p.copy()
    for a, b in zip(cuts, cuts[1:]):
        if b - a < 6: continue
        q = p[a:b + 1]
        sm = np.c_[gaussian_filter1d(q[:, 0], sigma / step, mode="nearest"), gaussian_filter1d(q[:, 1], sigma / step, mode="nearest")]
        w = np.minimum(np.arange(len(q)), np.arange(len(q))[::-1]) / max(1.0, sigma / step * 2)
        w = np.clip(w, 0, 1)[:, None]
        out[a:b + 1] = q * (1 - w) + sm * w
    return out


def i_lower(strokes, k=0, near=4.0, tol=0.1):
    """и (lowercase): between the x-line and the baseline; the lines smoothed (the snapping's shake, the corner where the rise
    met the second stem), its true turns back (the tops) kept sharp."""
    strokes = to_band(strokes)
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    p = _smooth_runs(p, _corners(p, deg=100), sigma=2.5)
    # the left element down to the baseline too (owner: «левый элемент растяни до нижней линии»): heights stretched from the
    # x-line, along the slant, the rise after its bottom following less and less up to half the band
    n = len(p)
    b1 = int(np.argmax(p[: int(n * 0.55), 1]))
    r_end = b1 + int(np.argmax(p[b1:, 1] < tt.X_TOP + 0.5 * (tt.BASE - tt.X_TOP)))
    d = tt.BASE - p[b1, 1]
    wh = np.clip((p[:, 1] - tt.X_TOP) / (p[b1, 1] - tt.X_TOP), 0, 1)
    wi = np.ones(n); wi[b1:] = np.clip(1 - (np.arange(b1, n) - b1) / max(1, r_end - b1), 0, 1)
    wi = 0.5 - 0.5 * np.cos(np.pi * wi)
    dd = d * wh * wi
    p = np.c_[p[:, 0] - dd * tt.SLANT_T, p[:, 1] + dd]
    # and the right element's bottom on it as well, the same height as the left's (owner: «выровнять снизу левый и правый
    # элементы по линии, высота должна быть одинаковая»): from the second stem's top on
    b2 = int(n * 0.55) + int(np.argmax(p[int(n * 0.55):, 1]))
    t2 = r_end + int(np.argmin(p[r_end:b2, 1]))
    d2 = tt.BASE - p[b2, 1]
    w2 = np.zeros(n); w2[t2:] = np.clip((p[t2:, 1] - tt.X_TOP) / (p[b2, 1] - tt.X_TOP), 0, 1)
    p = np.c_[p[:, 0] - d2 * w2 * tt.SLANT_T, p[:, 1] + d2 * w2]
    out = list(strokes)
    out[k] = _fit_corners(p, _corners(p, deg=100), tol=tol)
    return out


def _ends_on_font(p, label, first, last):
    """A dense path's two ends moved to the centres of the font's round pen ends: carried along its own line by how far the font's
    ink goes on past it (or stops short of it), and across onto the font's skeleton there; the move fading out to nothing at the
    path's first turn (index `first`) and from its last (`last`), smoothly."""
    ink, S, pen = _font_frame(label)
    p = p.copy()
    for e, turn in ((0, first), (-1, last)):
        q = p if e == -1 else p[::-1]
        t = turn if e == -1 else len(p) - 1 - first
        end, d = q[-1], tt._unit(q[-1] - q[-8])
        rel = ink - end; along, across = rel @ d, np.abs(rel @ np.array([-d[1], d[0]]))
        m = (across < 4.0) & (along > -15.0)
        T = end + d * (along[m].max() - pen)
        near = S[np.hypot(*(S - T).T) < 2.0 * pen]
        if len(near): T = T + np.array([-d[1], d[0]]) * float(np.mean((near - T) @ np.array([-d[1], d[0]])))
        s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(q[t:], axis=0).T))]); s_ /= s_[-1]
        w = s_ * s_ * (3 - 2 * s_)
        q = q.copy(); q[t:] = q[t:] + w[:, None] * (T - end)
        p = q if e == -1 else q[::-1]
    return p


def l_lower(strokes, k=0, sigma=5.0, tol=0.1, label=None, deg=100):
    """л (lowercase): the snapped stroke in the band, its lines smoothed harder than и's (owner: «линии без виляния»), the top
    turn kept sharp."""
    strokes = to_band(strokes)
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    c = _corners(p, deg=deg)
    for _ in range(2):
        p = _smooth_runs(p, c, sigma=sigma)
    # the smoothing lifts the bottoms (and the font's own tops sit a little apart): every run between a top and a bottom
    # stretched along the slant so the tops lie on the x-line and the bottoms on the baseline; the ends stay free
    from scipy.signal import find_peaks
    top = tt.X_TOP + INK_W * CAP_K / 2   # the tops' ink just touches the x-line, as the font's does (not the pen's centre on it)
    pr = 0.2 * (tt.BASE - tt.X_TOP)
    ext = sorted([(i, tt.BASE) for i in find_peaks(p[:, 1], prominence=pr)[0]] + [(i, top) for i in find_peaks(-p[:, 1], prominence=pr)[0]])
    y, ny = p[:, 1], p[:, 1].copy()
    for (i, yi), (j, yj) in zip(ext, ext[1:]):   # inner runs: one turn to the other, linearly
        ny[i:j + 1] = yi + (y[i:j + 1] - y[i]) * (yj - yi) / (y[j] - y[i])
    for i, yi in ext[:1] + ext[-1:]:             # the end runs: stretched from the x-line so only their turn moves
        r = slice(0, i + 1) if i == ext[0][0] else slice(i, len(p))
        if yi == tt.BASE:
            ny[r] = top + (y[r] - top) * (tt.BASE - top) / (y[i] - top)
        elif 0 < int(np.argmax(y[r])) < len(y[r]) - 1:   # a top whose bottom is too shallow to count as a turn (м's last hook):
            ny[r] = top + (y[r] - y[i]) * (tt.BASE - top) / (y[r].max() - y[i])   # that bottom onto the baseline too
        else:   # a top with just the free end beyond it (н's start): only moved with it
            ny[r] = y[r] + (top - y[i])
    dy = ny - y
    p = np.c_[p[:, 0] - dy * tt.SLANT_T, ny]
    if label:   # the start and the end exactly where the font's start and end are (owner: «точки начала и окончания ... точно по образцу»)
        i0, i1 = ext[0][0], ext[-1][0]   # the move fades out at the bottom next to each end (м's last one too shallow to be in ext)
        if ext[0][1] == top: i0 = int(np.argmax(p[:i0 + 1, 1])) or i0 // 2
        if ext[-1][1] == top: i1 = i1 + int(np.argmax(p[i1:, 1]))
        if i1 == len(p) - 1: i1 = (ext[-1][0] + len(p)) // 2
        p = _ends_on_font(p, label, i0, i1)
    out = list(strokes)
    out[k] = _fit_corners(p, c, tol=tol)
    return out


def n_bar(strokes, k=0, r=2.5, tol=0.1):
    """н (lowercase): from the left stem's bottom back up the same line, then the font's bar flat across at its own height, into
    the right stem going up (the smoothing and the snapping had made the bar a diagonal S). Short rounded turns of `r` units."""
    ink, S, pen = _font_frame("н")
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    from scipy.signal import find_peaks
    pr = 0.2 * (tt.BASE - tt.X_TOP)
    b1 = int(find_peaks(p[:, 1], prominence=pr)[0][0])
    t2 = int([i for i in find_peaks(-p[:, 1], prominence=pr)[0] if i > b1][0])
    # the bar's height and the stems where it meets them
    t1 = int(np.argmin(p[:b1 + 1, 1]))                             # the arch's top
    down = p[t1:b1 + 1]
    lo = down[down[:, 1] > tt.X_TOP + 0.25 * (tt.BASE - tt.X_TOP)]
    sl = np.polyfit(lo[:, 1], lo[:, 0], 1)                        # left stem: x of y
    dn = p[t2:]; dn = dn[: int(np.argmax(dn[:, 1] > tt.X_TOP + 0.6 * (tt.BASE - tt.X_TOP)))]
    sr = np.polyfit(dn[:, 1], dn[:, 0], 1)                        # right stem: its way down from the top, the way up the same line
    ym = 0.5 * (tt.X_TOP + tt.BASE)
    xm = 0.5 * (np.polyval(sl, ym) + np.polyval(sr, ym))
    col = S[(np.abs(S[:, 0] - xm) < 1.5) & (S[:, 1] > tt.X_TOP + 0.3 * (tt.BASE - tt.X_TOP)) & (S[:, 1] < tt.BASE - 0.2 * (tt.BASE - tt.X_TOP))]
    yb = float(np.median(col[:, 1]))   # the font's bar: its skeleton halfway between the stems
    xl, xr = np.polyval(sl, yb), np.polyval(sr, yb)
    # left: up the stem to r below the bar; the turn; the bar; the turn into the right stem, r above the bar
    a = np.array([np.polyval(sl, yb + r), yb + r]); ta = tt._unit(np.array([np.polyval(sl, yb) - a[0], -r]))
    b = np.array([xl + r, yb]); c = np.array([xr - r, yb])
    pj = np.array([np.polyval(sr, yb - r), yb - r]); tj = tt._unit(p[t2] - pj)
    rise = np.linspace(pj, p[t2], 40)
    h = 0.55 * r
    def cub(P0, T0, P3, T3, n=20):
        P1, P2 = P0 + T0 * h, P3 - T3 * h
        u = np.linspace(0, 1, n)[:, None]
        return (1 - u) ** 3 * P0 + 3 * (1 - u) ** 2 * u * P1 + 3 * (1 - u) * u ** 2 * P2 + u ** 3 * P3
    stem_up = down[down[:, 1] >= yb + r][::-1]
    stem_up = stem_up[np.argsort(-stem_up[:, 1])]
    stem_up = np.vstack([np.c_[np.polyval(sl, stem_up[:, 1]), stem_up[:, 1]], a])
    mid = np.vstack([stem_up, cub(a, ta, b, np.array([1.0, 0]))[1:], np.linspace(b, c, 20)[1:], cub(c, np.array([1.0, 0]), pj, tj)[1:], rise[1:]])
    q = np.vstack([p[:b1 + 1], dg.resample(mid, 0.3)[1:], p[t2 + 1:]])
    q = dg.resample(q, 0.3)
    out = list(strokes)
    out[k] = _fit_corners(q, _corners(q, deg=100), tol=tol)
    return out


def n_three(strokes, k=0, tol=0.1):
    """н (lowercase) as the Bulgarians write it, with lifts (owner, 2026-10-20): к's left element exactly, on н's left stem; the
    bar flat across at the font's height, from stem to stem; then that same left element turned upside down and facing right
    (turned through 180°), drawn from the top: down the right stem and the hook up to the exit."""
    from scipy.signal import find_peaks
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    _, S, _ = _font_frame("н")
    pr = 0.2 * (tt.BASE - tt.X_TOP)
    b1 = int(find_peaks(p[:, 1], prominence=pr)[0][0])
    t1 = int(np.argmin(p[:b1 + 1, 1]))
    t2 = int([i for i in find_peaks(-p[:, 1], prominence=pr)[0] if i > b1][0])
    def stem(q):   # x of y along a stem's line, from its lower three quarters
        q = q[q[:, 1] > tt.X_TOP + 0.25 * (tt.BASE - tt.X_TOP)]
        return np.polyfit(q[:, 1], q[:, 0], 1)
    sl = stem(p[t1:b1 + 1])
    dn = p[t2:]; dn = dn[: int(np.argmax(dn[:, 1] > tt.X_TOP + 0.6 * (tt.BASE - tt.X_TOP)))]
    sr = np.polyfit(dn[:, 1], dn[:, 0], 1)
    ym = 0.5 * (tt.X_TOP + tt.BASE)
    xm = 0.5 * (np.polyval(sl, ym) + np.polyval(sr, ym))
    col = S[(np.abs(S[:, 0] - xm) < 1.5) & (S[:, 1] > tt.X_TOP + 0.3 * (tt.BASE - tt.X_TOP)) & (S[:, 1] < tt.BASE - 0.2 * (tt.BASE - tt.X_TOP))]
    yb = float(np.median(col[:, 1]))   # the font's bar: its skeleton halfway between the stems
    # 1: к's left element, its stem onto н's
    K = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["к"][0]))), 0.3)
    kt = int(np.argmin(K[:, 1]))
    left = K + np.array([np.polyval(sl, ym) - np.polyval(stem(K[kt:]), ym), 0.0])
    # 2: the bar, stem to stem
    bar = np.linspace([np.polyval(sl, yb), yb], [np.polyval(sr, yb), yb], 40)
    # 3: the left element through 180°, drawn from the top; its bottom on the baseline, its stem on н's right stem
    R = (-left)[::-1]
    R = R + np.array([0.0, tt.BASE - R[:, 1].max()])
    rb = int(np.argmax(R[:, 1]))
    R = R + np.array([np.polyval(sr, ym) - np.polyval(stem(R[:rb + 1]), ym), 0.0])
    return [_fit_corners(q, _corners(q, deg=100), tol=tol) for q in (left, bar, R)]


def p_lower(strokes, k=0, tol=0.1, low=0.25):
    """п (lowercase): н's left element exactly, on п's left stem; from its bottom back up the same stem to where the font's
    second arch leaves it, along that line a round arch over (its ink just touching the x-line) into the right stem `low` of the band down, and
    from there н's right element (its stem and its exit hook) on п's right stem. One stroke, as the font's."""
    from scipy.signal import find_peaks
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    band = tt.BASE - tt.X_TOP
    pr = 0.2 * band
    b1 = int(find_peaks(p[:, 1], prominence=pr)[0][0])
    t1 = int(np.argmin(p[:b1 + 1, 1]))
    t2 = int([i for i in find_peaks(-p[:, 1], prominence=pr)[0] if i > b1][0])
    def stem(q):
        q = q[q[:, 1] > tt.X_TOP + 0.25 * band]
        return np.polyfit(q[:, 1], q[:, 0], 1)
    sl = stem(p[t1:b1 + 1])
    dn = p[t2:]; dn = dn[: int(np.argmax(dn[:, 1] > tt.X_TOP + 0.6 * band))]
    sr = np.polyfit(dn[:, 1], dn[:, 0], 1)
    # where the way back up leaves the left stem
    _, S, _ = _font_frame("п")
    off = S[:, 0] - np.polyval(sl, S[:, 1])
    # the font's arch leaves the stem as a straight line up to the right: that line (its skeleton 2 to 7 units off the stem)
    # carried down to the stem
    br = S[(off > 2.0) & (off < 7.0) & (S[:, 1] > tt.X_TOP + 0.1 * band) & (S[:, 1] < tt.BASE - 0.3 * band)]
    cb = np.polyfit(br[:, 1], br[:, 0] - np.polyval(sl, br[:, 1]), 1)   # off = cb[0] y + cb[1]
    yb = float(-cb[1] / cb[0])
    tb = tt._unit(np.array([np.polyval(sl, yb - 1) + np.polyval(cb, yb - 1) - np.polyval(sl, yb), -1.0]))
    ym = 0.5 * (tt.X_TOP + tt.BASE)
    L = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["н"][0]))), 0.3)
    lt = int(np.argmin(L[:, 1]))
    L = L + np.array([np.polyval(sl, ym) - np.polyval(stem(L[lt:]), ym), 0.0])
    R = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["н"][2]))), 0.3)
    rb = int(np.argmax(R[:, 1]))
    R = R + np.array([np.polyval(sr, ym) - np.polyval(stem(R[:rb + 1]), ym), 0.0])
    # back up the left stem (its own line) to yb
    bot = L[-1]
    climb = np.linspace(bot, [np.polyval(sl, yb), yb], 60)
    # into R where it is `low` of the band down
    yr = tt.X_TOP + low * band
    j = int(np.argmax(R[:, 1] >= yr))
    P0, P3 = climb[-1], R[j]
    T0 = tb; T3 = tt._unit(R[j + 5] - R[j])
    top = tt.X_TOP + INK_W * CAP_K / 2
    def arch(h):
        u = np.linspace(0, 1, 200)[:, None]
        P1, P2 = P0 + T0 * h, P3 - T3 * h
        return (1 - u) ** 3 * P0 + 3 * (1 - u) ** 2 * u * P1 + 3 * (1 - u) * u ** 2 * P2 + u ** 3 * P3
    lo, hi = 0.1, 60.0
    for _ in range(50):
        h = 0.5 * (lo + hi)
        if arch(h)[:, 1].min() > top: lo = h
        else: hi = h
    q = dg.resample(np.vstack([L, climb[1:], arch(0.5 * (lo + hi))[1:], R[j + 1:]]), 0.3)
    out = list(strokes)
    out[k] = _fit_corners(q, _corners(q, deg=100), tol=tol)
    return out


def p_from_g(strokes, k=0, tol=0.1, label="п"):
    """п, р (lowercase) as the Bulgarians write them (owner, 2026-10-20: «первый крючок, потом отрыв, а потом буква Г»): н's left
    element on п's left stem, a lift, then the finished г exactly, its stem on п's right stem; its start then falls on the left
    stem where the font's arch leaves it."""
    from scipy.signal import find_peaks
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    band = tt.BASE - tt.X_TOP
    pr = 0.2 * band
    b1 = int(find_peaks(p[:, 1], prominence=pr)[0][0])
    t1 = int(np.argmin(p[:b1 + 1, 1]))
    t2 = int([i for i in find_peaks(-p[:, 1], prominence=pr)[0] if i > b1][0])
    def stem(q):
        q = q[q[:, 1] > tt.X_TOP + 0.25 * band]
        return np.polyfit(q[:, 1], q[:, 0], 1)
    sl = stem(p[t1:b1 + 1])
    dn = p[t2:]; dn = dn[: int(np.argmax(dn[:, 1] > tt.X_TOP + 0.6 * band))]
    sr = np.polyfit(dn[:, 1], dn[:, 0], 1)
    ym = 0.5 * (tt.X_TOP + tt.BASE)
    L = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["н"][0]))), 0.3)
    lt = int(np.argmin(L[:, 1]))
    L = L + np.array([np.polyval(sl, ym) - np.polyval(stem(L[lt:]), ym), 0.0])
    if label == "р":
        # р's left element is not н's: a rise to a sharp top, as the font's (owner, 2026-10-20: «верхний крючок под острым
        # углом, не плавный, как у п»), then the stem straight down its line to where the font's long stem ends («продли вниз»)
        _, S, _ = _font_frame("р")
        ye = float(S[:, 1].max())
        rise = p[:t1 + 1].copy()
        if len(rise) > 12: rise = _smooth_runs(rise, [], sigma=2.0)
        top = np.array([np.polyval(sl, tt.X_TOP + INK_W * CAP_K / 2), tt.X_TOP + INK_W * CAP_K / 2])
        v = np.linspace(0, 1, len(rise))[:, None]; v = v * v * (3 - 2 * v)
        rise = rise + v * (top - rise[-1])
        L = np.vstack([rise, np.linspace(top, [np.polyval(sl, ye), ye], 200)[1:]])
    G = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["г"][0]))), 0.3)
    gt = int(np.argmin(G[:, 1]))
    G = _turned_to_slant(G, gt)
    gb = gt + int(np.argmax(G[gt:, 1]))
    G = G + np.array([np.polyval(sr, ym) - np.polyval(stem(G[gt:gb + 1]), ym), 0.0])
    # its start exactly on the left stem: the lead-in eased across, nothing moved from its top on
    dy = ym - G[0, 1]                                          # at the middle of the band (the turn moved it a little)
    dx = np.polyval(sl, ym) - G[0, 0]
    w = np.clip(1 - np.arange(len(G)) / max(1, gt), 0, 1); w = w * w * (3 - 2 * w)
    G = G + np.c_[dx * w, dy * w]
    return [_fit_corners(q, _corners(q, deg=100), tol=tol) for q in (L, G)]


def t_lower(strokes, k=0, tol=0.1):
    """т (lowercase) as п, with one element more: н's left element on the first stem; a lift; the same element again, its stem on
    the second stem and its start eased onto the first; a lift; the finished г, its stem on the third stem and its start on the
    second (the stems: the font's, from the snapped pen path)."""
    from scipy.signal import find_peaks
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    band = tt.BASE - tt.X_TOP
    pr = 0.2 * band
    bs = [int(i) for i in find_peaks(p[:, 1], prominence=pr)[0]]
    ts = [int(i) for i in find_peaks(-p[:, 1], prominence=pr)[0]]
    def stem(q):
        q = q[q[:, 1] > tt.X_TOP + 0.25 * band]
        return np.polyfit(q[:, 1], q[:, 0], 1)
    def stem_down(i):   # from top i on down to 60% of the band
        dn = p[i:]; dn = dn[: int(np.argmax(dn[:, 1] > tt.X_TOP + 0.6 * band))]
        return np.polyfit(dn[:, 1], dn[:, 0], 1)
    t1 = int(np.argmin(p[:bs[0] + 1, 1]))
    s1 = stem(p[t1:bs[0] + 1])
    t2 = [i for i in ts if bs[0] < i < bs[1]][0]; s2 = stem(p[t2:bs[1] + 1])
    t3 = [i for i in ts if i > bs[1]][0]; s3 = stem_down(t3)
    ym = 0.5 * (tt.X_TOP + tt.BASE)
    # the three stems equally far apart (owner, 2026-10-20): the last one moved left to where the step from the first to the
    # second puts it; its element then starts later on the second stem
    s3 = s3.copy(); s3[1] += 2 * np.polyval(s2, ym) - np.polyval(s1, ym) - np.polyval(s3, ym)
    def on(q, top_i, s_stem, s_start=None):
        b_ = top_i + int(np.argmax(q[top_i:, 1]))
        q = q + np.array([np.polyval(s_stem, ym) - np.polyval(stem(q[top_i:b_ + 1]), ym), 0.0])
        if s_start is not None:   # the start on the stem before it, at the middle of the band
            dx = np.polyval(s_start, ym) - q[0, 0]; dy = ym - q[0, 1]
            w = np.clip(1 - np.arange(len(q)) / max(1, top_i), 0, 1); w = w * w * (3 - 2 * w)
            q = q + np.c_[dx * w, dy * w]
        return q
    L = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["н"][0]))), 0.3); lt = int(np.argmin(L[:, 1]))
    G = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["г"][0]))), 0.3); gt = int(np.argmin(G[:, 1])); G = _turned_to_slant(G, gt)
    parts = [on(L, lt, s1), on(L, lt, s2, s1), on(G, gt, s3, s2)]
    return [_fit_corners(q, _corners(q, deg=100), tol=tol) for q in parts]


def u_lower(strokes, k=0, tol=0.1):
    """у (lowercase): the snapped pen path smoothed; the arch's top and the stem's top with their ink just touching the x-line, the
    left bottom on the baseline (as и); the stem from its top straight on the slant down into the loop, whose bottom stays the
    font's; the way back up out of the loop is the exit (mid_joins puts it through the middle at JOIN_DEG)."""
    from scipy.signal import find_peaks
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    p = _smooth_runs(p, _corners(p, deg=100), sigma=2.5)
    band = tt.BASE - tt.X_TOP
    top = tt.X_TOP + INK_W * CAP_K / 2
    pr = 0.2 * band
    b1 = int(find_peaks(p[:, 1], prominence=pr)[0][0])
    t1 = int(np.argmin(p[:b1 + 1, 1]))
    t2 = b1 + int(np.argmin(p[b1:, 1]))
    bd = t2 + int(np.argmax(p[t2:, 1]))                       # the loop's bottom
    y, ny = p[:, 1], p[:, 1].copy()
    ny[:t1 + 1] = y[:t1 + 1] + (top - y[t1])
    for (i, yi), (j, yj) in (((t1, top), (b1, tt.BASE)), ((b1, tt.BASE), (t2, top)), ((t2, top), (bd, y[bd]))):
        ny[i:j + 1] = yi + (y[i:j + 1] - y[i]) * (yj - yi) / (y[j] - y[i])
    p = np.c_[p[:, 0] - (ny - y) * tt.SLANT_T, ny]
    # the stem on the slant line that fits it best, eased in below the top and out above the loop's bottom
    st = p[t2:bd + 1]
    lo, hi = top + 0.15 * band, tt.BASE + 0.5 * (p[bd, 1] - tt.BASE)
    sel = st[(st[:, 1] > lo) & (st[:, 1] < hi)]
    ym = 0.5 * (lo + hi)
    xm = float(np.mean(sel[:, 0] + (sel[:, 1] - ym) * tt.SLANT_T))
    q = p[t2:bd + 1]
    def ramp(v): v = np.clip(v, 0, 1); return v * v * (3 - 2 * v)
    w = ramp((q[:, 1] - top) / (0.15 * band)) * ramp((p[bd, 1] - q[:, 1]) / (0.35 * (p[bd, 1] - tt.BASE)))
    q[:, 0] += w * (xm + (ym - q[:, 1]) * tt.SLANT_T - q[:, 0])
    p[t2:bd + 1] = q
    out = list(strokes)
    out[k] = _fit_corners(p, _corners(p, deg=100), tol=tol)
    return out


def f_lower(strokes, k=0, tol=0.1):
    """ф (lowercase) as the Bulgarians write it (owner, 2026-10-20): an о on the left, its right side touching the stem; a lift; the
    stem straight on the slant from the font's top down to the font's descender end; a lift; the same о mirrored across the stem
    (so written the other way round), its left side touching the stem."""
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    out_band = p[(p[:, 1] < tt.X_TOP - 3) | (p[:, 1] > tt.BASE + 3)]
    c = float(np.median(tt.upright(out_band)[:, 0]))               # upright x of the stem (the slant line nearest the font's)
    y0, y1 = p[:, 1].min(), p[:, 1].max()
    ys = np.linspace(y0, y1, 400)
    stem = tt.from_upright(np.c_[np.full(len(ys), c), ys])
    O = dg.resample(np.array(tt.parse_path(dg.fmt(PAPER["о"][0]))), 0.3)
    U = tt.upright(O); U[:, 0] += c - U[:, 0].max()                 # its right side on the stem
    left = tt.from_upright(U)
    right = tt.from_upright(np.c_[2 * c - U[:, 0], U[:, 1]])
    return [_fit_corners(r, [], tol=tol) for r in (left, stem, right)]


def i_breve_lower(strokes, gap=INK_W * CAP_K / 2):
    """й (lowercase): exactly и, and the font's breve over it, its middle across the slant halfway between и's two tops, its
    bottom `gap` over the x-line: half the deck's pen, so its ink just touches the line (owner, 2026-10-20: «краткая должна лежать
    на линии ... слишком низко, должна просто касаться линии»; its middle as Й's: «точно посередине между двумя наклонными»)."""
    I = [list(c) for c in PAPER["и"]]
    q = tt.upright(dg.resample(np.array(tt.parse_path(dg.fmt(I[0]))), 0.3))
    n = len(q)
    t1 = q[int(np.argmin(q[: n // 2, 1]))]
    t2 = q[n // 2 + int(np.argmin(q[n // 2:, 1]))]
    mid = (t1[0] + t2[0]) / 2
    # the breve exactly as the font draws it (its own centre line, not the tidied one: «не такой сильный прогиб, сделай точно
    # по шрифту»)
    raw = dg.resample(np.asarray(font_stencil(PAPER_LABEL[0])[-1], float), 0.3)
    b = tt.upright(raw)
    dx = mid - (b[:, 0].min() + b[:, 0].max()) / 2
    dy = (tt.X_TOP - gap) - b[:, 1].max()
    q = tt.from_upright(b + [dx, dy])
    br = [("M", [q[0]])] + tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=0.1)
    PAPER_UNSNAPPED.pop(PAPER_LABEL[0], None)
    return I + [br]


def k_lower(strokes, tol=0.1):
    """к (lowercase), as the owner traced it (2026-10-20, two strokes: the hook and stem; from the top right curl down into the
    stem, a little turn back up, down and out), on the font's lines: smoothed of the snapping's shake (its corners kept), the
    second stroke's bottom down on the baseline as the stem's."""
    out = []
    for n, cmds in enumerate(strokes):
        p = dg.resample(np.array(tt.parse_path(dg.fmt(cmds))), 0.3)
        cs = _corners(p, deg=100)
        p = _smooth_runs(p, cs, sigma=2.0)
        if n == 1 and cs:
            c = cs[-1]                                   # the turn back at the stem
            b = c + int(np.argmax(p[c:, 1]))
            d = tt.BASE - p[b, 1]
            w = np.zeros(len(p)); top = p[c:, 1].min()
            w[c:] = np.clip((p[c:, 1] - top) / max(1e-6, p[b, 1] - top), 0, 1)
            p = np.c_[p[:, 0] - d * w * tt.SLANT_T, p[:, 1] + d * w]
        out.append(_fit_corners(p, _corners(p, deg=100), tol=tol))
    return out


def k_three(strokes, tol=0.1, back=12.0):
    """к in three strokes (owner, 2026-10-20: «левый элемент ок; сделаем из трёх штрихов: второй — крюк сверху идёт к нижней
    точке левого; потом отрыв, и вымеряй последний штрих — нижний крюк»): the left element as it is; from the top right curl
    down the diagonal, straight on to the stem's bottom point; a lift; the lower hook as the font has it, from the top of its
    little turn on the diagonal down to the baseline and out."""
    A = strokes[0]
    B = np.array(tt.parse_path(dg.fmt(A)))[-1]                       # the stem's bottom point
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[1]))), 0.3)
    c = [i for i in _corners(p, deg=100)][-1]                          # where the diagonal turned back at the stem
    s_ = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    m = int(np.argmin(np.abs(s_ - (s_[c] - back))))
    t = np.linspace(0, 1, 40)[1:, None]
    tm = tt._unit(p[m] - p[m - 5]); L = np.hypot(*(B - p[m]))
    tail = (1 - t) ** 3 * p[m] + 3 * (1 - t) ** 2 * t * (p[m] + tm * L / 3) + 3 * (1 - t) * t ** 2 * (B - tt._unit(B - p[m]) * L / 3) + t ** 3 * B
    d = np.vstack([p[:m + 1], tail])
    h0 = c + int(np.argmin(p[c:c + int(20 / 0.3), 1]))                # the top of the little turn: the hook starts here
    h = p[h0:]
    # the hook measured on the font (its skeleton): from where it leaves the diagonal, down its own column between the diagonal
    # and the way out, into the bottom and out as the snapped trace has it
    ink, S, pen = _font_frame("к")
    def dx_at(q, y):
        xs = [q[i, 0] + (q[i + 1, 0] - q[i, 0]) * (y - q[i, 1]) / (q[i + 1, 1] - q[i, 1]) for i in range(len(q) - 1) if (q[i, 1] - y) * (q[i + 1, 1] - y) <= 0 and q[i, 1] != q[i + 1, 1]]
        return xs
    col = []
    for y in np.arange(tt.X_TOP + 20, tt.BASE - 4, 0.5):
        xd = min(dx_at(d, y), key=lambda x: x)            # the diagonal at this height
        xs = S[np.abs(S[:, 1] - y) < 0.3, 0]
        xs = xs[(xs > xd + 1.5) & (xs < xd + 12)]
        if len(xs): col.append((y, float(np.median(xs)), xd))
    col = np.array(col)
    j0 = int(np.argmin(col[:, 1] - col[:, 2]))           # where the hook is closest to the diagonal: it leaves it there
    j0 = max(j0, int(np.argmax(col[:, 1] - col[:, 2] > 0)))
    # straight down from where it starts (owner: «он идёт сразу вниз из точки начала»): one line from where it leaves the
    # diagonal to the lower end of the font's column
    # as the owner drew it (2026-10-20, over the review sheet): from the diagonal at 43 units down, a straight line 14.8 down and
    # 2.8 across (nearly the slant), then one smooth curve into the bottom and out as the snapped trace has it
    xs0 = dx_at(d, 43.0)
    start = np.array([min(xs0), 43.0])
    mid_ = start + np.array([2.8, 14.8])
    line = np.array([start + (mid_ - start) * t for t in np.linspace(0, 1, 50)])[1:]
    lo = int(np.argmax(h[:, 1]))
    k = min(len(h) - 5, lo + int(4 / 0.3))                     # a little past the bottom
    end = h[k]; tE = tt._unit(h[k + 4] - h[k]); tM = tt._unit(mid_ - start)
    L = np.hypot(*(end - mid_))
    t = np.linspace(0, 1, 50)[1:-1, None]
    curve = (1 - t) ** 3 * mid_ + 3 * (1 - t) ** 2 * t * (mid_ + tM * L * 0.5) + 3 * (1 - t) * t ** 2 * (end - tE * L * 0.4) + t ** 3 * end
    column = np.vstack([line, curve, end])
    hk = np.vstack([start, column, h[k + 1:]])
    hk = dg.resample(_smooth_runs(dg.resample(hk, 0.3), [], sigma=1.2), 0.3)
    h = hk
    fit = lambda q: _fit_corners(q, _corners(q, deg=100), tol=tol)
    return [A, fit(d), fit(h)]


def stem_down(strokes, k=0, cut=24.0):
    """Ф through all three bands (owner, 2026-10-19, after the teacher's video: «растяни Ф на три полосы»; svetlinki.com: «Главната
    Ф — и в двата широки реда»): stroke `k`'s stem cut `cut` units above the baseline (on its straight run, over the hook) and
    the rest moved down along the slant until the hook's bottom stands on the bottom line of the deck's paper (its place on
    DESIGN's paper that rescaled() moves there); a line along the slant fills the gap. The flag and the ears stay."""
    deck = json.loads(VARIANT.read_text())["meta"]["script"]
    fy, _, _ = frame_map(PAPER_LABEL[0], DESIGN, deck)
    tt.use_script(DESIGN)
    a, b = tt.BASE, tt.BASE + 200.0  # the height on DESIGN's paper that rescaled() puts on the deck's bottom line
    for _ in range(60):
        m = (a + b) / 2
        if fy(m) < tt.BASE + tt.R_BAND * deck["lower"]: a = m
        else: b = m
    low = (a + b) / 2
    allp = np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes])
    d = low - allp[:, 1].max()
    cmds = tt._split_at(strokes[k], [tt.BASE - cut])
    i = next(i for i, (_, ps) in enumerate(cmds) if abs(ps[-1][1] - (tt.BASE - cut)) < 1e-6)
    at, shift = np.asarray(cmds[i][1][-1], float), np.array([-d * tt.SLANT_T, d])
    rest = [(c, [np.asarray(q, float) + shift for q in ps]) for c, ps in cmds[i + 1:]]
    return strokes[:k] + [cmds[:i + 1] + [("L", [at + shift])] + rest] + strokes[k + 1:]


def cusp_to_font_tip(strokes, label, k=0, back=16.0, tol=0.1):
    """A waist that turns back to a point (З, like Е: two arcs meeting at a point, not a loop or a bulge) drawn into the tip of the
    font's (the centre of the pen's round end there). snap_to_font rounds such a turn (the sides' normals flip there), so the path
    from `back` units before the turn to `back` units after it is replaced: a cubic from the upper arc straight into the tip, a
    corner, a cubic out of it into the lower arc."""
    ink, S, pen = _font_frame(label)
    p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    mid = (p[:, 1] > tt.CAP_TOP + 25) & (p[:, 1] < tt.BASE - 25)
    c = int(np.nonzero(mid)[0][np.argmin(p[mid, 0])])  # the waist: the leftmost point in the middle of the letter
    band = ink[np.abs(ink[:, 1] - p[c, 1]) < 8]
    x_ink = band[:, 0].min()
    at = band[np.abs(band[:, 0] - (x_ink + pen)) < 1.0]
    T = np.array([x_ink + pen, (at[:, 1].max() + at[:, 1].min()) / 2])
    a = int(np.argmin(np.abs(s_ - (s_[c] - back)))); b = int(np.argmin(np.abs(s_ - (s_[c] + back))))
    A, B = p[a], p[b]
    tA, tB = tt._unit(p[a] - p[a - 3]), tt._unit(p[b + 3] - p[b])
    def hermite(P0, T0, P1, T1, n=60):
        L = np.hypot(*(P1 - P0)); u = np.linspace(0, 1, n)[:, None]
        return (2*u**3 - 3*u**2 + 1) * P0 + (u**3 - 2*u**2 + u) * L * T0 + (-2*u**3 + 3*u**2) * P1 + (u**3 - u**2) * L * T1
    upper = np.vstack([p[:a], hermite(A, tA, T, tt._unit(T - A))])
    lower = np.vstack([hermite(T, tt._unit(B - T), B, tB), p[b + 1:]])
    def fit(q): return tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    strokes[k] = [("M", [upper[0]])] + fit(upper) + fit(lower)
    return strokes


def ends_to_font(strokes, label, which=((0, 0),), tol=0.1):
    """A stroke's end carried on along the font's line to where the font's stroke ends (the centre of the pen's round end): the
    hand stopped short of it (snap_to_font moves across, never along). `which`: (stroke, 0 for its start / -1 for its end)."""
    ink, S, pen = _font_frame(label)
    for k, e in which:
        p = dg.resample(np.array(tt.parse_path(dg.fmt(strokes[k]))), 0.3)
        if e == 0: p = p[::-1]
        d = tt._unit(p[-1] - p[-8])
        L = _reach(ink, p[-1], d, pen)
        if L <= 0.3: continue
        # the skeleton beyond the end, in order along it
        rel = S - p[-1]; along = rel @ d; across = np.abs(rel @ np.array([-d[1], d[0]]))
        m = (along > 0) & (along < L + 1.0) & (across < 3.0)
        ext = S[m][np.argsort(along[m])]
        if len(ext) < 3: continue
        ext = dg.resample(np.vstack([p[-1], ext]), 0.3)
        ext = ext[np.concatenate([[0], np.cumsum(np.hypot(*np.diff(ext, axis=0).T))]) <= L]
        q = np.vstack([p, ext[1:]])
        sm = q.copy()
        for _ in range(6): sm[1:-1] = (sm[:-2] + 2 * sm[1:-1] + sm[2:]) / 4  # the raster steps out, the shape kept
        q[len(p) - 10:] = sm[len(p) - 10:]
        if e == 0: q = q[::-1]
        strokes[k] = [("M", [q[0]])] + tt._fit_span(q, tt._unit(q[3] - q[0]), tt._unit(q[-1] - q[-4]), tol=tol)
    return strokes


DEEPEN = {"П:2": 3.0}  # a whole stroke's flat run along the top sagged this much more in the middle (paper units)
FONT_FLAG = set("КНФЮЪ")  # letters whose top-left flag is the font's own (font_flag, exact from font_flags.json)
# SPLIT: the font's pen path cut at its turns back (_turns) into separate strokes: (first, last) piece of each stroke, the rest left
# out. Х's walk went down the left half to the end of its hook, back up over it to the top of the right half, and back down that;
# the returns drew double lines (owner, 2026-10-19). Kept: the left half, then the right half from its top through the crossing to
# the exit. Ю, Н: the stem with its hook, then from the stem (where the walk leaves it again) the rest; the way back up the stem
# drew it twice (the stem tidied onto the slant, the way up keeping its own angle).
SPLIT = {"Х": [(0, 0), (2, 2)], "Н": [(0, 0), (1, 2)]}
# SPURS: letters whose walk runs out along a short dead end and back (two turns back close together); the dead end is cut. Ю: a
# tick past the bar's join with the oval (owner, 2026-10-19: «лишняя чёрточка у перекладины»).
SPURS = set()  # Ю: from Н and О now (yu_from_parts), not from the font pen path
# NO_EXIT: nothing joins after these, whatever _exit_flags finds: Ю's oval ends back at its bar, inside the letter, as О's does
# (О gets noExit by itself; Ю's end lies a hair right of the letter's middle, and «Юла» joined from the bar into the oval)
NO_EXIT = set("ФЮ")  # Ф: its hook ends to the left, under the letter; Ю: its oval ends back at the bar: nothing joins after them


# SHAPES: a letter's own correction on paper after the tidying (tidy_trace.tidy_letter adjust)
SHAPES = {"А": lambda s: rise_like_font(hooks_like_font(s)), "Д": lambda s: snap_to_font(s, "Д"), "И": lambda s: ends_to_font(rise_into_stem(snap_to_font(s, "И")), "И", which=((0, 0), (0, -1))),
          "Й": short_i, "З": lambda s: ends_to_font(cusp_to_font_tip(snap_to_font(s, "З"), "З"), "З", which=((0, 0), (0, -1))), "Ж": lambda s: zigzag_right(zigzag_middle(snap_to_font(s, "Ж", arcs=(0,)))), "Е": lambda s: waist_cusp(snap_to_font(s, "Е")), "Б": lambda s: flat_hat_to_font_end(snap_to_font(s, "Б"), "Б"), "В": lambda s: snap_to_font(oval_lower_bowl(s), "В"), "Г": lambda s: flat_hat_to_font_end(snap_to_font(both(stem_like("Б"), hat_like("Б"))(s), "Г"), "Г"), "Л": lambda s: rise_like_font(hooks_like_font(stem_on_font(spread_like_font(s), "Л"), "Л"), "Л"), "М": from_font, "П": reversed_strokes, "Ф": lambda s: stem_down(mirror_ear(ears_on_baseline(ef_three(flag_corner(s))))), "Т": reversed_strokes, "С": lambda s: snap_to_font(s, "С", arcs=(0,)), "Х": lambda s: smooth_middle(snap_to_font(s, "Х", arcs=(0, 1))), "Ц": lambda s: i_with_loop(snap_to_font(s, "Ц", arcs=(0,))), "Ч": lambda s: snap_to_font(s, "Ч", arcs=(0,)), "Ш": lambda s: stems_to_font(i_doubled(s), "Ш"), "Ю": yu_from_parts, "л": lambda s: l_lower(snap_to_font(s, "л", arcs=(0,)), label="л"),  "м": lambda s: l_lower(snap_to_font(s, "м", arcs=(0,)), label="м"),  "п": lambda s: p_from_g(snap_to_font(s, "п", arcs=(0,))),  "р": lambda s: p_from_g(snap_to_font(s, "р", arcs=(0,)), label="р"),  "ф": lambda s: f_lower(snap_to_font(s, "ф", arcs=(0,))),  "у": lambda s: u_lower(snap_to_font(s, "у", arcs=(0,))),  "т": lambda s: t_lower(snap_to_font(s, "т", arcs=(0,))),  "с": lambda s: smooth_in_band(snap_to_font(s, "с", arcs=(0,))),  "о": lambda s: o_lower(snap_to_font(s, "о", arcs=(0,))),  "н": lambda s: n_three(l_lower(snap_to_font(s, "н", arcs=(0,)), label="н")), "к": lambda s: k_three(k_lower(snap_to_font(s, "к", arcs=(0, 1)))),  "й": i_breve_lower, "и": lambda s: i_lower(snap_to_font(s, "и", arcs=(0,))), "з": lambda s: desc_to_line(waist_to_font_tip(snap_to_font(s, "з", arcs=(0,)), "з")), "ж": lambda s: zh_lower(snap_to_font(s, "ж", arcs=(0,))), "е": lambda s: snap_to_font(s, "е", arcs=(0,)), "д": lambda s: oval_on_stem(snap_to_font(s, "д", arcs=(0,))), "г": lambda s: down_to_base(snap_to_font(s, "г", arcs=(0,))), "в": lambda s: bowl_oval(snap_to_font(s, "в", arcs=(0,))), "б": lambda s: perfect_oval(snap_to_font(s, "б", arcs=(0,))), "Я": lambda s: ya_lift(snap_to_font(s, "Я", arcs=(0,))), "Щ": lambda s: i_with_loop(snap_to_font(s, "Щ", arcs=(0,)), "Ш"), "Р": lambda s: [s[0]] + snap_to_font([list(c) for c in s], "Р", plain=True)[1:], "О": lambda s: oval_start(close_smooth(snap_to_font(s, "О"))), "Н": lambda s: ends_to_font(flag_corner(snap_to_font(s, "Н", plain=True)), "Н", which=((0, -1), (1, -1))), "К": lambda s: touch_stem(end_like_font(flag_corner(ends_to_font(snap_to_font([font_flag(s[0], "К")] + s[1:], "К"), "К", which=((0, -1), (1, -1)))), "К", 1, 0)),
          # П: the font's own hat after all (owner, 2026-10-19, drawn over the font: it runs on along the top line to the font's end;
          # hat_like("Б") + hat_to_stem were the step before)
          }  # П: its stems as the font draws them, Б's hat over them (owner, 2026-10-19)


PAPER_LABEL = [None]  # the letter being tidied (a SHAPES function reads it)


def tidy(label, raw, script):
    """The tidied letter (bank commands, paper commands), its SHAPES correction applied; remembered in PAPER."""
    PAPER_LABEL[0] = label
    bank, paper = tt.tidy_letter(raw, label.isupper(), script, loops=label in LOOPS, adjust=SHAPES.get(label))
    PAPER[label] = paper
    return bank, paper


def underlay_glyph(item, script):
    label = item["label"]
    dg.DY = 0.0
    raw = [np.array([dg.xform(p, 2.0, 0.0) for p in tt.parse_path(st["d"])]) for st in item["strokes"]]
    paths, _ = tidy(label, raw, script)
    out = {"label": label, "kind": "letter", "strokes": [{"d": dg.fmt(c)} for c in paths], "stretch": 1.806, "noOverrides": True,
           "repeatCells": 6 if label.isupper() else 4, "sourceLabel": f"{label} (обведена по подложке Boyan Maga, подровнена на болгарской линовке)"}
    if label.isupper(): out["ascender"] = True; out["noNormalize"] = True
    if label in "дзруфцщФ": out["descender"] = True
    _exit_flags(out)
    return out


def _exit_flags(out):
    """The stroke the next letter joins from is the one ending furthest right (the engine's own choice, wordEngine.js); when it ends
    on the letter's left side (Б, В, Д: the pen comes back inside the letter) nothing joins after it (a stroke ending up in the
    capital's zone is a flag, Б Г: never the one to join from)."""
    ends = [tt.parse_path(st["d"])[-1] for st in out["strokes"]]
    low = [k for k, e in enumerate(ends) if e[1] >= tt.B_TOP - 6]
    allx = np.array([q[0] for st in out["strokes"] for q in tt.parse_path(st["d"])])
    main = max(low, key=lambda k: ends[k][0]) if low else None
    if main is None or ends[main][0] < (allx.min() + allx.max()) / 2: out["noExit"] = True
    elif main != int(np.argmax([e[0] for e in ends])): out["exitStroke"] = main


def _drop_retrace(p, near=2.5, gap=30):
    """The font's pen path (font_glyphs.py's walk over the skeleton) can end by going back over a line it already drew (Ъ: from
    the end inside the bowl back up and along the flag): that tail is cut off. A point is part of it when it lies within `near`
    of the path drawn more than `gap` points before it; the cut is at the first point, from the end back, that does not."""
    p = dg.resample(np.asarray(p, float), 0.6)
    i = len(p) - 1
    while i > gap:
        d = np.min(np.hypot(*(p[:i - gap] - p[i]).T))
        if d > near: break
        i -= 1
    # the jump to the retrace (the walk's step from the bowl's end to the line it goes back over) is cut too
    steps = np.hypot(*np.diff(p[:i + 1], axis=0).T)
    big = np.where(steps > 3 * 0.6)[0]
    if len(big) and big[-1] > len(p) * 0.6: i = int(big[-1])
    return p[:i + 1]


def _turns(p, k=5):
    """Where the pen path turns straight back on itself (the direction over `k` points before and after a point reverses): the
    sharpest point of each such run."""
    out = []
    for i in range(k, len(p) - k):
        a, b = p[i] - p[i - k], p[i + k] - p[i]
        c = np.dot(a, b) / (np.hypot(*a) * np.hypot(*b) + 1e-9)
        if c < -0.5:
            if out and i - out[-1][0] <= k:
                if c < out[-1][1]: out[-1] = (i, c)
            else: out.append((i, c))
    return [i for i, _ in out]


def _drop_spurs(p, span=40, near=1.0):
    """A dead end the walk runs out along and back (two turns back within `span` points): cut from where the path first reaches the
    place it leaves the dead end to that place, so the line goes straight on (Ю's bar)."""
    p = dg.resample(np.asarray(p, float), 0.6)
    t = _turns(p)
    for a, b in zip(t, t[1:]):
        if b - a > span: continue
        j = next(j for j in range(b, len(p)) if np.min(np.hypot(*(p[:a] - p[j]).T)) > near)  # off the line drawn before
        i = int(np.argmin(np.hypot(*(p[:a] - p[j]).T)))
        return _drop_spurs(np.vstack([p[:i], p[j:]]), span, near)
    return p


def _split(label, p, near=1.0):
    """SPLIT: the pen path cut at its turns back into pieces, only SPLIT[label]'s kept, each its own stroke; a piece starting back
    over a kept one starts where it leaves it."""
    p = dg.resample(np.asarray(p, float), 0.6)
    cuts = [0] + _turns(p) + [len(p) - 1]
    out = []
    for a, b in SPLIT[label]:
        q = p[cuts[a]:cuts[b + 1] + 1]
        if out:
            before = np.vstack(out)
            q = q[next(i for i in range(len(q)) if np.min(np.hypot(*(before - q[i]).T)) > near):]
        out.append(q)
    return out


def flag_like(cmds, source):
    """Ъ: its flag (from the start over the top into the stem) is К's, as tidied (owner, 2026-10-18: «флажок слева должен быть как
    у К»): К's path up to where its stem's line begins, moved so that point lies on this letter's stem line at the same height
    (the top stays on the top line, the stem on its line and on the slant)."""
    src = PAPER[source][0]
    k = next(i for i in range(1, len(src)) if src[i][0] == "L")  # К's stem: the first line; before it, the flag and the turn
    s_end = np.asarray(src[k - 1][1][-1], float)
    j = next(i for i in range(1, len(cmds)) if cmds[i][0] == "L")
    a, b = np.asarray(cmds[j - 1][1][-1], float), np.asarray(cmds[j][1][0], float)  # this letter's stem line
    stem = (a, tt._unit(b - a))
    off = np.array([_x_at(stem, s_end[1]), s_end[1]]) - s_end
    flag = [(c, [np.asarray(q, float) + off for q in ps]) for c, ps in src[:k]]
    return flag + cmds[j:]


def font_letter(label, script, spec):
    """A letter drawn from the font itself (spec "font"): Boyan's pen path (font_stencil, the font's own proportions on the deck's
    paper) tidied like a hand's, every top up its stem to the top line, into the bank; a bowl that ends inside gets Б's connector
    (spec "tail"). Ъ: the owner's freehand Ъ (2026-10-18, before the underlays) stood far from the font («далёк от образца»)."""
    tt.use_script(script)
    PAPER_LABEL[0] = label
    pens = [_drop_retrace(p) for p in font_stencil(label)]
    if label in SPURS: pens = [_drop_spurs(p) for p in pens]
    if label in SPLIT: pens = [q for p in pens for q in _split(label, p)]
    paper = [tt.tidy_stroke(p, tt.CAP_TOP) for p in pens]
    allp = np.vstack([tt.parse_path(dg.fmt(c)) for c in paper])
    k2 = (tt.BASE - tt.CAP_TOP) / (tt.BASE - allp[:, 1].min())  # the tidied letter exactly between its lines, as tidy_letter does
    paper = [[(c, list(tt.shear_scale(np.array(ps, float), k2))) for c, ps in cmds] for cmds in paper]
    if label in FONT_FLAG: paper[0] = font_flag(paper[0], label)
    exact = json.loads(FONT_FLAGS.read_text())["flags"] if FONT_FLAGS.exists() else {}
    for key, pts in exact.items():
        # a whole stroke from the outline's exact centre line (font_flags.py WHOLE; П's hat): set as the stencil sets the letter,
        # fitted by cubics within 0.3 (the tidying would make its long gentle rise one flat line on the top line)
        if not key.startswith(label + ":"): continue
        k = int(key.split(":")[1])
        like = np.vstack([tt.parse_path(dg.fmt(c)) for c in paper])
        p = dg.resample(stencil_map(label, like=like)(np.array(pts, float)), 0.6)
        if key in DEEPEN:
            # the flat run along the top (from where the hat's curve comes up to the top to its end) sagged deeper in the middle by an
            # even arch (owner, 2026-10-19: «прогиб в середине более выраженный»); its ends stay where they are
            i0 = int(np.argmax(p[:, 1] < tt.CAP_TOP + 8))
            s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p[i0:], axis=0).T))]); t = s / s[-1]
            p = p.copy(); p[i0:, 1] += DEEPEN[key] * np.sin(np.pi * t)
        t0, t1 = tt._unit(p[4] - p[0]), tt._unit(p[-1] - p[-5])
        paper[k] = [("M", [p[0]])] + tt._fit_span(p, t0, t1, tol=0.3)
    if label in SHAPES: paper = SHAPES[label](paper)
    if spec.get("flag_like"): paper[0] = flag_like(paper[0], spec["flag_like"])
    PAPER[label] = paper
    paths = [tt.paper_to_bank_cmds(c) for c in paper]
    out = {"label": label, "kind": "letter", "strokes": [{"d": dg.fmt(c)} for c in paths], "stretch": 1.806, "noOverrides": True,
           "repeatCells": 6, "ascender": True, "noNormalize": True, "sourceLabel": f"{spec['note']}; путь пера шрифта Boyan Maga, подровнен"}
    if max(q[1] for st in out["strokes"] for q in tt.parse_path(st["d"])) > FOOT_Y + 5: out["descender"] = True
    if not spec.get("tail"): _exit_flags(out)
    if label in NO_EXIT: out.pop("exitStroke", None); out["noExit"] = True
    if spec.get("tail"):
        pts = np.array(tt.parse_path(out["strokes"][-1]["d"]))
        bottom = pts[pts[:, 1].argmax()]
        b = (bottom[0], FOOT_Y)
        tail = "M {:.2f} {:.2f} C ".format(*b) + " ".join("{:.2f} {:.2f}".format(b[0] + dx, b[1] + dy) for dx, dy in TAIL)
        out["strokes"].append({"d": tail})
        out["tailStroke"] = len(out["strokes"]) - 1
    return out


def font_lower(label, script):
    """A lowercase letter from the font's own pen path, on the deck's paper as the font has it (stencil_map: no scaling), tidied
    like the capitals (straight lines straight, bows smooth, tops onto the lines near them); its SHAPES correction after."""
    tt.use_script(script)
    PAPER_LABEL[0] = label
    pens = [_drop_retrace(p) for p in font_stencil(label)]
    paper = [tt.tidy_stroke(p, tt.X_TOP) for p in pens]
    if label in SHAPES: paper = SHAPES[label](paper)
    PAPER[label] = paper
    paths = [tt.paper_to_bank_cmds(c) for c in paper]
    out = {"label": label, "kind": "letter", "strokes": [{"d": dg.fmt(c)} for c in paths], "stretch": 1.806, "noOverrides": True,
           "repeatCells": 4, "noNormalize": True, "sourceLabel": f"{label} (болгарская строчная); путь пера шрифта Boyan Maga, подровнен"}
    allp = tt.to_paper(np.vstack([tt.parse_path(st["d"]) for st in out["strokes"]]))
    if allp[:, 1].min() < tt.X_TOP - 12: out["ascender"] = True
    if allp[:, 1].max() > tt.BASE + 12: out["descender"] = True
    _exit_flags(out)
    if label in NO_EXIT: out.pop("exitStroke", None); out["noExit"] = True
    return out


def glyph_of(item, script):
    label = item["label"]
    if label not in LETTERS: return underlay_glyph(item, script)
    spec = LETTERS[label]
    if spec.get("font"): return font_letter(label, script, spec)
    allp = np.concatenate([dg.parse(st["d"]) for st in item["strokes"]])
    s = dg.CAP_H / float(np.ptp(allp[:, 1]))
    dg.DY = 0.0
    lowest = dg.BASE_DECK - (dg.BASE_CAPTURE - allp[:, 1].max()) * s
    dg.DY = FOOT_Y - lowest
    path_of = (lambda d: flag_smoothed_path(d, spec["flag"])) if spec.get("flag") else dg.stroke_path
    paths = [dg.to_deck(path_of(st["d"]) if k == 0 else dg.stroke_path(st["d"]), s, 0.0) for k, st in enumerate(item["strokes"])]
    strokes = [{"d": dg.fmt(c)} for c in paths]
    out = {"label": label, "kind": "letter", "strokes": strokes, "stretch": 1.806, "repeatCells": 6, "ascender": True, "noNormalize": True,
           "sourceLabel": f"{spec['note']}; сглажен, масштаб x{s:.3f} = высота заглавной, база y=62"}
    if spec.get("tail"):
        pts = np.array([q for _, ps in paths[-1] for q in ps])
        bottom = pts[pts[:, 1].argmax()]
        b = (bottom[0], FOOT_Y)
        tail = "M {:.2f} {:.2f} C ".format(*b) + " ".join("{:.2f} {:.2f}".format(b[0] + dx, b[1] + dy) for dx, dy in TAIL)
        out["strokes"].append({"d": tail})
        out["tailStroke"] = len(out["strokes"]) - 1
    return out


def _bank_cmds(d):
    nums = [float(v) for v in re.findall(r"-?\d*\.?\d+(?:[eE][+-]?\d+)?", d)]; out = []; i = 0
    for t in re.findall(r"[MLQC]", d):
        k = {"M": 1, "L": 1, "Q": 2, "C": 3}[t]
        ps = [np.array([nums[i + 2 * j], nums[i + 2 * j + 1]]) for j in range(k)]; i += 2 * k
        if t == "Q":  # as the cubic it is (Й's breve, from the bank's й)
            p0 = out[-1][1][-1]; t, ps = "C", [p0 + (ps[0] - p0) * 2 / 3, ps[1] + (ps[0] - ps[1]) * 2 / 3, ps[1]]
        out.append((t, ps))
    return out


FRAME_LIKE = {"Ц": "И", "Ш": "И", "Щ": "И"}  # moved to the deck's paper as this letter is (Ц is И with a loop: its И stays И's)
MID, RATIO = {}, {}  # label -> the upright x rescaled() moved the letter about, and its scale across the slant there


def _frame(label, script):
    """(s, lo) of stencil_map on `script`'s paper: how much the font is scaled there, and its foot."""
    tt.use_script(script)
    g = {d["label"]: d for d in json.loads(DRAFT.read_text())}[label]
    allp = tt.upright(tt.to_paper(np.vstack([tt.parse_path(st["d"]) for st in g["strokes"]])))
    lo, hi = allp[:, 1].max(), allp[:, 1].min()
    if lo > tt.BASE + 3: lo = tt.BASE - 3.3
    return (tt.BASE - tt.CAP_TOP) / (lo - hi), lo


def frame_map(label, src, dst):
    """Paper heights on `src`'s paper -> on `dst`'s, as the font stencil moves (stencil_map): back to the font, its zones above and
    below the lowercase band stretched by the other script's upper / lower, scaled to the other capital height; and the scale
    across the slant. Affine between the two break heights it returns (the font's x-line and baseline)."""
    (s0, lo0), (s1, lo1) = _frame(label, src), _frame(label, dst)
    X, B = tt.R_BASE - tt.R_BAND, tt.R_BASE
    def y(v):
        f = lo0 - (B - np.asarray(v, float)) / s0
        f = np.where(f < X, X - (X - f) / src["upper"] * dst["upper"], np.where(f > B, B + (f - B) / src["lower"] * dst["lower"], f))
        return B - (lo1 - f) * s1
    return y, s1 / s0, [B - (lo0 - X) * s0, B - (lo0 - B) * s0]


def _g1(cmds, ys, deg=12.0):
    """frame_map stretches heights by a different amount above and below the font's x-line and baseline (`ys`, on the new paper),
    so a line not on the slant bends a little where it crosses them: such a join turning by less than `deg` (not a corner the
    letter has) gets one tangent, the mean of the two, each handle keeping its length (a line piece there becomes a cubic)."""
    out = [(c, [np.asarray(q, float) for q in ps]) for c, ps in cmds]
    for i in range(1, len(out) - 1):
        J = out[i][1][-1]
        if not any(abs(J[1] - y) < 0.6 for y in ys): continue
        for n in (i, i + 1):
            if out[n][0] == "L":
                p0 = out[n - 1][1][-1]; q = out[n][1][0]
                out[n] = ("C", [p0 + (q - p0) / 3, p0 + (q - p0) * 2 / 3, q])
        a, b = out[i][1], out[i + 1][1]
        t0, t1 = J - a[1], b[0] - J
        if np.hypot(*t0) < 1e-9 or np.hypot(*t1) < 1e-9: continue
        ang = math.degrees(math.acos(max(-1.0, min(1.0, np.dot(tt._unit(t0), tt._unit(t1))))))
        if ang > deg: continue
        t = tt._unit(tt._unit(t0) + tt._unit(t1))
        a[1] = J - t * np.hypot(*t0); b[0] = J + t * np.hypot(*t1)
    return out


def _merge_tiny(cmds, eps=0.6):
    """A piece shorter than `eps` (a stroke cut at two heights a hair apart: the font's x-line and the paper's) folded into the
    piece before it, whose end and last handle move with it: rounded to the bank's two decimals, its handles point anywhere."""
    out = [cmds[0]]
    for c, ps in cmds[1:]:
        p0 = np.asarray(out[-1][1][-1], float); end = np.asarray(ps[-1], float)
        if len(out) > 1 and out[-1][0] == "C" and np.hypot(*(end - p0)) < eps:
            h1, h2, _ = out[-1][1]
            out[-1] = ("C", [h1, np.asarray(h2, float) + (end - p0), end])
        else: out.append((c, ps))
    return out


def rescaled(glyph, script):
    """A glyph built on DESIGN's paper -> the same strokes on `script`'s paper, moved as the font stencil they were fitted to moves
    (frame_map: the font's own zones re-stretched for the deck's paper, not the letter scaled evenly: the owner checks the letter
    over the font set on the deck's paper, 2026-10-19 Х: «не лежит»), about the middle of the letter across the slant; exact: the
    bank -> paper map and frame_map are affine between their heights, so each stroke is cut there first. A letter the font has
    no draft of: CAP_K times smaller, evenly."""
    label = glyph["label"]
    tt.use_script(DESIGN)
    paper = [[(c, list(tt.to_paper(np.array(ps)))) for c, ps in tt._split_at(_bank_cmds(st["d"]), [tt.B_TOP, tt.B_BASE])] for st in glyph["strokes"]]
    try: fy, r, breaks = frame_map(FRAME_LIKE.get(label, label), DESIGN, script)
    except KeyError: fy, r, breaks = (lambda v: tt.BASE - (tt.BASE - np.asarray(v, float)) * CAP_K), CAP_K, []
    tt.use_script(DESIGN)
    paper = [tt._split_at(cmds, breaks) if breaks else cmds for cmds in paper]
    u = tt.upright(np.vstack([q for cmds in paper for _, ps in cmds for q in ps]))
    mid = MID[label] = (u[:, 0].min() + u[:, 0].max()) / 2
    RATIO[label] = r
    def k(ps):
        q = tt.upright(np.array(ps))
        return list(tt.from_upright(np.c_[mid + (q[:, 0] - mid) * r, fy(q[:, 1])]))
    ys = [float(fy(np.array([y]))[0]) for y in breaks] + [tt.R_BASE - tt.R_BAND, tt.R_BASE]
    paper = [_merge_tiny(_g1(_g1([(c, k(ps)) for c, ps in cmds], ys), ys)) for cmds in paper]
    tt.use_script(script)
    return {**glyph, "strokes": [{**st, "d": dg.fmt(_merge_tiny(tt.paper_to_bank_cmds(cmds), 0.05))} for st, cmds in zip(glyph["strokes"], paper)]}


MID_LOG = []
JOIN_DEG = 55.0  # the rise of every join at the middle of the x-band: the font's own (lowercase lead-ins 51-58°, exits 52-60°)
HOOK = {}  # label -> its finished exit hook from its last bottom (relative), for letters whose own is too shallow


def _first_turn(q, tol=0.05):
    """Index of the first point where the path's height stops going the way it went from q[0] (its first turn up or down)."""
    sg = np.sign(q[min(6, len(q) - 1), 1] - q[0, 1])
    i = 1
    while i < len(q) and (q[i, 1] - q[i - 1, 1]) * sg > -tol: i += 1
    return i - 1


def mid_joins(g, tol=0.05):
    """Every lead-in starts and every exit hook ends exactly halfway up the x-band (owner, 2026-10-20: the joins between letters
    are drawn later from there, «начинаться от середины и на этой же линии заканчиваться исходящие крюки»). Only the run from the
    end to its first turn is stretched in height about that turn, so the rest of the letter stays as it is. A lead-in: the first
    stroke's start in the x-band, on the letter's left, heading right into it; an exit: the joining stroke's end in the x-band, on
    the letter's right, heading right."""
    mid = 0.5 * (tt.X_TOP + tt.BASE)
    band = tt.BASE - tt.X_TOP
    P = [dg.resample(tt.to_paper(np.array(tt.parse_path(st["d"]))), 0.3) for st in g["strokes"]]
    allx = np.vstack(P)[:, 0]; x0, x1 = allx.min(), allx.max()
    ins = lambda y: tt.X_TOP + 0.15 * band < y < tt.BASE - 0.1 * band
    jobs = [(0, 0)]
    if not g.get("noExit"):
        jobs.append((g.get("exitStroke", int(np.argmax([q[-1, 0] for q in P]))), -1))
    for k, e in jobs:
        q = P[k] if e == -1 else P[k][::-1]
        end, d = q[-1], q[-1] - q[-7]
        side = (end[0] - x0) / max(1e-6, x1 - x0)
        heading = d[0] > 0 if e == -1 else True        # an exit goes on to the right
        if not (ins(end[1]) and heading and (side > 0.6 if e == -1 else side < 0.4)): continue
        r = q[::-1]; t = len(q) - 1 - _first_turn(r)     # the run from the turn nearest the end
        yt = q[t, 1]
        if abs(yt - end[1]) < 1.0 or (yt - mid) * (yt - end[1]) <= 0: continue
        q = q.copy()
        changed = False
        if abs(end[1] - mid) >= 0.05:
            f = (mid - yt) / (end[1] - yt)
            if e == -1 and f > 1.6 and "и" in HOOK:   # a hook too shallow to stretch (м's, ending low): и's exit hook instead
                q = np.vstack([q[:t], HOOK["и"] + q[t]])
            else:
                q[t:, 1] = yt + (q[t:, 1] - yt) * f
            MID_LOG.append(f"{g['label']} {'вход' if e == 0 else 'выход'} {end[1] - mid:+.1f}")
            changed = True
        # the last stretch through the middle straight at JOIN_DEG, so any exit and any lead-in meet in one straight line
        # (owner, 2026-10-20: «соединение должно выглядеть практически идеально ровно»): only a run that rises to the right
        # (exits; lead-ins that go up into the letter), not the ones coming down (л м я А Л М Я) nor е's flat start
        d = q[-1] - q[-11]
        rises = (d[0] > 0 > d[1]) if e == -1 else (d[0] < 0 < d[1])
        a_now = math.degrees(math.atan2(abs(d[1]), abs(d[0])))
        if rises and 35 < a_now < 85:
            # the run bent a little more (or less) all along it, more and more towards the end, until it leaves the middle at
            # JOIN_DEG; its height about its turn put back on the middle after each bend (a few rounds: the two settle)
            for _ in range(4):
                seg = np.diff(q[t:], axis=0)
                d = q[-1] - q[-11]
                cur = math.degrees(math.atan2(abs(d[1]), abs(d[0])))
                dth = math.radians(cur - JOIN_DEG)   # a positive turn (y down) lowers the rise, for an exit and a reversed lead-in alike
                sv = np.linspace(0, 1, len(seg)); th = dth * sv * sv * (3 - 2 * sv)
                c_, s_ = np.cos(th), np.sin(th)
                seg = np.c_[c_ * seg[:, 0] - s_ * seg[:, 1], s_ * seg[:, 0] + c_ * seg[:, 1]]
                q[t + 1:] = q[t] + np.cumsum(seg, axis=0)
                q[t:, 1] = q[t, 1] + (q[t:, 1] - q[t, 1]) * (mid - q[t, 1]) / (q[-1, 1] - q[t, 1])
            changed = True
        if not changed: continue
        if e == -1 and g["label"] == "и": HOOK["и"] = q[t:] - q[t]
        q = q if e == -1 else q[::-1]
        cmds = _fit_corners(q, _corners(q, deg=100), tol=0.05)
        g["strokes"][k]["d"] = dg.fmt(tt.paper_to_bank_cmds(cmds))
        P[k] = q


def main():
    variant = json.loads(VARIANT.read_text())
    deck_script = variant["meta"].get("script")
    script = DESIGN
    made, lower = [], []
    for f in sorted(CAPTURES.glob("*.json")):
        for item in json.loads(f.read_text()):
            if item["label"] in BANK_KEPT: continue
            # a lowercase capture (к, owner 2026-10-20) straight on the deck's paper, as the font's lowercase (no DESIGN step)
            if item["label"].islower(): lower.append(glyph_of(item, deck_script))
            else: made.append(glyph_of(item, script))
    # the capitals nobody traced: from the font's own pen path (owner, 2026-10-18: «давай остальные буквы»)
    for ch in FONT_ONLY:
        if ch not in {m["label"] for m in made}:
            made.append(font_letter(ch, script, {"note": f"{ch} (болгарская заглавная)"}))
    made.append(breve_i(made))
    made = [rescaled(g, deck_script) for g in made] + lower
    # the lowercase from the font (owner, 2026-10-19: «делаем строчные»), straight on the deck's paper (no DESIGN step)
    for ch in FONT_LOWER:
        if ch not in {m["label"] for m in made}: made.append(font_lower(ch, deck_script))
    tt.use_script(deck_script)
    for g in made: mid_joins(g)
    keep = [g for g in variant.get("glyphs", []) if g["label"] not in {m["label"] for m in made} | DROPPED]
    variant["glyphs"] = keep + made
    VARIANT.write_text(json.dumps(variant, ensure_ascii=False, indent=2) + "\n")
    # the letters moved onto the font were fitted to the stencil set on the letter before the move; a review sheet that set it on
    # the finished letter (wider or narrower by its ends) would show the font shifted
    at = {}
    for label, strokes in PAPER_UNSNAPPED.items():
        u = tt.upright(np.vstack([np.array(tt.parse_path(dg.fmt(c))) for c in strokes]))
        m = MID.get(label, 0.0)
        r = RATIO.get(label, 1.0 if label.islower() else CAP_K)
        at[label] = [round(float(m + (u[:, 0].min() - m) * r), 3), round(float(m + (u[:, 0].max() - m) * r), 3)]
    STENCIL_AT.write_text(json.dumps({"note": "upright x range of each snapped letter before snapping (build_glyphs.py)", "at": at}, ensure_ascii=False, indent=1) + "\n")
    print("mid:", "; ".join(MID_LOG))
    print(f"{len(made)} glyphs -> {VARIANT}: {', '.join(m['label'] for m in made)}")


if __name__ == "__main__":
    main()
