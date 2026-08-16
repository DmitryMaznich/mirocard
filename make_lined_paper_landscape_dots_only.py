from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import math

# ============================================================
# ПАРАМЕТРЫ
# ============================================================
narrow_spacing = 4       # мм - узкая вспомогательная зона
wide_spacing = 8         # мм - широкая рабочая зона
spacing_diagonal = 3     # мм - частые наклонные
angle_from_vertical = 65 # градусов
margin = 15              # мм - поля
dot_radius = 0.5         # мм - радиус точек

output_file = 'lined_paper_A4_landscape_dots_only.pdf'
# ============================================================

page_width = 297 * mm
page_height = 210 * mm
center = page_width / 2
left_bound = margin * mm
right_bound = page_width - margin * mm

angle_rad = math.radians(90 - angle_from_vertical)
tan_angle = math.tan(angle_rad)

c = canvas.Canvas(output_file, pagesize=landscape(A4))

c.setTitle("Lined Paper A4 Landscape Dots Only - Kaplieva Center")
c.setAuthor("Kaplieva Center TEAM")
c.setSubject("Russian copybook lined paper with starting dots only, no trace segments")
c.setCreator("Kaplieva Center TEAM")

# Фон
c.setFillColorRGB(1, 1, 1)
c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

# 1. Горизонтальные линии + собираем верхние линии строк
c.setStrokeColorRGB(0.55, 0.62, 0.72)
top_line_positions = []

for x_offset_mm in [0, 148.5]:
    x_offset = x_offset_mm * mm
    y = 0
    pattern_index = 0
    while y < page_height:
        if pattern_index % 2 == 0:
            y += narrow_spacing * mm
            c.setLineWidth(0.3)
            if y < page_height:
                top_line_positions.append(y)  # верхняя линия рабочей зоны
        else:
            y += wide_spacing * mm
            c.setLineWidth(1.3)
        if y < page_height:
            c.line(x_offset, y, x_offset + 148*mm, y)
        pattern_index += 1

top_line_positions = sorted(set(top_line_positions))

# 2. Наклонные линии - единые для всей страницы
c.setStrokeColorRGB(0.55, 0.62, 0.72)
c.setLineWidth(0.3)

diagonal_x_starts = []
x = -page_height * tan_angle
x_end = page_width + page_height * tan_angle + 50*mm
while x < x_end:
    c.line(x, 0, x + page_height * tan_angle, page_height)
    diagonal_x_starts.append(x)
    x += spacing_diagonal * mm

# 3. Точки на верхней линии строки (только в рабочей зоне между полями)
c.setFillColorRGB(0.4, 0.45, 0.55)
for y_top in top_line_positions:
    for x_start in diagonal_x_starts:
        x_intersect = x_start + y_top * tan_angle
        if left_bound <= x_intersect <= right_bound:
            c.circle(x_intersect, y_top, dot_radius * mm, fill=1, stroke=0)

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
c.drawString(center + 30*mm, 3*mm, "mironium.com")

c.setFillColorRGB(0.85, 0.85, 0.85)
c.setFont("Helvetica", 4)
description = (
    f"Russian copybook lined paper with starting dots only. Format: A4 landscape 297x210mm. "
    f"Horizontal lines: {narrow_spacing}mm and {wide_spacing}mm alternating. "
    f"Diagonal lines: {spacing_diagonal}mm at {angle_from_vertical} degrees. "
    f"Dots at top line intersections within margins. Creator: Kaplieva Center TEAM. Website: mironium.com."
)
c.drawString(150*mm, 1*mm, description)

c.save()
print(f"Готово: {output_file}")
