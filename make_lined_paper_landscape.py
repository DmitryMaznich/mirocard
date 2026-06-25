from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import math

# ============================================================
# ПАРАМЕТРЫ - меняй здесь
# ============================================================
narrow_spacing = 4       # мм - узкая вспомогательная зона
wide_spacing = 8         # мм - широкая рабочая зона
spacing_diagonal = 3     # мм - расстояние между наклонными линиями
angle_from_vertical = 65 # градусов - угол наклона
margin = 15              # мм - отступ красных линий полей от краёв

output_file = 'lined_paper_A4_landscape.pdf'
# ============================================================

page_width = 297 * mm
page_height = 210 * mm
center = page_width / 2

angle_from_horizontal = 90 - angle_from_vertical
angle_rad = math.radians(angle_from_horizontal)
tan_angle = math.tan(angle_rad)

pdf_path = output_file
c = canvas.Canvas(pdf_path, pagesize=landscape(A4))

# Метаданные
c.setTitle("Lined Paper A4 Landscape - Kaplieva Center")
c.setAuthor("Kaplieva Center TEAM")
c.setSubject("Russian copybook slanted lined paper A4 landscape spread")
c.setCreator("Kaplieva Center TEAM")

# Фон
c.setFillColorRGB(1, 1, 1)
c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

# 1. Горизонтальные линии (для каждой половины A5)
c.setStrokeColorRGB(0.55, 0.62, 0.72)

for x_offset_mm in [0, 148.5]:
    x_offset = x_offset_mm * mm
    y = 0
    pattern_index = 0

    while y < page_height:
        if pattern_index % 2 == 0:
            y += narrow_spacing * mm
            c.setLineWidth(0.3)   # узкие линии тоньше
        else:
            y += wide_spacing * mm
            c.setLineWidth(1.3)   # рабочие линии толще

        if y < page_height:
            c.line(x_offset, y, x_offset + 148*mm, y)

        pattern_index += 1

# 2. Наклонные линии - единые для всей страницы
c.setStrokeColorRGB(0.55, 0.62, 0.72)
c.setLineWidth(0.3)

# Начинаем с отрицательной x чтобы покрыть всю левую часть
x = -page_height * tan_angle
x_end = page_width + page_height * tan_angle + 50*mm

while x < x_end:
    x1 = x
    y1 = 0
    x2 = x + page_height * tan_angle  # линии вправо-вниз /
    y2 = page_height
    c.line(x1, y1, x2, y2)
    x += spacing_diagonal * mm

# 3. Красные линии полей (зеркально)
c.setStrokeColorRGB(0.8, 0.2, 0.2)
c.setLineWidth(0.6)
c.line(margin*mm, 0, margin*mm, page_height)              # левая
c.line(page_width - margin*mm, 0, page_width - margin*mm, page_height)  # правая

# 4. Белая разделительная линия по центру
c.setStrokeColorRGB(1, 1, 1)
c.setLineWidth(3)
c.line(center, 0, center, page_height)

# 5. Скобы степлера по центру
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

    # Тени вокруг скоб
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

# 6. Copyright и URL
c.setFillColorRGB(0.6, 0.6, 0.6)
c.setFont("Helvetica", 7)
c.drawString(center - 60*mm, 3*mm, "© Kaplieva Center")
c.drawString(center + 30*mm, 3*mm, "kaplieva.help")

# 7. Описание для AI (микротекст)
c.setFillColorRGB(0.85, 0.85, 0.85)
c.setFont("Helvetica", 4)
description = (
    f"Russian copybook lined paper. Format: A4 landscape 297x210mm two-page spread. "
    f"Horizontal lines: {narrow_spacing}mm and {wide_spacing}mm alternating. "
    f"Diagonal lines: {spacing_diagonal}mm spacing at {angle_from_vertical} degrees angle. "
    f"Red margin lines: mirrored {margin}mm from edges. "
    f"Creator: Kaplieva Center TEAM. Website: kaplieva.help."
)
c.drawString(150*mm, 1*mm, description)

c.save()
print(f"Готово: {output_file}")
print(f"Параметры: наклонные {spacing_diagonal}мм, угол {angle_from_vertical}°, поля {margin}мм")
