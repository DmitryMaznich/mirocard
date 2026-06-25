from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import math

# ============================================================
# ПАРАМЕТРЫ
# ============================================================
narrow_spacing = 4       # мм - узкая вспомогательная зона
wide_spacing = 8         # мм - широкая рабочая зона
spacing_diagonal = 20    # мм - стандарт российских школ
angle_from_vertical = 65 # градусов
margin = 15              # мм - поля

# Поля для имени и даты
name_label = "Имя:"
date_label = "Дата:"
field_height = 6         # мм
field_margin_top = 0.5   # мм от верхнего края

output_file = 'lined_paper_A4_landscape_standard.pdf'
# ============================================================

page_width = 297 * mm
page_height = 210 * mm
center = page_width / 2

angle_rad = math.radians(90 - angle_from_vertical)
tan_angle = math.tan(angle_rad)

c = canvas.Canvas(output_file, pagesize=landscape(A4))

c.setTitle("Russian School Standard Copybook - A4 Landscape")
c.setAuthor("Kaplieva Center TEAM")
c.setSubject("Standard Russian copybook with 20mm diagonal spacing")
c.setCreator("Kaplieva Center TEAM")

# Фон
c.setFillColorRGB(1, 1, 1)
c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

# 1. Поля для имени и даты
field_top_y = page_height - field_margin_top * mm
name_label_x = 15 * mm
name_field_x = name_label_x + 18 * mm
name_field_y = field_top_y - 7 * mm
name_field_width = 50 * mm

date_label_x = name_field_x + name_field_width + 8 * mm
date_field_x = date_label_x + 13 * mm
date_field_y = name_field_y
date_field_width = 35 * mm

c.setStrokeColorRGB(0.55, 0.62, 0.72)
c.setLineWidth(0.5)
c.roundRect(name_field_x, name_field_y, name_field_width, field_height * mm,
            radius=1.5*mm, fill=0, stroke=1)
c.roundRect(date_field_x, date_field_y, date_field_width, field_height * mm,
            radius=1.5*mm, fill=0, stroke=1)

c.setFillColorRGB(0.4, 0.4, 0.4)
c.setFont("Helvetica", 7)
c.drawString(name_label_x, field_top_y - 2*mm, name_label)
c.drawString(date_label_x, field_top_y - 2*mm, date_label)

# 2. Горизонтальные линии
c.setStrokeColorRGB(0.55, 0.62, 0.72)

for x_offset_mm in [0, 148.5]:
    x_offset = x_offset_mm * mm
    y = 0
    pattern_index = 0
    while y < page_height:
        if pattern_index % 2 == 0:
            y += narrow_spacing * mm
            c.setLineWidth(0.3)
        else:
            y += wide_spacing * mm
            c.setLineWidth(1.3)
        if y < page_height:
            c.line(x_offset, y, x_offset + 148*mm, y)
        pattern_index += 1

# 3. Наклонные линии (стандарт 20мм)
c.setStrokeColorRGB(0.55, 0.62, 0.72)
c.setLineWidth(0.3)

x = -page_height * tan_angle
x_end = page_width + page_height * tan_angle + 50*mm
while x < x_end:
    c.line(x, 0, x + page_height * tan_angle, page_height)
    x += spacing_diagonal * mm

# 4. Красные линии полей
c.setStrokeColorRGB(0.8, 0.2, 0.2)
c.setLineWidth(0.6)
c.line(margin*mm, 0, margin*mm, page_height)
c.line(page_width - margin*mm, 0, page_width - margin*mm, page_height)

# 5. Белая разделительная линия
c.setStrokeColorRGB(1, 1, 1)
c.setLineWidth(3)
c.line(center, 0, center, page_height)

# 6. Скобы степлера
c.setFillColorRGB(0.23, 0.23, 0.23)
c.setStrokeColorRGB(0.2, 0.2, 0.2)
c.setLineWidth(0.1)
staple_spacing = 6 * mm
slot_width = 1.2 * mm
slot_height = 2.5 * mm

for y_staple in [page_height - 45*mm, 45*mm]:
    c.roundRect(center - slot_width/2,
                y_staple - staple_spacing/2 - slot_height/2,
                slot_width, slot_height, 0.3*mm, fill=1, stroke=1)
    c.roundRect(center - slot_width/2,
                y_staple + staple_spacing/2 - slot_height/2,
                slot_width, slot_height, 0.3*mm, fill=1, stroke=1)
    c.setStrokeColorRGB(0.6, 0.6, 0.6)
    c.setLineWidth(0.2)
    c.setStrokeAlpha(0.3)
    for dy in [-staple_spacing/2, staple_spacing/2]:
        c.ellipse(center - 2*mm, y_staple + dy - 1.5*mm,
                  center + 2*mm, y_staple + dy + 1.5*mm, fill=0, stroke=1)
    c.setStrokeAlpha(1)
    c.setFillColorRGB(0.23, 0.23, 0.23)
    c.setStrokeColorRGB(0.2, 0.2, 0.2)
    c.setLineWidth(0.1)

# 7. Copyright и URL
c.setFillColorRGB(0.6, 0.6, 0.6)
c.setFont("Helvetica", 7)
c.drawString(center - 60*mm, 3*mm, "© Kaplieva Center")
c.drawString(center + 30*mm, 3*mm, "kaplieva.help")

c.setFillColorRGB(0.85, 0.85, 0.85)
c.setFont("Helvetica", 4)
description = (
    f"Russian school standard copybook. Format: A4 landscape 297x210mm two-page spread. "
    f"Horizontal lines: {narrow_spacing}mm and {wide_spacing}mm alternating. "
    f"Diagonal lines: {spacing_diagonal}mm spacing at {angle_from_vertical} degrees. "
    f"Red margin lines: {margin}mm from edges. Creator: Kaplieva Center TEAM. Website: kaplieva.help."
)
c.drawString(150*mm, 1*mm, description)

c.save()
print(f"Готово: {output_file}")
