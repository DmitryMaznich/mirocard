"""Drawing helpers for the digits workbook: the digits and signs of
«Прописи 2» (src/topics/renderers/propis2/digitGlyphs.json, exported with
the app's own squared-paper geometry by tools/propis2/export_workbook_digits.mjs
into p2_digits.json) placed on a 5mm "клетка" grid -- the same digits the
app draws on squared paper: one cell tall, the copybook's 65deg slant, a
digit against the right side of its cell, a sign in the middle.

Local page coordinates, mm, origin at the A5 half's bottom-left (build.py
translates/scales before calling page functions) -- same convention as
../punctuation_workbook.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SCRIPTS, "propis_worksheets"))
sys.path.insert(0, os.path.join(SCRIPTS, "punctuation_workbook"))

from page import PAGE_W_MM  # noqa: E402
from svg_path import draw_path, path_bounds  # noqa: E402
from ruling import CELL_MM, PAGE_H, HALF_W, PAGE_W  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402

INK = (0.11, 0.30, 0.85)
START = (0.85, 0.15, 0.15)       # start-of-stroke dot, same red as the margins
FADE = [0.5, 0.5, 0.5, 0.28, 0.28, 0.28]  # tracing copies, fading as in the punctuation workbook
DASH = (0.5, 0.56)               # mm on/off
# Red margin 10mm = 2 cells (user, 2026-09-29: narrower than the other
# notebooks' 15mm); build.py passes it to the shared ruling.
MARGIN_MM = 10.0
COLS = 26                        # cells per row (one cell kept free by the margin)
DOT_ONLY_OPACITY = 0.6           # a start dot standing alone marks the rhythm, lighter

PAGE_H_MM = PAGE_H / mm
LEFT_X0 = MARGIN_MM + CELL_MM                     # left page: margin, one free cell
RIGHT_MARGIN_LOCAL = (PAGE_W - MARGIN_MM * mm - HALF_W) / mm
RIGHT_X0 = RIGHT_MARGIN_LOCAL - (COLS + 1) * CELL_MM
assert RIGHT_X0 >= 3.0 and LEFT_X0 + COLS * CELL_MM <= HALF_W / mm - 3.0


P2_DIGITS = os.path.join(HERE, "p2_digits.json")


def load_cards():
    """char -> {"kind": "digit"|"sign", "cell": [d...], "text": [d...]}
    (units and origins: tools/propis2/export_workbook_digits.mjs). "-" is
    accepted for the minus too."""
    with open(P2_DIGITS, encoding="utf-8") as f:
        glyphs = json.load(f)["glyphs"]
    for g in glyphs.values():   # ink extent across the cell, in cells
        b = [path_bounds(d, samples_per_curve=60) for d in g["cell"]]
        g["x0"], g["x1"] = min(v[0] for v in b), max(v[1] for v in b)
    glyphs["-"] = glyphs["−"]
    return glyphs


def _nums(d):
    return [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", d)]


def row_y(t):
    """Baseline of grid line t, counted from the page's top edge."""
    return PAGE_H_MM - t * CELL_MM


def col_x(is_left, col):
    return (LEFT_X0 if is_left else RIGHT_X0) + col * CELL_MM


def draw_digit(c, card, cell_x, baseline, cells_h=1, cells_w=None, opacity=1.0,
               dashed=False, start_dot=False, ink=True, shift=0.0):
    """One digit/sign, `cells_h` cells tall, in a box `cells_w` cells wide
    (default = cells_h) whose left edge is cell_x: a digit's ink touches the
    box's right side, a sign stands in its middle (as the app places them
    on squared paper). `shift`: moved across by this many cells."""
    cells_w = cells_w or cells_h
    k = cells_h * CELL_MM            # mm per exported unit (one cell)
    cell_x += shift * CELL_MM
    if card["kind"] == "digit":
        ox = cell_x + cells_w * CELL_MM - k
    else:
        ox = cell_x + (cells_w * CELL_MM - k) / 2

    def tf(nx, ny):
        return ox + nx * k, baseline - ny * k

    if not ink:   # the start dot alone, where the child writes the digit himself
        _start_dots(c, card, tf, cells_h, DOT_ONLY_OPACITY)
        return
    path = c.beginPath()
    for d in card["cell"]:
        draw_path(path, d, tf)
    c.saveState()
    c.setStrokeColorRGB(*INK)
    c.setStrokeAlpha(opacity)
    c.setLineWidth(0.275 if cells_h == 1 else 0.36)
    c.setLineCap(1)
    c.setLineJoin(1)
    if dashed:
        c.setDash(*DASH)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()

    if start_dot:
        _start_dots(c, card, tf, cells_h, opacity)


def _start_dots(c, card, tf, cells_h, opacity):
    """Filled dot = where the first stroke starts; ring = the next strokes."""
    r = 0.38 * cells_h ** 0.5
    c.saveState()
    c.setFillColorRGB(*START)
    c.setStrokeColorRGB(*START)
    c.setFillAlpha(opacity)
    c.setStrokeAlpha(opacity)
    c.setLineWidth(0.18)
    for i, d in enumerate(card["cell"]):
        n = _nums(d)
        x, y = tf(n[0], n[1])
        if i == 0:
            c.circle(x, y, r, stroke=0, fill=1)
        elif cells_h > 1:   # too cramped to read at 1 cell
            c.circle(x, y, r * 0.8, stroke=1, fill=0)
    c.restoreState()


def practice_row(c, cards, seq, is_left, t, cells_h=1, step=2, n_trace=6,
                 model_only=False):
    """One row of the ladder: the solid model(s) with start dots, then
    n_trace half-tone dashed copies (fading), then the rest of the row to
    write alone -- marked only by the start dots (user, 2026-09-29: the
    dots give the rhythm, lighter on the eye than more copies).
    `seq` = the item(s) cycled along the row ("1", "14"...); `step` =
    columns from one item to the next."""
    y = row_y(t)
    col, i = 0, 0
    slots = COLS // step
    n_model = len(seq)
    for i in range(slots):
        ch = seq[i % len(seq)]
        if i < n_model:
            op, dashed = 1.0, False
        elif not model_only and i - n_model < n_trace:
            op, dashed = FADE[min(i - n_model, len(FADE) - 1)], True
        else:
            if col + (cells_h if step > 1 else 1) > COLS:
                break
            draw_digit(c, cards[ch], col_x(is_left, col), y, cells_h=cells_h, ink=False)
            col += step
            continue
        draw_digit(c, cards[ch], col_x(is_left, col), y, cells_h=cells_h,
                   opacity=op, dashed=dashed, start_dot=True)
        col += step


def page_number(c, n, align):
    """The propis badge (page.py), re-centred in this notebook's narrower
    margin."""
    cx = MARGIN_MM / 2 if align == "left" else PAGE_W_MM - MARGIN_MM / 2
    c.saveState()
    c.setFillColorRGB(1, 1, 1)
    c.circle(cx, 10.0, 3.6, stroke=0, fill=1)
    c.setFont("Helvetica", 7 / 2.83465)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawCentredString(cx, 9.0, str(n))
    c.restoreState()


def seq_row(c, cards, items, is_left, t, step=2):
    """A row of explicit slots: items = [(char, "solid"|"dashed"|None)],
    None = an empty slot the child fills in."""
    y = row_y(t)
    for i, (ch, style) in enumerate(items):
        if style is None:   # the child writes it: start dot only
            draw_digit(c, cards[ch], col_x(is_left, i * step), y, ink=False)
            continue
        draw_digit(c, cards[ch], col_x(is_left, i * step), y,
                   opacity=1.0 if style == "solid" else FADE[0],
                   dashed=style == "dashed", start_dot=True)


def units_row(c, cards, units, is_left, t, gap=1, dots="none"):
    """School cell layout: each character in its own cell, the characters of
    one unit (a number "12", an example "2+3=5") in consecutive cells,
    `gap` empty cells between units. units = [(text, "solid"|"dashed"|None)],
    None = the unit's cells left empty for the child to write in.
    dots: where start-of-stroke dots go -- "all", "solid" (models only),
    or "none" (default: dots belong only where a symbol is being LEARNED --
    digit pages 1-10 and the sign rows of page 16; user, 2026-09-28)."""
    width = sum(len(u) for u, _ in units) + gap * (len(units) - 1)
    assert width <= COLS, f"row {t}: {units} is {width} cells, row has {COLS}"
    y = row_y(t)
    col = 0
    for text, style in units:
        for j, ch in enumerate(text):
            if style is not None:
                draw_digit(c, cards[ch], col_x(is_left, col), y,
                           opacity=1.0 if style == "solid" else FADE[0],
                           dashed=style == "dashed",
                           start_dot=dots == "all" or (dots == "solid" and style == "solid"),
                           shift=sign_shift(cards, text, j))
            col += 1
        col += gap


def sign_shift(cards, text, j):
    """A sign between two digits stands in the middle between their ink, as
    in the app (wordEngine's squared-paper pass): the digits are against the
    right side of their cells, so the middle of the sign's own cell is
    off-centre. In cells."""
    g = cards[text[j]]
    if g["kind"] != "sign" or j == 0 or j == len(text) - 1:
        return 0.0
    prev, nxt = cards[text[j - 1]], cards[text[j + 1]]
    if prev["kind"] == "sign" or nxt["kind"] == "sign":
        return 0.0
    return ((prev["x1"] - 1) + (nxt["x0"] + 1)) / 2 - (g["x0"] + g["x1"]) / 2
