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
    bar_y = float(np.mean(np.array(tt.parse_path(dg.fmt(strokes[1])))[:, 1]))
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


def _small_loops(P, s_, near=0.5, max_len=60.0, min_len=4.0):
    """Where a stroke crosses itself within `max_len` units of its own length (a small loop): (start, end) sample indices."""
    out, i = [], 0
    while i < len(P):
        far = (s_ - s_[i] > min_len) & (s_ - s_[i] < max_len)
        d = np.where(far, np.hypot(*(P - P[i]).T), np.inf)
        j = int(np.argmin(d))
        if d[j] < near:
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


def snap_to_font(strokes, label, fork_r=7.0, reach=8.0, sigma=2.0, tol=0.1, leave=0.5, arcs=()):
    """A traced letter moved onto the font's lines without changing its path (owner, 2026-10-19, Б: «максимально приблизь наши
    линии, расширь их, раздвинь без изменения траектории к размерам и линиям шрифта»). Every point of every stroke moves across
    its own path (along its normal only, so the path keeps its length, order and turns) onto the font's skeleton (font_skeleton.json
    set by stencil_map). Near a fork (where the bowl leaves the stem) the skeleton bends off into the other stroke, so there the
    shift is carried over from both sides; it is smoothed along the stroke (`sigma` paper units). A straight line (a stem) moves
    by one shift, so it stays straight and on the slant. A stroke starting on another one starts on it again after the move.
    Hooks keep their bottom on the baseline, tops their top line. Curves refitted by cubics within `tol`. `arcs`: strokes that
    are one arc in the font, their straight pieces bent onto it too (Ж's left element: its line made a corner, owner 2026-10-19)."""
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
    strokes = [_curved_lines(c, S, F, fork_r, force=n in arcs) for n, c in enumerate(strokes)]
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
        loops = _small_loops(P, s_)
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
SPURS = set()  # Ю deferred (owner, 2026-10-19: «отложи работу по Ю, мы сделаем её по-другому»): built as before
# NO_EXIT: nothing joins after these, whatever _exit_flags finds: Ю's oval ends back at its bar, inside the letter, as О's does
# (О gets noExit by itself; Ю's end lies a hair right of the letter's middle, and «Юла» joined from the bar into the oval)
NO_EXIT = set()  # Ю deferred, see SPURS


# SHAPES: a letter's own correction on paper after the tidying (tidy_trace.tidy_letter adjust)
SHAPES = {"А": lambda s: rise_like_font(hooks_like_font(s)), "Д": lambda s: snap_to_font(s, "Д"), "Ж": lambda s: zigzag_middle(snap_to_font(s, "Ж", arcs=(0,))), "Е": lambda s: waist_cusp(snap_to_font(s, "Е")), "Б": lambda s: flat_hat_to_font_end(snap_to_font(s, "Б"), "Б"), "В": lambda s: snap_to_font(oval_lower_bowl(s), "В"), "Г": lambda s: flat_hat_to_font_end(snap_to_font(both(stem_like("Б"), hat_like("Б"))(s), "Г"), "Г"), "Л": spread_like_font, "М": from_font, "К": lambda s: [font_flag(s[0], "К")] + s[1:],
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
