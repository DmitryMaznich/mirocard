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
import json, math, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "tools/propis2"))
import build_digit_glyphs as dg  # noqa: E402  (the digits' pipeline; its main() runs only as a script)
sys.path.insert(0, str(HERE))
import tidy_trace as tt  # noqa: E402  (also parse_path: the capture tool writes cubics, dg.parse reads no C)

VARIANT = HERE / "variant.json"
CAPTURES = HERE / "captures"
FOOT_Y = 62.0  # the bottom of a capital's bowl on the baseline, as the deck's capitals (Б, В, Ь-like bowls) stand
# Б's connector in wide.json, from the bottom of its bowl: "M 156.94 62.00 C 165.94 62.00 186.34 43.05 196.06 36.00", relative
TAIL = [(9.00, 0.00), (29.40, -18.95), (39.12, -26.00)]
# per letter: what it needs beyond the capture (the bowl it ends in gets Б's connector)
# `flag`: the lead-in up to the top of the stem is smoothed as ONE piece with this sigma (units), its corners not kept: the hand drew
# the flag of Ъ as a sharp «М», the copybook writes a wave (owner, 2026-10-18: «сгладь только флажок»); the rest keeps its corners.
LETTERS = {
    # Ъ: from the font now (owner, 2026-10-18: the freehand one «далёк от образца»); its capture stays in captures/ as the record
    "Ъ": {"font": True, "tail": True, "flag": 3.0, "note": "Ъ (болгарская заглавная: флажок, стойка, овал строчной высоты)"},
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
# FONT_ONLY: capitals built from the font's pen path when no capture of them exists (font_letter); a capture, when it comes, wins
FONT_ONLY = "ЙНОПРСТУФХЦЧШЩЮЯ"
# LOOPS: the hand turned back sharply where the font (and the copybook) has a small loop: the waist of Е (font comparison sheet,
# 2026-10-18). tidy_trace makes every sharp turn away from the ruling a loop in these letters.
LOOPS = set("Е")


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


def hat_like(source, stroke=1, src_stroke=1):
    """Г, П: the hat (the flag over the stem; `stroke` here, `src_stroke` there) is Б's, placed the same way against the stem's top (owner, 2026-10-18: «верхние шляпы
    должны быть одинаковые ... по текущей шляпе от Б»). Б's capture comes before Г's (captures/ in order)."""
    def adjust(strokes):
        src = PAPER[source]
        # the same height as there (both stand on the same ruling: the hat on the top line); across, as far from the stem as there,
        # the stem measured at the height where the source's stem begins
        top = np.asarray(src[0][0][1][0], float)
        stem = np.array(tt.parse_path(tt.dg.fmt(strokes[0])))
        at = stem[np.argmin(np.abs(stem[:, 1] - top[1]))]
        offset = np.array([at[0] - top[0], 0.0])
        strokes[stroke] = [(c, [np.asarray(q, float) + offset for q in ps]) for c, ps in src[src_stroke]]
        return strokes
    return adjust


def stem_like(source, stroke=0):
    """Г: the stem begins as high as Б's (owner, 2026-10-18: «вертикальные штрихи должны тоже одинаковые по высоте ... по
    оригинальному шрифту»; in Boyan Maga both stems begin about a quarter of a capital's height under the hat, Б's 24.7 units on
    paper, Г's 22.1, the hand's Г 18.6). The stroke is stretched from the baseline along the slant, so the stem stays on its line and
    its foot on the baseline."""
    def adjust(strokes):
        target = np.array(tt.parse_path(tt.dg.fmt(PAPER[source][stroke])))[:, 1].min()
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
            cands = [bow(h0, h1) for h0 in np.arange(0.2, 0.71, 0.05) for h1 in np.arange(0.15, 0.61, 0.05)]
            cands = [c for c in cands if clear(c) and sag(c) <= RISE_BOW]
            best = max(cands, key=sag) if cands else bow(1 / 3, 1 / 3)
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


FONT_FLAG = set("КНФЮЪ")  # letters whose top-left flag is the font's own (font_flag, exact from font_flags.json)


# SHAPES: a letter's own correction on paper after the tidying (tidy_trace.tidy_letter adjust)
SHAPES = {"В": oval_lower_bowl, "Г": both(stem_like("Б"), hat_like("Б")), "Л": spread_like_font, "М": from_font, "К": lambda s: [font_flag(s[0], "К")] + s[1:],
          "П": hat_like("Б", stroke=2)}  # П: its stems as the font draws them, Б's hat over them (owner, 2026-10-19)


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
    if label in "дзруфцщ": out["descender"] = True
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
    paper = [tt.tidy_stroke(_drop_retrace(p), tt.CAP_TOP) for p in font_stencil(label)]
    allp = np.vstack([tt.parse_path(dg.fmt(c)) for c in paper])
    k2 = (tt.BASE - tt.CAP_TOP) / (tt.BASE - allp[:, 1].min())  # the tidied letter exactly between its lines, as tidy_letter does
    paper = [[(c, list(tt.shear_scale(np.array(ps, float), k2))) for c, ps in cmds] for cmds in paper]
    if label in FONT_FLAG: paper[0] = font_flag(paper[0], label)
    if label in SHAPES: paper = SHAPES[label](paper)
    if spec.get("flag_like"): paper[0] = flag_like(paper[0], spec["flag_like"])
    PAPER[label] = paper
    paths = [tt.paper_to_bank_cmds(c) for c in paper]
    out = {"label": label, "kind": "letter", "strokes": [{"d": dg.fmt(c)} for c in paths], "stretch": 1.806, "noOverrides": True,
           "repeatCells": 6, "ascender": True, "noNormalize": True, "sourceLabel": f"{spec['note']}; путь пера шрифта Boyan Maga, подровнен"}
    if max(q[1] for st in out["strokes"] for q in tt.parse_path(st["d"])) > FOOT_Y + 5: out["descender"] = True
    if not spec.get("tail"): _exit_flags(out)
    if spec.get("tail"):
        pts = np.array(tt.parse_path(out["strokes"][-1]["d"]))
        bottom = pts[pts[:, 1].argmax()]
        b = (bottom[0], FOOT_Y)
        tail = "M {:.2f} {:.2f} C ".format(*b) + " ".join("{:.2f} {:.2f}".format(b[0] + dx, b[1] + dy) for dx, dy in TAIL)
        out["strokes"].append({"d": tail})
        out["tailStroke"] = len(out["strokes"]) - 1
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


def main():
    variant = json.loads(VARIANT.read_text())
    script = variant["meta"].get("script")
    made = []
    for f in sorted(CAPTURES.glob("*.json")):
        for item in json.loads(f.read_text()):
            if item["label"] not in BANK_KEPT: made.append(glyph_of(item, script))
    # the capitals nobody traced: from the font's own pen path (owner, 2026-10-18: «давай остальные буквы»)
    for ch in FONT_ONLY:
        if ch not in {m["label"] for m in made}:
            made.append(font_letter(ch, script, {"note": f"{ch} (болгарская заглавная)"}))
    keep = [g for g in variant.get("glyphs", []) if g["label"] not in {m["label"] for m in made}]
    variant["glyphs"] = keep + made
    VARIANT.write_text(json.dumps(variant, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(made)} glyphs -> {VARIANT}: {', '.join(m['label'] for m in made)}")


if __name__ == "__main__":
    main()
