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
import json, sys
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
    "Ъ": {"tail": True, "flag": 3.0, "note": "Ъ (захват 2026-10-18, болгарская заглавная: флажок, стойка, овал строчной высоты)"},
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


def hat_like(source, stroke=1):
    """Г: the hat (the flag over the stem) is Б's, placed the same way against the stem's top (owner, 2026-10-18: «верхние шляпы
    должны быть одинаковые ... по текущей шляпе от Б»). Б's capture comes before Г's (captures/ in order)."""
    def adjust(strokes):
        src = PAPER[source]
        # the same height as there (both stand on the same ruling: the hat on the top line); across, as far from the stem as there,
        # the stem measured at the height where the source's stem begins
        top = np.asarray(src[0][0][1][0], float)
        stem = np.array(tt.parse_path(tt.dg.fmt(strokes[0])))
        at = stem[np.argmin(np.abs(stem[:, 1] - top[1]))]
        offset = np.array([at[0] - top[0], 0.0])
        strokes[stroke] = [(c, [np.asarray(q, float) + offset for q in ps]) for c, ps in src[stroke]]
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


def both(*fns):
    def adjust(strokes):
        for fn in fns: strokes = fn(strokes)
        return strokes
    return adjust


# SHAPES: a letter's own correction on paper after the tidying (tidy_trace.tidy_letter adjust)
SHAPES = {"В": oval_lower_bowl, "Г": both(stem_like("Б"), hat_like("Б")), "Л": spread_like_font, "М": m_from_l}


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
    # the stroke the next letter joins from is the one ending furthest right (the engine's own choice, wordEngine.js); when it ends on
    # the letter's left side (Б, В, Д: the pen comes back inside the letter) nothing joins after it
    # (a stroke ending up in the capital's zone is a flag, Б Г: never the one to join from)
    ends = [tt.parse_path(st["d"])[-1] for st in out["strokes"]]
    low = [k for k, e in enumerate(ends) if e[1] >= tt.B_TOP - 6]
    allx = np.array([q[0] for st in out["strokes"] for q in tt.parse_path(st["d"])])
    main = max(low, key=lambda k: ends[k][0]) if low else None
    if main is None or ends[main][0] < (allx.min() + allx.max()) / 2: out["noExit"] = True
    elif main != int(np.argmax([e[0] for e in ends])): out["exitStroke"] = main
    return out


def glyph_of(item, script):
    label = item["label"]
    if label not in LETTERS: return underlay_glyph(item, script)
    spec = LETTERS[label]
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
    keep = [g for g in variant.get("glyphs", []) if g["label"] not in {m["label"] for m in made}]
    variant["glyphs"] = keep + made
    VARIANT.write_text(json.dumps(variant, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(made)} glyphs -> {VARIANT}: {', '.join(m['label'] for m in made)}")


if __name__ == "__main__":
    main()
