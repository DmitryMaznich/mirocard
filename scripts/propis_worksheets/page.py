"""Draws one A5 letter-practice page's content (ruling + header + practice
rows) onto a reportlab canvas at whatever the canvas's CURRENT local
origin is -- booklet.py is responsible for translating/scaling to the
right A5 slot on the physical A4 sheet before calling draw_letter_page.

Assumes the canvas is already in a "1 unit = 1 mm" local frame (i.e. the
caller has done canvas.scale(mm, mm) upstream) -- every number in this
file is a plain mm value, not points.
"""

import math

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from render import draw_letter, ROW_MM

# reportlab's built-in "Helvetica"/"Helvetica-Bold" have no Cyrillic glyphs
# (headers rendered as solid boxes without this) -- same fallback chain
# scripts/cover_tetrad.py already uses for the same reason.
FONT_REGULAR, FONT_BOLD = "Helvetica", "Helvetica-Bold"
for _reg_path, _bold_path in [
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]:
    try:
        pdfmetrics.registerFont(TTFont("PW-Regular", _reg_path))
        pdfmetrics.registerFont(TTFont("PW-Bold", _bold_path))
        FONT_REGULAR, FONT_BOLD = "PW-Regular", "PW-Bold"
        break
    except Exception:
        pass

PAGE_W_MM = 148.5
PAGE_H_MM = 210.0
MARGIN_MM = 12.0

ROW_TOP_GAP_MM = 10.0  # ascender gap, propisRuling NATIVE_L1->L2
ROW_NARROW_MM = 5.0    # узкая строка, NATIVE_L2->L3 (the working zone)
ROW_BOT_GAP_MM = 10.0  # descender gap, NATIVE_L3->L4 -- sums to ROW_MM (25.0)

ANGLE_DEG = 65.0
DIAGONAL_MM = 20.0
_TAN_ANGLE = math.tan(math.radians(90 - ANGLE_DEG))

GAP_MM = 5.0            # gap between repeated letter instances on a row
TAIL_FRACTION = 0.32    # final fraction of every row left blank, ruled-only

MODEL_OPACITY = 1.0
FADE_OPACITIES = [0.5, 0.5, 0.28, 0.28]  # repetitions 2, 3, 4, 5+ (clamped)


def _opacity_for_index(i):
    if i == 0:
        return MODEL_OPACITY
    return FADE_OPACITIES[min(i - 1, len(FADE_OPACITIES) - 1)]


def draw_ruling(c, usable_w_mm, top_y_mm, row_count):
    """propis's own 10/5/10mm ruling (bold baseline) + 65-degree/20mm
    diagonal guides -- NOT make_lined_paper_landscape_standard.py's
    different 4/8mm notebook scheme (confirmed with the user)."""
    total_h = row_count * ROW_MM
    bottom_y = top_y_mm - total_h

    c.saveState()
    c.setStrokeColorRGB(0.55, 0.62, 0.72)
    for row in range(row_count):
        row_top = top_y_mm - row * ROW_MM
        narrow_top_y = row_top - ROW_TOP_GAP_MM
        baseline_y = narrow_top_y - ROW_NARROW_MM
        descender_y = baseline_y - ROW_BOT_GAP_MM
        c.setLineWidth(0.3)
        c.line(0, row_top, usable_w_mm, row_top)
        c.line(0, descender_y, usable_w_mm, descender_y)
        c.setLineWidth(0.35)
        c.line(0, narrow_top_y, usable_w_mm, narrow_top_y)
        c.setLineWidth(1.0)
        c.line(0, baseline_y, usable_w_mm, baseline_y)

    c.setLineWidth(0.25)
    c.setStrokeAlpha(0.6)
    x = -total_h * _TAN_ANGLE
    x_end = usable_w_mm + total_h * _TAN_ANGLE
    while x < x_end:
        c.line(x, bottom_y, x + total_h * _TAN_ANGLE, top_y_mm)
        x += DIAGONAL_MM
    c.setStrokeAlpha(1)
    c.restoreState()


def draw_row(c, letters_row, row_top_y_mm, usable_w_mm):
    """One practice row: `letters_row` is a list of 1 card (lowercase- or
    uppercase-alone) or 2 cards (the paired row) to repeat together,
    fading per FADE_OPACITIES, stopping at TAIL_FRACTION of the row width
    -- the remainder is left as a blank ruled tail for independent
    writing."""
    baseline_y = row_top_y_mm - ROW_TOP_GAP_MM - ROW_NARROW_MM
    fill_limit_mm = usable_w_mm * (1 - TAIL_FRACTION)

    x = 0.0
    i = 0
    while x < fill_limit_mm:
        opacity = _opacity_for_index(i)
        for card in letters_row:
            width = draw_letter(c, card, x, baseline_y, opacity)
            x += width + GAP_MM
            if x >= fill_limit_mm:
                break
        i += 1


def draw_letter_page(c, group, lower_label, upper_label, letters):
    """One full A5 page: header, then practice rows. A letter with no
    uppercase counterpart (Ъ, Ь -- upper_label is None) gets 4
    lowercase-only rows instead of the standard 2-lower/1-upper/2-paired
    pattern, using the space that would have gone to the missing rows."""
    usable_w_mm = PAGE_W_MM - 2 * MARGIN_MM

    c.saveState()
    c.translate(MARGIN_MM, 0)

    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.setFont(FONT_BOLD, 13)
    header_letters = f"{upper_label}, {lower_label}" if upper_label else lower_label
    c.drawString(0, PAGE_H_MM - MARGIN_MM - 8, f"Группа {group['id']} · {header_letters}")
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.setFont(FONT_REGULAR, 8)
    c.drawString(0, PAGE_H_MM - MARGIN_MM - 16, group["label"])

    lower_card = letters[lower_label]
    if upper_label:
        upper_card = letters[upper_label]
        rows = [[lower_card], [lower_card], [upper_card], [lower_card, upper_card], [lower_card, upper_card]]
    else:
        rows = [[lower_card]] * 4

    content_top = PAGE_H_MM - MARGIN_MM - 24
    draw_ruling(c, usable_w_mm, content_top, len(rows))

    row_top = content_top
    for row_cards in rows:
        draw_row(c, row_cards, row_top, usable_w_mm)
        row_top -= ROW_MM

    c.restoreState()
