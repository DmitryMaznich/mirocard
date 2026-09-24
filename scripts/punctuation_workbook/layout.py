"""Page primitives for the punctuation workbook: A5 portrait pages built
top-to-bottom from blocks (title, instruction, ruled row, figure).

Unlike ../propis_worksheets (which overlays content onto one continuous
pre-ruled page), every ruled row here is drawn as part of its own block --
instructions sit between groups of rows, so the ruling can't be one
page-wide grid.

Units: the canvas is scale(mm, mm)'d, every number is mm, y grows up.
Handwriting reuses the real captured propis letters and connectors
(../propis_worksheets/connectors.py) at the same real size as the other
printed propis notebooks (render.py ROW_MM=25 -> x-height 4mm).
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "propis_worksheets"))

from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402

from connectors import build_connectors_by_key, build_variant_index, build_word_trajectory  # noqa: E402
from render import (load_letters_with_variants, load_connectors, _segment_bounds,  # noqa: E402
                    SCALE, LETTER_BASELINE_UNIT)
from svg_path import draw_path  # noqa: E402

from marks import MARKS, draw_mark, mark_bounds  # noqa: E402

# ---- page geometry -------------------------------------------------------
PAGE_W = 148.0
PAGE_H = 210.0
M_INNER = 15.0
M_OUTER = 11.0
M_TOP = 10.0
M_BOTTOM = 11.0
CONTENT_W = PAGE_W - M_INNER - M_OUTER

# ---- ruling --------------------------------------------------------------
# Same school ruling the printed propis notebooks use: 4mm working band
# (baseline -> x-height line), 12mm baseline-to-baseline pitch, so the
# band below each baseline leaves room for descenders and the comma tail.
X_HEIGHT = 4.0
ROW_PITCH = 12.0
ROW_ABOVE = 8.6   # row block height above its baseline (capitals ~8.2mm)
ROW_BELOW = ROW_PITCH - ROW_ABOVE
SLANT_STEP = 20.0

# ---- gray levels (reportlab gray: 0 = black) -----------------------------
BLACK = 0.0     # model
T1 = 0.35       # ~65% black: clear tracing
T2 = 0.58       # ~42% black: lighter tracing
T3 = 0.77       # ~23% black: faint tracing
RULE_BASE = 0.40
RULE_AUX = 0.72
RULE_SLANT = 0.80
TEXT_GRAY = 0.15

LETTER_W = 0.30
WORD_GAP = 4.0          # between words (real cursive, ~1 letter)
MARKS_SET = set(MARKS)

# ---- fonts ---------------------------------------------------------------
FONT, FONT_B = "Helvetica", "Helvetica-Bold"
for reg, bold in (("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
                  ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                   "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
                  ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                   "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")):
    try:
        pdfmetrics.registerFont(TTFont("PwSans", reg))
        pdfmetrics.registerFont(TTFont("PwSans-Bold", bold))
        FONT, FONT_B = "PwSans", "PwSans-Bold"
        break
    except Exception:
        pass
PT = 1 / 2.83465  # one typographic point in mm (canvas is in mm)


class Hand:
    """Captured cursive letters + connectors, loaded once."""

    def __init__(self):
        self.letters = load_letters_with_variants()
        self.connectors = build_connectors_by_key(load_connectors())
        self.variants = build_variant_index(self.letters)
        self._cache = {}

    def word(self, text):
        if text not in self._cache:
            segs = build_word_trajectory(text, self.letters, self.connectors, self.variants)
            b = [_segment_bounds(s) for s in segs]
            self._cache[text] = (segs, min(x[0] for x in b), max(x[1] for x in b))
        return self._cache[text]

    def word_width(self, text):
        _, minx, maxx = self.word(text)
        return (maxx - minx) * SCALE

    def draw_word(self, c, text, x, baseline, gray):
        segs, minx, _ = self.word(text)
        path = c.beginPath()
        for s in segs:
            dx, sy, ty = s["dx"], s["scaleY"], s["translateY"]

            def tf(nx, ny, dx=dx, sy=sy, ty=ty):
                return (x + (nx + dx - minx) * SCALE,
                        baseline - ((ny * sy + ty) - LETTER_BASELINE_UNIT) * SCALE)

            for st in s["strokes"]:
                draw_path(path, st["d"], tf)
        c.saveState()
        c.setStrokeGray(gray)
        c.setLineWidth(LETTER_W)
        c.setLineCap(1)
        c.setLineJoin(1)
        c.drawPath(path, stroke=1, fill=0)
        c.restoreState()


# ---- row content ---------------------------------------------------------
# A row is a list of items laid out left to right:
#   {"w": "хлеб", "g": gray}                       cursive word
#   {"m": ",", "g": gray, "parts": {...}|None,     punctuation mark
#    "attach": bool}                               attach = right after a word
#   {"slot": ","}                                  empty place for a mark
#   {"gap": mm}                                    extra space
# Helpers below build these from plain strings.

def tokens(text):
    """'Ты взял хлеб, сыр?' -> [('w','Ты'),('w','взял'),('w','хлеб'),('m',','),...]"""
    out = []
    for word in text.split():
        core = word.rstrip("".join(MARKS_SET))
        tail = word[len(core):]
        if core:
            out.append(("w", core))
        for ch in tail:
            out.append(("m", ch, bool(core)))
    return out


def text_row(text, g_letters=BLACK, g_marks=None, mark_mode="full"):
    """mark_mode: "full" | "slot" (empty place) | "none" (no mark, no place)."""
    g_marks = g_letters if g_marks is None else g_marks
    items = []
    for t in tokens(text):
        if t[0] == "w":
            items.append({"w": t[1], "g": g_letters})
        elif mark_mode == "slot":
            items.append({"slot": t[1], "attach": t[2]})
        elif mark_mode == "full":
            items.append({"m": t[1], "g": g_marks, "attach": t[2]})
    return items


def marks_row(seq, grays, step, parts=None, start=2.0):
    """Isolated marks every `step` mm. `grays`: one gray or a list per mark
    (None in the list = leave that position empty)."""
    seq = seq.replace(" ", "")
    if not isinstance(grays, (list, tuple)):
        grays = [grays] * len(seq)
    items = []
    for i, ch in enumerate(seq):
        items.append({"at": i * step + start, "m": ch, "g": grays[i], "parts": parts})
    return items


SLOT_W = 3.2
MARK_GAP = {".": 1.0, ",": 1.0, "!": 1.3, "?": 1.0}  # word ink end -> mark anchor


def _place(hand, items):
    """Single layout pass: returns ([(item, x)], right_edge). For words and
    slots x is the left ink edge; for marks it is the mark's anchor (see
    marks.draw_mark)."""
    out = []
    x = 0.0
    prev = None
    for it in items:
        if "at" in it:
            out.append((it, it["at"]))
            x = max(x, it["at"] + mark_bounds(it["m"])[1])
            prev = it
            continue
        if "gap" in it:
            x += it["gap"]
            prev = it
            continue
        attach = it.get("attach")
        if "m" in it:
            minx, maxx = mark_bounds(it["m"])[:2]
            if attach:
                ax = x + MARK_GAP[it["m"]]
            else:
                ax = x + (WORD_GAP if prev is not None else 0.0) - minx
            out.append((it, ax))
            x = ax + maxx
        elif "slot" in it:
            sx = x + (0.8 if attach else (WORD_GAP if prev is not None else 0.0))
            out.append((it, sx))
            x = sx + SLOT_W
        else:  # word
            wx = x + (WORD_GAP if prev is not None else 0.0)
            out.append((it, wx))
            x = wx + hand.word_width(it["w"])
        prev = it
    return out, x


def row_width(hand, items):
    return _place(hand, items)[1]


def draw_row_items(c, hand, items, x0, baseline):
    placed, right = _place(hand, items)
    for it, x in placed:
        if "w" in it:
            hand.draw_word(c, it["w"], x0 + x, baseline, it["g"])
        elif "slot" in it:
            draw_slot(c, x0 + x, baseline)
        elif it.get("g") is not None:
            draw_mark(c, it["m"], x0 + x, baseline, it["g"], it.get("parts"))
    return right


def draw_slot(c, x, baseline):
    """An empty place for a mark: a small dashed box around the baseline,
    tall enough for ! and ? but visibly 'a window', not a mark shape."""
    c.saveState()
    c.setStrokeGray(T2)
    c.setLineWidth(0.22)
    c.setDash(0.6, 0.6)
    c.roundRect(x, baseline - 2.4, SLOT_W, 6.8, 0.8, stroke=1, fill=0)
    c.restoreState()


# ---- page builder --------------------------------------------------------

class Page:
    def __init__(self, c, hand, number):
        self.c = c
        self.hand = hand
        self.number = number
        recto = number % 2 == 1  # page 1 is a right-hand page
        self.x0 = M_INNER if recto else M_OUTER
        self.recto = recto
        self.y = PAGE_H - M_TOP  # current top of free space
        self.warnings = []

    # -- text blocks
    def title(self, text, sub=None):
        c = self.c
        self.y -= 13 * PT * 1.0
        c.setFillGray(0)
        c.setFont(FONT_B, 13 * PT)
        c.drawString(self.x0, self.y, text)
        if sub:
            c.setFillGray(TEXT_GRAY + 0.25)
            c.setFont(FONT, 9 * PT)
            c.drawRightString(self.x0 + CONTENT_W, self.y, sub)
        self.y -= 3.0
        c.setStrokeGray(RULE_AUX)
        c.setLineWidth(0.25)
        c.line(self.x0, self.y, self.x0 + CONTENT_W, self.y)
        self.y -= 2.0

    def note(self, text, space_before=2.0):
        c = self.c
        self.y -= space_before + 9.5 * PT * 0.8
        c.setFillGray(TEXT_GRAY)
        c.setFont(FONT, 9.5 * PT)
        c.drawString(self.x0, self.y, text)
        self.y -= 1.2

    def space(self, mm):
        self.y -= mm

    # -- ruled rows
    def _ruling(self, baseline, x_from=None, x_to=None):
        c = self.c
        xa = self.x0 if x_from is None else x_from
        xb = self.x0 + CONTENT_W if x_to is None else x_to
        top = baseline + ROW_ABOVE - 1.0
        bot = baseline - ROW_BELOW + 0.6
        c.saveState()
        # slant guides, clipped to the row block
        p = c.beginPath()
        p.rect(xa, bot, xb - xa, top - bot)
        c.clipPath(p, stroke=0, fill=0)
        c.setStrokeGray(RULE_SLANT)
        c.setLineWidth(0.15)
        k = 0.46630765815  # tan 25deg
        xs = xa - (top - bot) * k
        while xs < xb:
            c.line(xs, bot, xs + (top - bot) * k, top)
            xs += SLANT_STEP
        c.restoreState()
        c.setStrokeGray(RULE_AUX)
        c.setLineWidth(0.2)
        c.line(xa, baseline + X_HEIGHT, xb, baseline + X_HEIGHT)
        c.setStrokeGray(RULE_BASE)
        c.setLineWidth(0.3)
        c.line(xa, baseline, xb, baseline)

    def row(self, items=(), indent=0.0):
        """One ruled row; returns its baseline."""
        baseline = self.y - ROW_ABOVE
        self._ruling(baseline)
        if items:
            w = row_width(self.hand, items)
            if indent + w > CONTENT_W - 1.0:
                self.warnings.append(f"p{self.number}: row overflows ({indent + w:.1f} > {CONTENT_W:.1f} mm)")
            draw_row_items(self.c, self.hand, items, self.x0 + indent + 1.5, baseline)
        self.y -= ROW_PITCH
        return baseline

    def rows(self, n):
        for _ in range(n):
            self.row()

    def prompt_row(self, label, items=()):
        """Row with a small printed prompt at the left (e.g. a sequence
        spelled out in words) and ruled space to the right."""
        baseline = self.y - ROW_ABOVE
        self._ruling(baseline)
        c = self.c
        ly = baseline + X_HEIGHT + 1.6
        lw = pdfmetrics.stringWidth(label, FONT, 8 * PT)
        c.setFillGray(1)
        c.rect(self.x0 + 0.8, ly - 0.8, lw + 1.4, 3.6, stroke=0, fill=1)
        c.setFillGray(TEXT_GRAY + 0.2)
        c.setFont(FONT, 8 * PT)
        c.drawString(self.x0 + 1.5, ly, label)
        if items:
            draw_row_items(self.c, self.hand, items, self.x0 + 1.5, baseline)
        self.y -= ROW_PITCH
        return baseline

    # -- small enlarged "how to write it" figure
    def figure(self, entries, scale=2.2):
        """entries: list of (mark, label). Each mark is drawn `scale`x on
        its own short piece of ruling, label to the right, side by side."""
        c = self.c
        baseline = self.y - 1.0 - 7.2 * scale
        x = self.x0
        band = 9.0  # enlarged ruling length, in unscaled mm
        for ch, label in entries:
            c.saveState()
            c.translate(x, baseline)
            c.scale(scale, scale)
            c.setStrokeGray(RULE_AUX)
            c.setLineWidth(0.2 / scale)
            c.line(0, X_HEIGHT, band, X_HEIGHT)
            c.setStrokeGray(RULE_BASE)
            c.setLineWidth(0.3 / scale)
            c.line(0, 0, band, 0)
            draw_mark(c, ch, band / 2 - 0.4, 0, BLACK)
            c.restoreState()
            lx = x + band * scale + 2.5
            c.setFillGray(TEXT_GRAY)
            c.setFont(FONT, 9 * PT)
            c.drawString(lx, baseline + X_HEIGHT * scale / 2 - 1.0, label)
            x = lx + pdfmetrics.stringWidth(label, FONT, 9 * PT) + 7.0
        self.y = baseline - 2.4 * scale - 1.0

    def finish(self):
        c = self.c
        if self.y < M_BOTTOM:
            self.warnings.append(f"p{self.number}: content overflows bottom margin by {M_BOTTOM - self.y:.1f} mm")
        c.setFillGray(0.35)
        c.setFont(FONT, 8 * PT)
        y = M_BOTTOM - 5.5
        if self.recto:
            c.drawRightString(self.x0 + CONTENT_W, y, str(self.number))
        else:
            c.drawString(self.x0, y, str(self.number))
        return self.warnings
