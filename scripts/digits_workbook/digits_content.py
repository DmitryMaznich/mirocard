"""Drawing helpers for the digits workbook: the user's captured digits and
math signs (tools/propis/topic.json cards of type "digit"/"math", captured
2026-09-28) placed on a 5mm "клетка" grid.

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
from render import TOPIC_JSON, LETTER_BASELINE_UNIT  # noqa: E402
from svg_path import draw_path, path_bounds  # noqa: E402
from ruling import CELL_MM, PAGE_H, HALF_W, PAGE_W  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402

INK = (0.11, 0.30, 0.85)
START = (0.85, 0.15, 0.15)       # start-of-stroke dot, same red as the margins
FADE = [0.5, 0.5, 0.5, 0.28, 0.28, 0.28]  # tracing copies, fading as in the punctuation workbook
DASH = (0.5, 0.56)               # mm on/off
DIGIT_TOP_UNIT = 39.5            # captured digits' top (native units); base = 88
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


def load_cards():
    with open(TOPIC_JSON, encoding="utf-8") as f:
        cards = json.load(f)["cards"]
    return {c["label"]: c for c in cards if c["type"] in ("digit", "math")}


def _nums(d):
    return [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", d)]


def ink_box(card):
    """True ink bounds (curves sampled, not their control points)."""
    b = [path_bounds(s["d"], samples_per_curve=80) for s in card["strokes"]]
    return (min(v[0] for v in b), max(v[1] for v in b),
            min(v[2] for v in b), max(v[3] for v in b))


def row_y(t):
    """Baseline of grid line t, counted from the page's top edge."""
    return PAGE_H_MM - t * CELL_MM


def col_x(is_left, col):
    return (LEFT_X0 if is_left else RIGHT_X0) + col * CELL_MM


def draw_digit(c, card, cell_x, baseline, cells_h=1, cells_w=None, opacity=1.0,
               dashed=False, start_dot=False, ink=True):
    """One digit/sign, `cells_h` cells tall, in a box `cells_w` cells wide
    (default = cells_h) whose left edge is cell_x. The ink's rightmost
    point sits exactly on the box's right grid line, and a digit's
    lowest/highest points touch the bottom/top lines (user, 2026-09-28),
    at every size -- scaled from its own true ink height. Math signs keep
    the digits' common scale and baseline instead (a "−" stretched to a
    full cell would be a vertical smear)."""
    cells_w = cells_w or cells_h
    h = cells_h * CELL_MM
    x0, x1, y0, y1 = ink_box(card)
    if card["type"] == "digit":
        k, base_unit = h / (y1 - y0), y1
    else:
        k, base_unit = h / (LETTER_BASELINE_UNIT - DIGIT_TOP_UNIT), LETTER_BASELINE_UNIT
    if card["type"] == "digit":
        ox = cell_x + cells_w * CELL_MM - (x1 - x0) * k
    else:   # signs: centred in the cell (the right-line rule is for digits)
        ox = cell_x + (cells_w * CELL_MM - (x1 - x0) * k) / 2

    def tf(nx, ny):
        return ox + (nx - x0) * k, baseline - (ny - base_unit) * k

    if not ink:   # the start dot alone, where the child writes the digit himself
        _start_dots(c, card, tf, cells_h, DOT_ONLY_OPACITY)
        return
    path = c.beginPath()
    for s in card["strokes"]:
        draw_path(path, s["d"], tf)
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
    for i, s in enumerate(card["strokes"]):
        n = _nums(s["d"])
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
        for ch in text:
            if style is not None:
                draw_digit(c, cards[ch], col_x(is_left, col), y,
                           opacity=1.0 if style == "solid" else FADE[0],
                           dashed=style == "dashed",
                           start_dot=dots == "all" or (dots == "solid" and style == "solid"))
            col += 1
        col += gap
