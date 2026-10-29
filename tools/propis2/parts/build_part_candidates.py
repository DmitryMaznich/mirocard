#!/usr/bin/env python3
"""Candidates for the «part of a letter» elements the owner asked for on the sheet owner_sheet_2026-10-29.jpg (see README.md).

Each element is a piece of a stroke of one of OUR letters (propis2 glyph bank), at its natural size and place in the capture frame
(baseline y=62, zone top y=10; capitals reach y=-42, the stem of р goes down to y=114): the engine scales them like letters.

  python3 build_part_candidates.py glyph_strokes.json new_elements.json

glyph_strokes.json: { "П": ["M ... C ...", ...strokes], ... } of buildGlyphMap({ wide }) (see README for the dump).
new_elements.json: wide.json-style glyphs { label, kind: "element", strokes: [{d}], stretch: 1.806, n } ready to be appended to the deck's glyphs.
"""
import json, re, sys

d = json.load(open(sys.argv[1]))
wide = json.load(open("tools/propis/wide.json"))["glyphs"]


def segs(p):
    toks = re.findall(r"[MLCQ]|-?\d*\.?\d+", p)
    out, i = [], 0
    while i < len(toks):
        c = toks[i]
        n = {"M": 2, "L": 2, "C": 6, "Q": 4}[c]
        out.append((c, [float(x) for x in toks[i + 1 : i + 1 + n]]))
        i += 1 + n
    return out


def fmt(c, v):
    return c + " " + " ".join(f"{x:.2f}" for x in v)


def cut(letter, stroke, a, b):
    """segments a..b (indices of the path's commands, 0 = the M) of one stroke, as its own path"""
    ss = segs(d[letter][stroke])
    start = ss[a - 1][1][-2:] if a > 0 else ss[0][1]
    body = ss[a if a > 0 else 1 : b + 1]
    return "M " + " ".join(f"{x:.2f}" for x in start) + " " + " ".join(fmt(c, v) for c, v in body)


def whole(letter, stroke):
    return d[letter][stroke]


def join(*ps):
    out = ps[0]
    for p in ps[1:]:
        out += " " + re.sub(r"^M\s*[-\d.]+\s+[-\d.]+\s*", "", p)
    return out


# the straight stem of the lowercase р (the first line of its path)
rp = [g for g in wide if g["label"] == "р"][0]["strokes"][0]["d"]
m = re.match(r"M\s*([-\d.]+)\s+([-\d.]+)\s*L\s*([-\d.]+)\s+([-\d.]+)", rp)
stem = f"M {m[1]} {m[2]} L {m[3]} {m[4]}"

# n = the number of the element on the owner's sheet; the case of the letter is the owner's («левая от П» is the CAPITAL П, «левая от л» the lowercase)
CAND = {
    1: ("р-палка", stem),
    2: ("П-лев", whole("П", 0)),
    3: ("П-прав", whole("П", 1)),
    4: ("Р-шапка", cut("Р", 1, 0, 16)),  # ?? the owner's is wider and curled at both ends
    5: ("В-петля", cut("В", 0, 6, 38)),  # ?? try the upper bowl, segments 39..62
    6: ("Г-шапка", whole("Г", 1)),  # ?? the owner's bar is about twice as long
    7: ("Л-лев", whole("Л", 0)),
    8: ("л-лев", cut("л", 0, 0, 9)),
    9: ("б-хвост", "M 122.10 62.00 L 168.00 -36.50 Q 175.10 -42.00 187.70 -42.00"),  # the stem of б from the baseline to its flag
    10: ("У-лев", cut("У", 0, 0, 4)),  # ?? the owner's is flatter and wider: try 0..2
    12: ("И-лев", cut("И", 0, 0, 4)),
    13: ("Э-дуга", whole("Э", 0)),
    14: ("Ж-зигзаг", join(whole("Ж", 1), whole("Ж", 2), cut("Ж", 3, 0, 1))),
    15: ("э-дуга", whole("э", 0)),
    16: ("ж-зигзаг", cut("ж", 0, 6, 8)),
    18: ("П-прав-2", whole("П", 1)),  # same as 3: ask the owner what differs
    19: ("а-стойка", cut("а", 0, 6, 7)),
    20: ("Ц-хвост", cut("Ц", 0, 10, 27)),
    21: ("Ф-ухо", whole("Ф", 2)),
    22: ("К-флажок", cut("К", 0, 0, 9)),  # ?? the owner's is a flat «~»: try К segments 42..50 (the hook at the top)
}


def shift_x(p, dx):
    toks = re.findall(r"[MLCQ]|-?\d*\.?\d+", p)
    res, buf = [], []
    for t in toks:
        if t in "MLCQ":
            res.append(t)
        else:
            buf.append(float(t))
            if len(buf) == 2:
                res += [f"{buf[0] + dx:.2f}", f"{buf[1]:.2f}"]
                buf = []
    return " ".join(res)


out = []
for k, (name, p) in CAND.items():
    xs = [float(x) for x in re.findall(r"-?\d*\.?\d+", p)][0::2]
    out.append({"label": name, "kind": "element", "strokes": [{"d": shift_x(p, 110 - min(xs))}], "stretch": 1.806, "n": k})
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
print(len(out), "elements ->", sys.argv[2])
