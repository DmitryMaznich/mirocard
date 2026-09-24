"""Draws page content for the punctuation workbook, in the same style as
../propis_worksheets notebooks: nothing but blue cursive models on the
ruling -- a full-strength model, fading repetitions (FADE_OPACITIES), a
blank tail, and a taper ("скос") down the bottom half of practice pages.
No printed text on the page at all (confirmed with the user 2026-09-24:
instructions are the teacher's job, the notebook only carries models).

Punctuation shapes are the user's own captured trajectories -- the
`"type": "punctuation"` cards in tools/propis/topic.json, same native
coordinate system as the letters (baseline y=88).

Every function here assumes the canvas is in a scale(mm, mm) frame whose
x=0 is the slot's own left edge (see build.py).
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "propis_worksheets"))

from connectors import build_connectors_by_key, build_variant_index, build_word_trajectory  # noqa: E402
from page import row_baselines, draw_page_number_badge, MARGIN_MM, PAGE_W_MM  # noqa: E402
from render import (TOPIC_JSON, SCALE, LETTER_BASELINE_UNIT, draw_pair,  # noqa: E402
                    load_letters_with_variants, load_connectors, segments_ink_bounds)
from svg_path import draw_path, sample_path  # noqa: E402
from text_layout import WORD_GAP_UNITS  # noqa: E402

from ruling import diagonal_x_mm, DIAGONAL_MM  # noqa: E402

INK = (0.11, 0.30, 0.85)
MODEL_OPACITY = 1.0
FADE_OPACITIES = [0.5, 0.5, 0.28, 0.28]
TAIL_FRACTION = 0.32
LINE_W = 0.275

LEFT_INSET_MM = MARGIN_MM + 2.0     # left slot: hug the red margin
CENTER_INSET_MM = 4.0               # right slot: hug the center divider
CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM

BASELINES = row_baselines()          # 17 rows, top to bottom
ROWS = len(BASELINES)

WORD_GAP_MM = WORD_GAP_UNITS * SCALE
# word's last ink -> mark anchor (the part of the mark touching the line)
MARK_GAP_MM = {".": 1.0, ",": 1.0, "!": 1.7, "?": 1.5}


def opacity_for(i):
    return MODEL_OPACITY if i == 0 else FADE_OPACITIES[min(i - 1, len(FADE_OPACITIES) - 1)]


def _load_marks():
    with open(TOPIC_JSON, encoding="utf-8") as f:
        cards = [c for c in json.load(f)["cards"] if c["type"] == "punctuation"]
    marks = {}
    for card in cards:
        pts = [p for s in card["strokes"] for p in sample_path(s["d"])]
        # Anchor = mean x of the ink that sits at the baseline (the dot of
        # . ! ?, the head of ,): rows of mixed marks line up by the part
        # that touches the line, and a comma's tail is free to reach left.
        near = [x for x, y in pts if 83.0 <= y <= 89.5]
        marks[card["label"]] = {"card": card, "anchor": sum(near) / len(near)}
    return marks


class Ink:
    def __init__(self):
        self.letters = load_letters_with_variants()
        self.connectors = build_connectors_by_key(load_connectors())
        self.variants = build_variant_index(self.letters)
        self.marks = _load_marks()
        self._words = {}

    # -- punctuation
    def draw_mark(self, c, ch, anchor_x, baseline, opacity):
        m = self.marks[ch]
        ax = m["anchor"]

        def tf(nx, ny):
            return anchor_x + (nx - ax) * SCALE, baseline - (ny - LETTER_BASELINE_UNIT) * SCALE

        path = c.beginPath()
        for s in m["card"]["strokes"]:
            draw_path(path, s["d"], tf)
        c.saveState()
        c.setStrokeColorRGB(*INK)
        c.setStrokeAlpha(opacity)
        c.setLineWidth(LINE_W)
        c.setLineCap(1)
        c.setLineJoin(1)
        c.drawPath(path, stroke=1, fill=0)
        c.restoreState()

    def mark_right_mm(self, ch):
        """Ink extent right of the anchor, mm."""
        m = self.marks[ch]
        xs = [x for s in m["card"]["strokes"] for x, _ in sample_path(s["d"])]
        return (max(xs) - m["anchor"]) * SCALE

    # -- words
    def _word(self, text):
        if text not in self._words:
            segs = build_word_trajectory(text, self.letters, self.connectors, self.variants)
            minx, maxx = segments_ink_bounds(segs)
            self._words[text] = (segs, (maxx - minx) * SCALE)
        return self._words[text]

    def sentence_width(self, text):
        return self._layout(text)[1]

    def _layout(self, text):
        """[(kind, value, x)] for a line of text; kind 'w' (x = left ink
        edge) or 'm' (x = mark anchor)."""
        ops, x, first = [], 0.0, True
        for token in text.split():
            core = token.rstrip(".,!?")
            tail = token[len(core):]
            if core:
                if not first:
                    x += WORD_GAP_MM
                ops.append(("w", core, x))
                x += self._word(core)[1]
            for ch in tail:
                ax = x + MARK_GAP_MM[ch]
                ops.append(("m", ch, ax))
                x = ax + self.mark_right_mm(ch)
            first = False
        return ops, x

    def draw_text(self, c, text, x0, baseline, opacity, mark_opacity=None):
        mark_opacity = opacity if mark_opacity is None else mark_opacity
        ops, width = self._layout(text)
        for kind, val, x in ops:
            if kind == "w":
                draw_pair(c, self._word(val)[0], x0 + x, baseline, opacity, color=INK)
            else:
                self.draw_mark(c, val, x0 + x, baseline, mark_opacity)
        return width


# ---- dense-grid pages: marks placed in the diagonal cells ------------------

def grid_points(baseline, inset, half_offset, x_limit):
    """Local x of every point where a dense-grid diagonal crosses this
    row's baseline, left to right, from the content inset up to x_limit."""
    s = DIAGONAL_MM["dense"]
    out = []
    k = int((inset + half_offset) / s) - 80
    while True:
        x = diagonal_x_mm(k, baseline, "dense", half_offset)
        if x > x_limit:
            break
        if x >= inset + 1.0:
            out.append(x)
        k += 1
    return out


# Where a mark sits relative to its grid point (agreed with the user
# 2026-09-24): . ! ? sit ON the diagonal/baseline crossing -- the dot lands
# on the crossing and the stem of ! / ? runs along the diagonal (the
# captured ! stem's slope is the grid's 0.466). The comma sits mid-cell
# instead, so its tail runs between two diagonals, never hidden under one.
MARK_OFFSET_CELLS = {".": 0.0, "!": 0.0, "?": 0.0, ",": 0.5}


def mark_row(ink, c, group, baseline, inset, half_offset, max_groups=None,
             inner_step=2, group_step=4):
    """One practice row on the dense grid: `group` (e.g. "," or ".,,.") is
    repeated left to right -- marks `inner_step` cells apart inside a
    group, `group_step` cells between the last mark of one group and the
    first of the next -- first group full strength, later ones fading,
    stopping at the TAIL_FRACTION blank tail (or after max_groups)."""
    limit = inset + CONTENT_W_MM * (1 - TAIL_FRACTION)
    cells = grid_points(baseline, inset, half_offset, inset + CONTENT_W_MM)
    cell = DIAGONAL_MM["dense"]
    ci, gi = 0, 0
    while True:
        if max_groups is not None and gi >= max_groups:
            break
        need = ci + inner_step * (len(group) - 1)
        if need >= len(cells) or cells[need] > limit:
            break
        for j, ch in enumerate(group):
            x = cells[ci + inner_step * j] + MARK_OFFSET_CELLS[ch] * cell
            ink.draw_mark(c, ch, x, baseline, opacity_for(gi))
        ci = need + group_step
        gi += 1
    return gi


def title_row(ink, c, text, inset):
    """The mark's name in cursive on the page's first row (user, 2026-09-24:
    children hear "точка", "запятая"... all the time but never see the word
    written). Just the one word, solid -- dashed/fading tracing variants
    were tried and rejected as overcomplicated."""
    ink.draw_text(c, text, inset, BASELINES[0], MODEL_OPACITY)


def practice_page(ink, c, rows, inset, half_offset, first_sample_row=None, title=None):
    """Top half: full rows. Bottom half: taper -- each row one group fewer
    than the row above (propis_worksheets' "скос"). Rows from
    first_sample_row on: a short rhythm template -- the model plus one
    faded repeat, so the step to keep is visible (a lone model doesn't
    show it; user, 2026-09-24) -- rest blank."""
    baselines = BASELINES
    if title:
        title_row(ink, c, title, inset)
        baselines = BASELINES[1:]
    middle = len(baselines) // 2
    full = None
    for r, (baseline, spec) in enumerate(zip(baselines, rows)):
        if spec is None:
            continue
        group, kw = (spec, {}) if isinstance(spec, str) else spec
        if first_sample_row is not None and r >= first_sample_row:
            mark_row(ink, c, group, baseline, inset, half_offset, max_groups=2, **kw)
        elif r < middle:
            full = mark_row(ink, c, group, baseline, inset, half_offset, **kw)
        else:
            cap = max((full or 6) - (r - middle + 1), 1)
            mark_row(ink, c, group, baseline, inset, half_offset, max_groups=cap, **kw)


# ---- standard-grid pages: words and sentences ------------------------------

def text_page(ink, c, rows, inset, warnings, page_no):
    """rows: list (top to bottom) of None or (text, opacity[, mark_opacity])."""
    for baseline, spec in zip(BASELINES, rows):
        if not spec:
            continue
        w = ink.draw_text(c, spec[0], inset, baseline, *spec[1:])
        if inset + w > inset + CONTENT_W_MM + 2:
            warnings.append(f"p{page_no}: '{spec[0]}' is {w:.0f}mm, row is {CONTENT_W_MM:.0f}mm")


def page_number(c, n, align):
    draw_page_number_badge(c, n, align)
