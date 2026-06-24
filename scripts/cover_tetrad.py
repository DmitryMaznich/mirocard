#!/usr/bin/env python3
"""
cover_tetrad.py — обложка тетради «Любимая мама»

A4 landscape (297×210 мм):
  левая половина  — прописи + стихотворение (ClassRoomCursive)
  правая половина — бланк ТЕТРАДЬ

Запуск: python scripts/cover_tetrad.py

Структура прописей (из SortCaseView.jsx, SVG-пространство L1=10 L2=62 L3=88 L4=140 VBH=150):
  - Узкая строка (рабочая зона): L2→L3 = 26 ед.  — сюда идёт текст
  - Широкая строка (межстрочный интервал): L3→L4 = 52 ед. — пустое место
  - Соотношение 1:2 (узкая:широкая)
  - ROW_PITCH = 26 + 52 = 78 ед.
  - Только 2 сплошные линии на строку: baseline (L3, тёмная) + top (L2, светлая)
  - Никаких пунктиров
  - Косые линии 65°, шаг 80/600 × ширину строки
"""

from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os, math

# ── Метрики ───────────────────────────────────────────────────────────────────
MM = 2.8346472
PAGE_W, PAGE_H = landscape(A4)   # 841.89 × 595.28 pt
HALF_W = PAGE_W / 2

# ── Шрифты ───────────────────────────────────────────────────────────────────
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(SCRIPTS_DIR)
CURSIVE     = "ClassRoomCursive"
pdfmetrics.registerFont(TTFont(CURSIVE, os.path.join(ROOT_DIR, "ClassRoomCursive.ttf")))

REG, BOLD = "Helvetica", "Helvetica-Bold"
for r_path, b_path in [
    ("C:/Windows/Fonts/arial.ttf",   "C:/Windows/Fonts/arialbd.ttf"),
    ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]:
    try:
        pdfmetrics.registerFont(TTFont("FR", r_path))
        pdfmetrics.registerFont(TTFont("FB", b_path))
        REG, BOLD = "FR", "FB"
        break
    except Exception:
        pass

# ── Цвета (из SortCaseView.jsx) ───────────────────────────────────────────────
# C_LINE_BASE = "#2a82a0" — baseline (L3), тёмная
# C_LINE_TOP  = "#6ab4cc" — верх рабочей зоны (L2), светлая
# C_DIAG      = "#b8d8e8" — косые линии
C_LINE_BASE = (0.165, 0.510, 0.627)
C_LINE_TOP  = (0.416, 0.706, 0.800)
C_DIAG      = (0.722, 0.847, 0.910)

# ── Параметры прописей (1:2 — узкая:широкая) ─────────────────────────────────
# SVG-пропорция: узкая = 26 ед., широкая = 52 ед., pitch = 78 ед.
NARROW_H = 5  * MM   # узкая рабочая строка (узкая)
WIDE_H   = 10 * MM   # межстрочный интервал (широкая)
PITCH    = NARROW_H + WIDE_H  # = 15 мм

DIAG_ANG  = 65         # угол косых от горизонтали (°), из кода
# Шаг косых: в SVG = 80 из 600 (ширина 6 слотов) = 13.3% ширины строки

# ── Поля левой страницы ───────────────────────────────────────────────────────
L_X0 = 12 * MM
L_X1 = HALF_W - 8 * MM
L_Y0 = 18 * MM
L_Y1 = PAGE_H - 12 * MM


# ═════════════════════════════════════════════════════════════════════════════
# Примитивы прописей
# ═════════════════════════════════════════════════════════════════════════════

def propis_rows(cv, x0, x1, y_first_baseline, n_rows,
                narrow_h=None, pitch=None):
    """
    Рисует n_rows строк правильных прописей.
    y_first_baseline — baseline (L3) первой (верхней) строки.
    Структура: только 2 линии на строку: baseline (тёмная) + top-of-zone (светлая).
    Никаких пунктиров. Широкая строка между рядами — пустое место.
    """
    if narrow_h is None: narrow_h = NARROW_H
    if pitch    is None: pitch    = PITCH
    for i in range(n_rows):
        y_base = y_first_baseline - i * pitch   # L3 — baseline (нижняя линия)
        y_top  = y_base + narrow_h              # L2 — верх рабочей зоны (верхняя линия)
        # Baseline — тёмнее
        cv.setStrokeColorRGB(*C_LINE_BASE)
        cv.setLineWidth(0.65)
        cv.line(x0, y_base, x1, y_base)
        # Верх зоны — светлее
        cv.setStrokeColorRGB(*C_LINE_TOP)
        cv.setLineWidth(0.45)
        cv.line(x0, y_top, x1, y_top)


def diag_lines(cv, x0, x1, y0, y1, step=None):
    """Косые линии прописей 65°, clipped к прямоугольнику."""
    h   = y1 - y0
    dx  = h / math.tan(math.radians(DIAG_ANG))
    if step is None:
        # 80/600 × ширину — аналог SVG-шага
        step = max(6 * MM, (x1 - x0) * 80 / 600)
    cv.saveState()
    p = cv.beginPath()
    p.rect(x0, y0, x1 - x0, h)
    cv.clipPath(p, stroke=0, fill=0)
    cv.setStrokeColorRGB(*C_DIAG)
    cv.setLineWidth(0.3)
    x = x0 - dx
    while x < x1:
        cv.line(x, y0, x + dx, y1)
        x += step
    cv.restoreState()


# ═════════════════════════════════════════════════════════════════════════════
# Левая страница — прописи + стихотворение
# ═════════════════════════════════════════════════════════════════════════════

def left_page(cv):
    cv.setFillColorRGB(1, 1, 1)
    cv.rect(0, 0, HALF_W, PAGE_H, fill=1, stroke=0)

    # ── Размер шрифта: строчные заполняют узкую зону, заглавные — до середины широкой
    # ClassRoomCursive: xHeight=285, capHeight=545 (unitsPerEm=1000)
    # Строчные = NARROW_H (5mm), заглавные = NARROW_H + WIDE_H/2 (≈10mm)
    X_RATIO     = 0.285   # xHeight/em
    FONT_POEM   = round(NARROW_H / X_RATIO)   # = 50pt: строчные=5mm, заглавные≈9.6mm
    FONT_AUTHOR = round(FONT_POEM * 0.77)      # = 38pt

    # ── Геометрия вставки (insert) ────────────────────────────────────────────
    # Строки 0-7: 0=пусто, 1=заголовок, 2-5=стихи, 6=подпись, 7=пусто
    TOTAL_ROWS = 8
    GRID_PAD   = 8 * MM

    # Высота от верха строки 0 до baseline строки 7
    content_h = NARROW_H + (TOTAL_ROWS - 1) * PITCH
    grid_h    = content_h + 2 * GRID_PAD

    # Вставка вертикально отцентрирована на странице
    grid_y_top    = PAGE_H / 2 + grid_h / 2
    grid_y_bottom = PAGE_H / 2 - grid_h / 2

    # Baseline строки 0 (верх строки 0 = grid_y_top - GRID_PAD)
    y_first = grid_y_top - GRID_PAD - NARROW_H

    # ── Рисуем вставку ────────────────────────────────────────────────────────
    # Фон — очень светло-голубой (как листок тетради)
    cv.setFillColorRGB(0.970, 0.978, 1.000)
    cv.rect(L_X0, grid_y_bottom, L_X1 - L_X0, grid_h, fill=1, stroke=0)

    diag_lines(cv, L_X0, L_X1, grid_y_bottom, grid_y_top)
    propis_rows(cv, L_X0, L_X1, y_first, TOTAL_ROWS)

    # Тонкая рамка вставки
    cv.setStrokeColorRGB(*C_LINE_TOP)
    cv.setLineWidth(0.5)
    cv.rect(L_X0, grid_y_bottom, L_X1 - L_X0, grid_h, fill=0, stroke=1)

    cx = (L_X0 + L_X1) / 2

    def ybase(row_idx):
        return y_first - row_idx * PITCH

    # ── Стихотворение ────────────────────────────────────────────────────────

    # Строка 1: заголовок (по центру, зелёный)
    cv.setFont(CURSIVE, FONT_POEM)
    cv.setFillColorRGB(0.05, 0.40, 0.08)
    cv.drawCentredString(cx, ybase(1), "Любимая мама")

    # Строки 2-5: стихи (сразу после заголовка, без пустой строки)
    cv.setFont(CURSIVE, FONT_POEM)
    cv.setFillColorRGB(0.04, 0.08, 0.30)
    poem = [
        "Маму очень я люблю!",
        "Я ей радость подарю,",
        "Буду дома помогать",
        "И пятёрки получать!",
    ]
    for j, line in enumerate(poem):
        cv.drawCentredString(cx, ybase(2 + j), line)

    # Строка 6: подпись — по правому краю, зелёная, чуть мельче
    cv.setFont(CURSIVE, FONT_AUTHOR)
    cv.setFillColorRGB(0.18, 0.38, 0.18)
    cv.drawRightString(L_X1, ybase(6), "Екатерина Каплиева")

    # URL под вставкой
    cv.setFont(REG, 7)
    cv.setFillColorRGB(0.45, 0.45, 0.52)
    cv.drawCentredString(HALF_W / 2, 8 * MM, "www.kaplieva.help")


# ═════════════════════════════════════════════════════════════════════════════
# Правая страница — бланк ТЕТРАДЬ
# ═════════════════════════════════════════════════════════════════════════════

def right_page(cv):
    cv.setFillColorRGB(1, 1, 1)
    cv.rect(HALF_W, 0, HALF_W, PAGE_H, fill=1, stroke=0)

    rx0 = HALF_W + 15 * MM
    rx1 = PAGE_W  - 12 * MM
    rcx = (rx0 + rx1) / 2

    # ── ТЕТРАДЬ ──────────────────────────────────────────────────────────────
    tetrad_y = PAGE_H * 0.58
    cv.setFont(BOLD, 28)
    cv.setFillColorRGB(0, 0, 0)
    cv.drawCentredString(rcx, tetrad_y, "Т Е Т Р А Д Ь")

    # ── Бланк ────────────────────────────────────────────────────────────────
    cv.setFont(REG, 11)
    cv.setFillColorRGB(0.12, 0.12, 0.12)
    cv.setStrokeColorRGB(0.15, 0.15, 0.15)
    cv.setLineWidth(0.55)

    STEP = 14 * MM

    y = tetrad_y - STEP
    cv.drawString(rx0, y, "для")
    cv.line(rx0 + 16 * MM, y, rx1, y)

    y -= STEP
    cv.drawString(rx0, y, "учени")
    cv.line(rx0 + 25 * MM, y, rx0 + 62 * MM, y)
    cv.drawString(rx0 + 64 * MM, y, "класса")
    cv.line(rx0 + 88 * MM, y, rx1, y)

    y -= STEP
    cv.line(rx0, y, rx0 + 38 * MM, y)
    cv.drawString(rx0 + 40 * MM, y, "школы")
    cv.line(rx0 + 60 * MM, y, rx1, y)

    for _ in range(2):
        y -= STEP * 1.4
        cv.line(rx0, y, rx1, y)

    # ── Миниатюра прописей (правый нижний угол) ───────────────────────────────
    th_w = 42 * MM
    th_h = 28 * MM
    th_x0 = rx1 - th_w
    th_y0 = 16 * MM
    th_x1 = rx1
    th_y1 = th_y0 + th_h

    th_pitch  = th_h / 5
    th_narrow  = th_pitch / 3        # 1:2 ratio
    th_y_first = th_y1 - th_narrow   # baseline первой строки миниатюры

    diag_lines(cv, th_x0, th_x1, th_y0, th_y1)
    propis_rows(cv, th_x0, th_x1, th_y_first, 5, narrow_h=th_narrow, pitch=th_pitch)
    cv.setStrokeColorRGB(0.45, 0.55, 0.72)
    cv.setLineWidth(0.5)
    cv.rect(th_x0, th_y0, th_w, th_h, fill=0, stroke=1)

    # ── Логотип + копирайт ────────────────────────────────────────────────────
    logo_path = "C:/Users/dmazn/Projects/Kaplieva/kaplieva_icon.png"
    lx = HALF_W + 12 * MM
    ly = 9  * MM
    ls = 15 * MM
    try:
        cv.drawImage(logo_path, lx, ly, width=ls, height=ls,
                     preserveAspectRatio=True, mask="auto")
        tx = lx + ls + 3 * MM
    except Exception:
        tx = lx
    cv.setFont(REG, 7.5)
    cv.setFillColorRGB(0.28, 0.28, 0.36)
    cv.drawString(tx, ly + 9 * MM,  "www.kaplieva.help")
    cv.drawString(tx, ly + 2.5 * MM, "© Kaplieva.help, 2026. Все права защищены.")


# ═════════════════════════════════════════════════════════════════════════════
# Сборка
# ═════════════════════════════════════════════════════════════════════════════

def main():
    out = os.path.join(ROOT_DIR, "cover_mama.pdf")
    cv = canvas.Canvas(out, pagesize=landscape(A4))

    left_page(cv)
    right_page(cv)

    # Линия сгиба
    cv.setStrokeColorRGB(0.50, 0.50, 0.60)
    cv.setLineWidth(0.30)
    cv.setDash([3, 3])
    cv.line(HALF_W, 0, HALF_W, PAGE_H)
    cv.setDash([])

    # Метки переплёта
    cv.setFillColorRGB(0, 0, 0)
    for fold_y in [PAGE_H * 0.27, PAGE_H * 0.73]:
        cv.rect(HALF_W - 2.5, fold_y - 5, 5, 10, fill=1, stroke=0)

    cv.save()
    print(f"✓  {out}")


if __name__ == "__main__":
    main()
