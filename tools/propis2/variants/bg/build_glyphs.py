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


def wider_lower_bowl(strokes, stroke=1, beyond=0.0):
    """В: the lower bowl (after the turn back at the waist) widened across the slant about that turn until it reaches `beyond` past the
    upper one on the page (owner, 2026-10-18: «нижнее пузо ... чуть-чуть увеличить, сейчас верхняя голова больше»)."""
    cmds = strokes[stroke]
    ends = np.array([ps[-1] for _, ps in cmds])
    up = tt.upright(ends)
    waist = [k for k in range(1, len(cmds) - 1) if tt.X_TOP - 25 < ends[k, 1] < tt.X_TOP + 10]
    w = min(waist, key=lambda k: up[k, 0])  # the turn back: the leftmost point there
    pts = lambda part: np.array([q for _, ps in part for q in ps])
    top_right = pts(cmds[:w + 1])[:, 0].max()
    lower = cmds[w + 1:]
    u0 = up[w, 0]
    def scaled(k): return [(c, list(tt.from_upright(np.c_[u0 + (tt.upright(ps)[:, 0] - u0) * k, np.array(ps)[:, 1]]))) for c, ps in lower]
    k = 1.0
    while pts(scaled(k))[:, 0].max() < top_right + beyond and k < 1.4: k += 0.01
    strokes[stroke] = cmds[:w + 1] + scaled(k)
    return strokes


# SHAPES: a letter's own correction on paper after the tidying (tidy_trace.tidy_letter adjust)
SHAPES = {"В": wider_lower_bowl}


def underlay_glyph(item, script):
    label = item["label"]
    dg.DY = 0.0
    raw = [np.array([dg.xform(p, 2.0, 0.0) for p in tt.parse_path(st["d"])]) for st in item["strokes"]]
    paths, _ = tt.tidy_letter(raw, label.isupper(), script, loops=label in LOOPS, adjust=SHAPES.get(label))
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
