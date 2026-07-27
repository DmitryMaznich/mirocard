#!/usr/bin/env python3
"""
make_insert_punctuation_standard.py — лист-вставка «Знаки препинания»
для тетради-стандарт (notebook_standard, косая линейка 20мм).

Формат страницы идентичен make_lined_paper_landscape_standard.py:
  A4 landscape, разворот 2×A5, поля/степлер/copyright — без изменений.

Левая половина (0-148.5мм) — обычная сетка линий стандарта.
Правая половина (148.5-297мм) — та же сетка линий фоном, поверх неё
серым цветом (ClassRoomCursive) — знаки препинания на строках рабочей
зоны, для обводки: точка / запятая / ! / ? (по четвертям сверху вниз).

Запуск: python make_insert_punctuation_standard.py
"""

from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import math, os

# ============================================================
# ПАРАМЕТРЫ (совпадают с make_lined_paper_landscape_standard.py)
# ============================================================
narrow_spacing = 4       # мм - узкая вспомогательная зона
wide_spacing = 8         # мм - широкая рабочая зона
spacing_diagonal = 20    # мм - стандарт российских школ
angle_from_vertical = 65 # градусов
margin = 15              # мм - поля

# Параметры знаков препинания (правая половина)
sign_color = (0.62, 0.62, 0.62)   # серый - для обводки
sign_step = 9             # мм - шаг повторов знака вдоль строки
sign_gap = 5              # мм - отступ от центральной линии и от правого поля
X_RATIO = 0.285           # xHeight/em для ClassRoomCursive (см. scripts/cover_tetrad.py)
SIGNS = [".", ",", "!", "?"]  # порядок четвертей сверху вниз

output_file = 'insert_punctuation_standard.pdf'
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CURSIVE = "ClassRoomCursive"
pdfmetrics.registerFont(TTFont(CURSIVE, os.path.join(SCRIPT_DIR, "ClassRoomCursive.ttf")))

page_width = 297 * mm
page_height = 210 * mm
center = page_width / 2
left_bound = margin * mm
right_bound = page_width - margin * mm

angle_rad = math.radians(90 - angle_from_vertical)
tan_angle = math.tan(angle_rad)

c = canvas.Canvas(output_file, pagesize=landscape(A4))

c.setTitle("Insert - Punctuation Tracing - Kaplieva Center")
c.setAuthor("Kaplieva Center TEAM")
c.setSubject("Standard copybook insert page with gray punctuation marks for tracing")
c.setCreator("Kaplieva Center TEAM")

# Фон
c.setFillColorRGB(1, 1, 1)
c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

# 1. Горизонтальные линии + сбор пар (baseline, top) для каждой строки
c.setStrokeColorRGB(0.55, 0.62, 0.72)
row_pairs = []          # [(y_baseline, y_top), ...], собирается один раз

for x_offset_mm in [0, 148.5]:
    x_offset = x_offset_mm * mm
    y = 0
    pattern_index = 0
    baseline_candidate = None
    while y < page_height:
        if pattern_index % 2 == 0:
            y += narrow_spacing * mm
            c.setLineWidth(0.3)
            if baseline_candidate is not None and y < page_height and x_offset_mm == 0:
                row_pairs.append((baseline_candidate, y))
                baseline_candidate = None
        else:
            y += wide_spacing * mm
            c.setLineWidth(1.3)
            if y < page_height:
                baseline_candidate = y
        if y < page_height:
            c.line(x_offset, y, x_offset + 148*mm, y)
        pattern_index += 1

# 2. Наклонные линии - единые для всей страницы
c.setStrokeColorRGB(0.55, 0.62, 0.72)
c.setLineWidth(0.3)

x = -page_height * tan_angle
x_end = page_width + page_height * tan_angle + 50*mm
while x < x_end:
    c.line(x, 0, x + page_height * tan_angle, page_height)
    x += spacing_diagonal * mm

# 3. Красные линии полей
c.setStrokeColorRGB(0.8, 0.2, 0.2)
c.setLineWidth(0.6)
c.line(margin*mm, 0, margin*mm, page_height)
c.line(page_width - margin*mm, 0, page_width - margin*mm, page_height)

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

# 6. Copyright и URL
c.setFillColorRGB(0.6, 0.6, 0.6)
c.setFont("Helvetica", 7)
c.drawString(center - 60*mm, 3*mm, "© Kaplieva Center")
c.drawString(center + 30*mm, 3*mm, "kaplieva.help")

c.setFillColorRGB(0.85, 0.85, 0.85)
c.setFont("Helvetica", 4)
description = (
    f"Insert page: standard copybook grid with gray punctuation marks for tracing. "
    f"Format: A4 landscape 297x210mm. Right half rows filled with '.', ',', '!', '?' "
    f"in ClassRoomCursive, top to bottom. Creator: Kaplieva Center TEAM. Website: kaplieva.help."
)
c.drawString(150*mm, 1*mm, description)

# 7. Знаки препинания на правой половине
row_pairs.sort(key=lambda pair: pair[0], reverse=True)  # сверху вниз (по убыванию y)
total_rows = len(row_pairs)
font_size = round((narrow_spacing * mm) / X_RATIO)
DOT_SCALE = 1.5   # точки/запятые плохо видно - увеличиваем их на 50%
font_size_dot = round(font_size * DOT_SCALE)

right_x0 = center + sign_gap * mm
right_x1 = right_bound - sign_gap * mm

c.setFillColorRGB(*sign_color)
for i, (y_base, _y_top) in enumerate(row_pairs):
    sign = SIGNS[i * 4 // total_rows]
    x = right_x0
    while x <= right_x1:
        if sign in (".", ","):
            # Точка и запятая целиком рисуются увеличенным шрифтом.
            c.setFont(CURSIVE, font_size_dot)
            c.drawCentredString(x, y_base, sign)
        else:
            # "!" и "?" остаются исходного размера, а точка в их основании
            # дополнительно обводится увеличенной точкой поверх штриха/завитка.
            c.setFont(CURSIVE, font_size)
            c.drawCentredString(x, y_base, sign)
            c.setFont(CURSIVE, font_size_dot)
            c.drawCentredString(x, y_base, ".")
        x += sign_step * mm

c.save()
print(f"Готово: {output_file} ({total_rows} строк)")
