#!/usr/bin/env python3
"""
cover_tetrad.py — обложка тетради «Любимая мама»

A4 landscape (297×210 мм):
  левая половина  — прописи + стихотворение (ClassRoomCursive)
  правая половина — бланк ТЕТРАДЬ

Запуск: python scripts/cover_tetrad.py
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

# ── Цвета прописей ────────────────────────────────────────────────────────────
C_SOLID = (0.38, 0.52, 0.78)   # сплошные линии L1 / L4
C_DASH  = (0.62, 0.74, 0.90)   # пунктирные  L2 / L3
C_DIAG  = (0.74, 0.83, 0.94)   # косые линии

# ── Параметры строки прописей ─────────────────────────────────────────────────
PITCH       = 10 * MM   # шаг: L1 → следующей L1
ROW_H       = 8  * MM   # высота зоны L1 → L4
Z_BOT       = 2  * MM   # L1 → L2  (нижняя зона)
Z_MID       = 4  * MM   # L2 → L3  (основная зона)
Z_TOP       = 2  * MM   # L3 → L4  (верхняя зона)
DIAG_STEP   = 6  * MM   # шаг между косыми линиями
DIAG_ANG    = 65        # угол косых от горизонтали (°)

# ── Поля левой страницы ───────────────────────────────────────────────────────
L_X0 = 12 * MM
L_X1 = HALF_W - 8 * MM
L_Y0 = 18 * MM
L_Y1 = PAGE_H - 12 * MM


# ═════════════════════════════════════════════════════════════════════════════
# Примитивы прописей
# ═════════════════════════════════════════════════════════════════════════════

def propis_rows(cv, x0, x1, y_top_l1, n_rows, pitch=None, row_h=None):
    """Рисует n_rows строк прописей; y_top_l1 — L1 самой верхней строки."""
    if pitch   is None: pitch   = PITCH
    if row_h   is None: row_h   = ROW_H
    zb = row_h * 0.25
    zm = row_h * 0.50
    zt = row_h * 0.25
    for i in range(n_rows):
        y1 = y_top_l1 - i * pitch          # L1 (baseline)
        y2 = y1 + zb                        # L2
        y3 = y2 + zm                        # L3
        y4 = y3 + zt                        # L4
        cv.setStrokeColorRGB(*C_SOLID); cv.setLineWidth(0.55)
        cv.line(x0, y1, x1, y1)            # L1
        cv.setStrokeColorRGB(*C_DASH); cv.setLineWidth(0.30)
        cv.setDash([1.8, 1.8])
        cv.line(x0, y2, x1, y2)            # L2 пунктир
        cv.line(x0, y3, x1, y3)            # L3 пунктир
        cv.setDash([])
        cv.setStrokeColorRGB(*C_SOLID); cv.setLineWidth(0.55)
        cv.line(x0, y4, x1, y4)            # L4


def diag_lines(cv, x0, x1, y0, y1):
    """Рисует косые линии прописей внутри прямоугольника (x0,y0)–(x1,y1)."""
    h  = y1 - y0
    dx = h / math.tan(math.radians(DIAG_ANG))   # сдвиг по X при Δy = h
    cv.saveState()
    p = cv.beginPath()
    p.rect(x0, y0, x1 - x0, h)
    cv.clipPath(p, stroke=0, fill=0)
    cv.setStrokeColorRGB(*C_DIAG)
    cv.setLineWidth(0.25)
    x = x0 - dx
    while x < x1:
        cv.line(x, y0, x + dx, y1)
        x += DIAG_STEP
    cv.restoreState()


# ═════════════════════════════════════════════════════════════════════════════
# Левая страница — прописи + стихотворение
# ═════════════════════════════════════════════════════════════════════════════

def left_page(cv):
    cv.setFillColorRGB(1, 1, 1)
    cv.rect(0, 0, HALF_W, PAGE_H, fill=1, stroke=0)

    # Первая строка: L4 совпадает с L_Y1, L1 = L_Y1 - ROW_H
    y0 = L_Y1 - ROW_H
    n  = int((y0 - L_Y0) / PITCH) + 1

    diag_lines(cv, L_X0, L_X1, L_Y0, L_Y1)
    propis_rows(cv, L_X0, L_X1, y0, n)

    cx = (L_X0 + L_X1) / 2

    def ybase(row_idx):
        """L2 (базовая линия письма) строки row_idx, 0 = самая верхняя."""
        return y0 - row_idx * PITCH + Z_BOT

    # ── Стихотворение ────────────────────────────────────────────────────────

    # Заголовок
    cv.setFont(CURSIVE, 24)
    cv.setFillColorRGB(0.05, 0.40, 0.08)
    cv.drawCentredString(cx, ybase(1), "Любимая мама")

    # Строфа
    cv.setFont(CURSIVE, 22)
    cv.setFillColorRGB(0.04, 0.08, 0.30)
    poem = [
        "Маму очень я люблю!",
        "Я ей радость подарю,",
        "Буду дома помогать",
        "И пятёрки получать!",
    ]
    for j, line in enumerate(poem):
        cv.drawCentredString(cx, ybase(3 + j), line)

    # Подпись автора
    cv.setFont(CURSIVE, 18)
    cv.setFillColorRGB(0.18, 0.38, 0.18)
    cv.drawCentredString(cx, ybase(n - 3), "Екатерина Каплиева")

    # URL
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
    th_row_h  = th_pitch * 0.78
    th_y_top  = th_y1 - th_row_h

    diag_lines(cv, th_x0, th_x1, th_y0, th_y1)
    propis_rows(cv, th_x0, th_x1, th_y_top, 5, pitch=th_pitch, row_h=th_row_h)
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
