#!/usr/bin/env python3
"""Letters of the Bulgarian variant (`propis2_bg`) that the shared bank lacks: raw hand captures -> glyphs in variant.json.

  python3 tools/propis2/variants/bg/build_glyphs.py

Reads  tools/propis2/variants/bg/captures/*.json  (handwriting capture tool, a capital drawn on the narrow band: base y=88)
Writes the glyphs into tools/propis2/variants/bg/variant.json `glyphs` (by label; the other glyphs there stay)

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
# geometry, so the capture is taken at the fixed scale of the ruling (x2: the tool's lowercase 26 is the bank's 52, base 88 -> 62),
# not stretched to a capital's height. Any captured label not in LETTERS is such a letter.
UNDERLAY = {"underlay": True}


def glyph_of(item):
    label = item["label"]
    spec = LETTERS.get(label, UNDERLAY)
    allp = np.concatenate([dg.parse(st["d"]) for st in item["strokes"]])
    if spec.get("underlay"):
        s = 2.0
        dg.DY = 0.0
    else:
        s = dg.CAP_H / float(np.ptp(allp[:, 1]))
        dg.DY = 0.0
        lowest = dg.BASE_DECK - (dg.BASE_CAPTURE - allp[:, 1].max()) * s
        dg.DY = FOOT_Y - lowest
    path_of = (lambda d: flag_smoothed_path(d, spec["flag"])) if spec.get("flag") else dg.stroke_path
    paths = [dg.to_deck(path_of(st["d"]) if k == 0 else dg.stroke_path(st["d"]), s, 0.0) for k, st in enumerate(item["strokes"])]
    strokes = [{"d": dg.fmt(c)} for c in paths]
    if spec.get("underlay"):
        # a Boyan letter traced by hand: the font's lead-in and exit are part of it (font_glyphs.py), this bank's per-letter fixes
        # (glyphOverrides.js, by stroke index) are not for it, the pen ending on the letter's left side means nothing joins after it
        pts = np.array([q for _, ps in paths[-1] for q in ps])
        allx = np.array([q[0] for c in paths for _, ps in c for q in ps])
        out = {"label": label, "kind": "letter", "strokes": strokes, "stretch": 1.806, "noOverrides": True,
               "repeatCells": 6 if label.isupper() else 4, "sourceLabel": f"{label} (обведена по подложке Boyan Maga, захват)"}
        if label.isupper(): out["ascender"] = True; out["noNormalize"] = True
        if label in "дзруфцщ": out["descender"] = True
        if pts[-1][0] < (allx.min() + allx.max()) / 2: out["noExit"] = True
        return out
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
    made = []
    for f in sorted(CAPTURES.glob("*.json")):
        for item in json.loads(f.read_text()):
            made.append(glyph_of(item))
    variant = json.loads(VARIANT.read_text())
    keep = [g for g in variant.get("glyphs", []) if g["label"] not in {m["label"] for m in made}]
    variant["glyphs"] = keep + made
    VARIANT.write_text(json.dumps(variant, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(made)} glyphs -> {VARIANT}: {', '.join(m['label'] for m in made)}")


if __name__ == "__main__":
    main()
