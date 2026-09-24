"""Ruling for the punctuation workbook: the same A4-landscape two-page
sheet as ../propis_worksheets/propis_ruling.py (same 4/8mm horizontal
cycle with the same -6mm phase shift, so ../propis_worksheets/page.py's
row_baselines() still lands on the thick lines; same red margins, center
divider, staple marks and footer) -- except the diagonal spacing is chosen
PER A5 HALF, not per sheet:

  "dense"    3mm diagonals ("частая косая") -- pages that drill one mark
             in isolation; the cells give the child a rhythm (a mark every
             N cells) and a rail for the slant of ! and ?.
  "standard" 20mm diagonals -- pages with words/sentences, same as every
             other propis notebook.

Drawn directly (not merged from a pre-rendered ruling PDF, as
../propis_worksheets/booklet.py does) because one printed sheet can carry
one half of each kind after saddle-stitch imposition.

Units: points, unscaled canvas (reportlab default), same as propis_ruling.py.
"""

import math

from reportlab.lib.units import mm

PAGE_W = 297 * mm
PAGE_H = 210 * mm
HALF_W = 148.5 * mm
CENTER = PAGE_W / 2

NARROW_MM = 4
WIDE_MM = 8
VERTICAL_SHIFT_MM = -6       # must match propis_worksheets/page.py SHIFT_MM
MARGIN_MM = 15
ANGLE_FROM_VERTICAL = 65
SLANT = math.tan(math.radians(90 - ANGLE_FROM_VERTICAL))  # dx per dy, 0.466

DIAGONAL_MM = {"dense": 3.0, "standard": 20.0}

# Grid colors. "blue" is the existing propis/notebook ruling color. The
# workbook's blue pen models need to stay distinguishable from the lines
# they run along (a ! stem is parallel to the diagonals), hence the
# neutral options.
PALETTES = {
    "blue": {"h": (0.55, 0.62, 0.72), "d": (0.55, 0.62, 0.72)},
    "gray": {"h": (0.45, 0.45, 0.45), "d": (0.62, 0.62, 0.62)},
    "black": {"h": (0.0, 0.0, 0.0), "d": (0.0, 0.0, 0.0)},
}
DIAGONAL_WIDTH = {"dense": 0.25, "standard": 0.3}  # points


def diagonal_x_mm(k, y_mm, kind, half_offset_mm):
    """Local-slot x (mm) of diagonal number k at height y_mm. Phase is
    global to the sheet (starts at x=-H*tan, as propis_ruling.py does),
    so this is what content code uses to sit marks between two diagonals."""
    s = DIAGONAL_MM[kind]
    x0 = -210 * SLANT
    return x0 + k * s + y_mm * SLANT - half_offset_mm


def _draw_half(c, x_offset, kind, palette):
    col = PALETTES[palette]
    # horizontals (identical loop to propis_ruling.py)
    c.setStrokeColorRGB(*col["h"])
    y = VERTICAL_SHIFT_MM * mm
    i = 0
    while y < PAGE_H:
        if i % 2 == 0:
            y += NARROW_MM * mm
            c.setLineWidth(0.3)
        else:
            y += WIDE_MM * mm
            # Baseline as thin as every other line -- unlike propis_ruling.py's 1.3pt.
            # A captured full stop is ~0.45mm, the same as a 1.3pt line, and sank into
            # it (confirmed with the user 2026-09-24).
            c.setLineWidth(0.3)
        if 0 <= y < PAGE_H:
            c.line(x_offset, y, x_offset + 148 * mm, y)
        i += 1

    # diagonals, clipped to this half
    c.saveState()
    p = c.beginPath()
    p.rect(x_offset, 0, 148 * mm, PAGE_H)
    c.clipPath(p, stroke=0, fill=0)
    c.setStrokeColorRGB(*col["d"])
    c.setLineWidth(DIAGONAL_WIDTH[kind])
    step = DIAGONAL_MM[kind] * mm
    x = -PAGE_H * SLANT
    while x < PAGE_W + 50 * mm:
        if x + PAGE_H * SLANT >= x_offset and x <= x_offset + 148 * mm:
            c.line(x, 0, x + PAGE_H * SLANT, PAGE_H)
        x += step
    c.restoreState()


WATERMARK_TEXT = "Mironium"
WATERMARK_PT = 9
WATERMARK_GAP_MM = 14
WATERMARK_GRAY = 0.80


def _margin_watermark(c, x, angle):
    """Repeats WATERMARK_TEXT along a vertical line at x, rotated `angle`
    degrees (90: reads bottom-to-top on the left page; -90: top-to-bottom
    on the right page, so both face outward), over the full page height."""
    from reportlab.pdfbase.pdfmetrics import stringWidth
    step = stringWidth(WATERMARK_TEXT, "Helvetica-Bold", WATERMARK_PT) + WATERMARK_GAP_MM * mm
    c.saveState()
    c.translate(x, PAGE_H / 2)
    c.rotate(angle)
    c.setFillGray(WATERMARK_GRAY)
    c.setFont("Helvetica-Bold", WATERMARK_PT)
    # centred on the page's mid-height, repeated both ways past the edges
    n = int(PAGE_H / step) // 2 + 2
    for i in range(-n, n + 1):
        c.drawCentredString(i * step, -WATERMARK_PT * 0.35, WATERMARK_TEXT)
    c.restoreState()


def draw_sheet_ruling(c, left_kind, right_kind, palette="gray"):
    c.setFillColorRGB(1, 1, 1)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    _draw_half(c, 0, left_kind, palette)
    _draw_half(c, HALF_W, right_kind, palette)

    # red margins
    c.setStrokeColorRGB(0.8, 0.2, 0.2)
    c.setLineWidth(0.6)
    c.line(MARGIN_MM * mm, 0, MARGIN_MM * mm, PAGE_H)
    c.line(PAGE_W - MARGIN_MM * mm, 0, PAGE_W - MARGIN_MM * mm, PAGE_H)

    # vertical "Mironium" watermark down each outer margin, full page height
    # (user, 2026-09-24). Drawn before the page-number badge, whose white
    # circle then sits on top of it.
    _margin_watermark(c, MARGIN_MM / 2 * mm, 90)
    _margin_watermark(c, PAGE_W - MARGIN_MM / 2 * mm, -90)

    # white center divider
    c.setStrokeColorRGB(1, 1, 1)
    c.setLineWidth(3)
    c.line(CENTER, 0, CENTER, PAGE_H)

    # staple marks
    c.setFillColorRGB(0.23, 0.23, 0.23)
    c.setStrokeColorRGB(0.2, 0.2, 0.2)
    c.setLineWidth(0.1)
    sp, sw, sh = 6 * mm, 1.2 * mm, 2.5 * mm
    for ys in (PAGE_H - 45 * mm, 45 * mm):
        for dy in (-sp / 2, sp / 2):
            c.roundRect(CENTER - sw / 2, ys + dy - sh / 2, sw, sh, 0.3 * mm, fill=1, stroke=1)

    # footer
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.setFont("Helvetica", 7)
    c.drawString(CENTER - 60 * mm, 3 * mm, "© Mironium")
    c.drawString(CENTER + 30 * mm, 3 * mm, "mironium.com")
