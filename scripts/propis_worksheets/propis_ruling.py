"""Standalone copy of ../../make_lined_paper_landscape_standard.py, scoped
to the propis_worksheets pipeline ONLY -- the root script is also used by
notebooks.py for the separately-sold "Тетрадь — стандарт РФ" blank
notebook product, so it can't be changed here without also changing that
already-shipped product, which nobody asked for.

Two changes from the root "стандарт" script, both confirmed with the
user 2026-08-19:

1. Same 20mm diagonal-line spacing as "стандарт" (not "плотная"'s dense
   3mm) -- the dense diagonal lines are visual noise for this notebook's
   actual purpose (letter/word shape and connection, not slant drilling).

2. The horizontal narrow/wide cycle's vertical PHASE is shifted -6mm (the
   pattern starts at y=-6 instead of y=0) so page.py can fit 17 practice
   rows per page instead of 16, with a safe margin on BOTH page edges --
   not just "however much happens to fall out of starting the pattern at
   y=0". page.py's leftover 18mm (210mm page height isn't an exact
   multiple of the 12mm narrow+wide cycle) splits into a 12mm margin at
   the top and 6mm at the bottom -- sized against every real captured
   letter's own measured ink bounds at render.py's ROW_MM=25 (corrected
   2026-08-19 from 20 -- see render.py's own comment): the tallest
   ascender ("Й") needs 9.89mm, the deepest descender ("р") needs
   3.53mm, so 12mm/6mm leaves a real buffer on both sides rather than
   the tighter, scale-dependent -3mm/9mm-9mm split this shift replaced
   (computed when ROW_MM was still 20 -- re-deriving it after the ROW_MM
   fix, instead of reusing the old numbers, is why this isn't still
   symmetric).

   page.py's own _thick_line_ys() must stay in sync with this exact
   shift (its SHIFT_MM constant) -- this script only draws the grid,
   page.py's row_baselines() decides where content sits on it, and if
   the two ever disagree, letters render off whatever physical line
   they're supposed to sit on.
"""

from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import math

narrow_spacing = 4        # мм - узкая вспомогательная зона
wide_spacing = 8          # мм - широкая рабочая зона
spacing_diagonal = 20     # мм - стандарт российских школ
angle_from_vertical = 65  # градусов
margin = 15               # мм - поля
vertical_shift = -6       # мм - see module docstring point 2; must match page.py's SHIFT_MM

output_file = 'lined_paper_A4_landscape_propis.pdf'

page_width = 297 * mm
page_height = 210 * mm
center = page_width / 2

angle_rad = math.radians(90 - angle_from_vertical)
tan_angle = math.tan(angle_rad)

c = canvas.Canvas(output_file, pagesize=landscape(A4))

c.setTitle("Propis Worksheets Ruling - A4 Landscape")
c.setAuthor("Mironium TEAM")
c.setSubject("Standard Russian copybook, 20mm diagonal spacing, propis_worksheets row phase")
c.setCreator("Mironium TEAM")

# Фон
c.setFillColorRGB(1, 1, 1)
c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

# 1. Горизонтальные линии (сдвинутая фаза -- см. docstring)
c.setStrokeColorRGB(0.55, 0.62, 0.72)

for x_offset_mm in [0, 148.5]:
    x_offset = x_offset_mm * mm
    y = vertical_shift * mm
    pattern_index = 0
    while y < page_height:
        if pattern_index % 2 == 0:
            y += narrow_spacing * mm
            c.setLineWidth(0.3)
        else:
            y += wide_spacing * mm
            c.setLineWidth(1.3)
        if 0 <= y < page_height:
            c.line(x_offset, y, x_offset + 148 * mm, y)
        pattern_index += 1

# 2. Наклонные линии (стандарт 20мм)
c.setStrokeColorRGB(0.55, 0.62, 0.72)
c.setLineWidth(0.3)

x = -page_height * tan_angle
x_end = page_width + page_height * tan_angle + 50 * mm
while x < x_end:
    c.line(x, 0, x + page_height * tan_angle, page_height)
    x += spacing_diagonal * mm

# 3. Красные линии полей
c.setStrokeColorRGB(0.8, 0.2, 0.2)
c.setLineWidth(0.6)
c.line(margin * mm, 0, margin * mm, page_height)
c.line(page_width - margin * mm, 0, page_width - margin * mm, page_height)

# 4. Белая разделительная линия
c.setStrokeColorRGB(1, 1, 1)
c.setLineWidth(3)
c.line(center, 0, center, page_height)

# 5. Скобы степлера
c.setFillColorRGB(0.23, 0.23, 0.23)
c.setStrokeColorRGB(0.2, 0.2, 0.2)
c.setLineWidth(0.1)
staple_spacing = 6 * mm
slot_width = 1.2 * mm
slot_height = 2.5 * mm

for y_staple in [page_height - 45 * mm, 45 * mm]:
    c.roundRect(center - slot_width / 2,
                y_staple - staple_spacing / 2 - slot_height / 2,
                slot_width, slot_height, 0.3 * mm, fill=1, stroke=1)
    c.roundRect(center - slot_width / 2,
                y_staple + staple_spacing / 2 - slot_height / 2,
                slot_width, slot_height, 0.3 * mm, fill=1, stroke=1)
    c.setStrokeColorRGB(0.6, 0.6, 0.6)
    c.setLineWidth(0.2)
    c.setStrokeAlpha(0.3)
    for dy in [-staple_spacing / 2, staple_spacing / 2]:
        c.ellipse(center - 2 * mm, y_staple + dy - 1.5 * mm,
                  center + 2 * mm, y_staple + dy + 1.5 * mm, fill=0, stroke=1)
    c.setStrokeAlpha(1)
    c.setFillColorRGB(0.23, 0.23, 0.23)
    c.setStrokeColorRGB(0.2, 0.2, 0.2)
    c.setLineWidth(0.1)

# 6. Copyright и URL
c.setFillColorRGB(0.6, 0.6, 0.6)
c.setFont("Helvetica", 7)
c.drawString(center - 60 * mm, 3 * mm, "© Mironium")
c.drawString(center + 30 * mm, 3 * mm, "mironium.com")

c.setFillColorRGB(0.85, 0.85, 0.85)
c.setFont("Helvetica", 4)
description = (
    f"Propis worksheets copybook ruling. Format: A4 landscape 297x210mm two-page spread. "
    f"Horizontal lines: {narrow_spacing}mm and {wide_spacing}mm alternating, "
    f"phase-shifted {vertical_shift}mm. Diagonal lines: {spacing_diagonal}mm spacing "
    f"at {angle_from_vertical} degrees. Red margin lines: {margin}mm from edges. "
    f"Creator: Mironium TEAM. Website: mironium.com."
)
c.drawString(150 * mm, 1 * mm, description)

c.save()
print(f"Готово: {output_file}")
