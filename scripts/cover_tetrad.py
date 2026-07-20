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
import os, sys, math

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

# Nunito ExtraBold — тот же шрифт, что и в приложении (@fontsource/nunito, вес 800),
# сконвертирован из woff2 в ttf через fontTools (assets/fonts/Nunito-ExtraBold.ttf).
NUNITO = "NunitoExtraBold"
pdfmetrics.registerFont(TTFont(NUNITO, os.path.join(ROOT_DIR, "assets", "fonts", "Nunito-ExtraBold.ttf")))

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

# ── Алфавит (для варианта --variant=alphabet) ─────────────────────────────────
ALPHABET_UPPER = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
ALPHABET_LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
ALPHABET_PAIRS = [u + l for u, l in zip(ALPHABET_UPPER, ALPHABET_LOWER)]


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


def thumbnail_dots(cv, x0, x1, y0, y1, narrow_h, pitch, n_rows):
    """
    Вместо диагональных линий рисует точки на верхних линиях каждой строки
    (как в варианте «вспомогательные точки»).
    """
    TAN     = math.tan(math.radians(90 - DIAG_ANG))  # tan(25°) ≈ 0.4663
    step_d  = 2.5 * MM   # шаг диагоналей в миниатюре
    dot_r   = 0.32 * MM

    # x_start-позиции, которые могут пересечь миниатюру
    x_starts = []
    xs = x0 - y1 * TAN
    while xs < x1:
        x_starts.append(xs)
        xs += step_d

    cv.setFillColorRGB(0.4, 0.45, 0.55)
    for i in range(n_rows):
        y_base = y1 - narrow_h - i * pitch
        y_top  = y_base + narrow_h
        if y_top < y0:
            break
        for xs in x_starts:
            xi = xs + y_top * TAN
            if x0 <= xi <= x1:
                cv.circle(xi, y_top, dot_r, fill=1, stroke=0)


# ═════════════════════════════════════════════════════════════════════════════
# Левая страница — общая сетка прописей + подвал
# ═════════════════════════════════════════════════════════════════════════════

TOTAL_ROWS = 6
GRID_SCALE = 0.8   # все вертикальные параметры блока × 0.8
X_RATIO    = 0.285 # xHeight/em (ClassRoomCursive)


def _propis_grid(cv):
    """
    Рисует сетку прописей (диагонали + линии) по центру левой страницы
    и возвращает (ybase_fn, cx, max_w, font_max) для последующей раскладки текста.
    """
    narrow_h = NARROW_H * GRID_SCALE   # 5mm → 4mm
    pitch_l  = PITCH    * GRID_SCALE   # 15mm → 12mm
    grid_pad = 5 * MM * GRID_SCALE     # 4mm

    content_h = narrow_h + (TOTAL_ROWS - 1) * pitch_l
    grid_h    = content_h + 2 * grid_pad

    grid_y_top    = PAGE_H / 2 + grid_h / 2
    grid_y_bottom = PAGE_H / 2 - grid_h / 2
    y_first = grid_y_top - grid_pad - narrow_h

    diag_lines(cv, L_X0, L_X1, grid_y_bottom, grid_y_top)
    propis_rows(cv, L_X0, L_X1, y_first, TOTAL_ROWS,
                narrow_h=narrow_h, pitch=pitch_l)

    def ybase(row_idx):
        return y_first - row_idx * pitch_l

    cx      = (L_X0 + L_X1) / 2
    max_w   = (L_X1 - L_X0) * 0.94   # небольшой запас от краёв
    font_max = round(narrow_h / X_RATIO)   # 40pt

    return ybase, cx, max_w, font_max


def _logo_footer(cv):
    """Лого + копирайт — левый нижний угол левой страницы."""
    # Инверсия icon-512.png: navy-фон + белый силуэт (вместо белый-фон + navy-силуэт),
    # сгенерирована один раз в assets/images/mironium-icon-inverse.png.
    logo_path = os.path.join(ROOT_DIR, "assets", "images", "mironium-icon-inverse.png")
    lx = L_X0
    ly = 9 * MM
    ls = 15 * MM
    try:
        cv.drawImage(logo_path, lx, ly, width=ls, height=ls,
                     preserveAspectRatio=True, mask="auto")
        tx = lx + ls + 3 * MM
    except Exception:
        tx = lx
    cv.setFont(NUNITO, 10)
    cv.setFillColorRGB(0.290, 0.565, 0.886)   # #4a90e2 — брендовый синий Mironium
    cv.drawString(tx, ly + 9 * MM, "Mironium")
    cv.setFont(REG, 7.5)
    cv.setFillColorRGB(0.28, 0.28, 0.36)
    cv.drawString(tx, ly + 2.5 * MM, "© Mironium, 2026. Все права защищены.")


# ═════════════════════════════════════════════════════════════════════════════
# Левая страница — вариант «стихотворение»
# ═════════════════════════════════════════════════════════════════════════════

def left_page(cv):
    cv.setFillColorRGB(1, 1, 1)
    cv.rect(0, 0, HALF_W, PAGE_H, fill=1, stroke=0)

    ybase, cx, _max_w, font_max = _propis_grid(cv)
    font_author = round(font_max * 0.77)   # 31pt

    # Строка 0: заголовок (по центру, зелёный)
    cv.setFont(CURSIVE, font_max)
    cv.setFillColorRGB(0.05, 0.40, 0.08)
    cv.drawCentredString(cx, ybase(0), "Любимая мама")

    # Строки 1-4: стихи
    cv.setFont(CURSIVE, font_max)
    cv.setFillColorRGB(0.04, 0.08, 0.30)
    poem = [
        "Маму очень я люблю!",
        "Я ей радость подарю,",
        "Буду дома помогать",
        "И пятёрки получать!",
    ]
    for j, line in enumerate(poem):
        cv.drawCentredString(cx, ybase(1 + j), line)

    # Строка 5: подпись — по правому краю, зелёная, чуть мельче
    cv.setFont(CURSIVE, font_author)
    cv.setFillColorRGB(0.18, 0.38, 0.18)
    cv.drawRightString(L_X1, ybase(5), "Екатерина Каплиева")

    _logo_footer(cv)


# ═════════════════════════════════════════════════════════════════════════════
# Левая страница — вариант «алфавит»
# ═════════════════════════════════════════════════════════════════════════════

def _alphabet_rows(pairs, sizes):
    rows, i = [], 0
    for n in sizes:
        rows.append(" ".join(pairs[i:i + n]))
        i += n
    assert i == len(pairs), f"{i} != {len(pairs)}"
    return rows


def left_page_alphabet(cv):
    cv.setFillColorRGB(1, 1, 1)
    cv.rect(0, 0, HALF_W, PAGE_H, fill=1, stroke=0)

    ybase, cx, max_w, font_max = _propis_grid(cv)

    # Строка 0: заголовок (по центру, зелёный)
    cv.setFont(CURSIVE, font_max)
    cv.setFillColorRGB(0.05, 0.40, 0.08)
    cv.drawCentredString(cx, ybase(0), "Алфавит")

    # Строки 1-5: 33 пары «Аа Бб Вв...» — 7/7/7/6/6 пар на строку
    cv.setFillColorRGB(0.04, 0.08, 0.30)
    rows = _alphabet_rows(ALPHABET_PAIRS, [7, 7, 7, 6, 6])
    for j, row_text in enumerate(rows):
        size = font_max
        while size > 10 and pdfmetrics.stringWidth(row_text, CURSIVE, size) > max_w:
            size -= 1
        cv.setFont(CURSIVE, size)
        cv.drawCentredString(cx, ybase(1 + j), row_text)

    _logo_footer(cv)


# ═════════════════════════════════════════════════════════════════════════════
# Правая страница — бланк ТЕТРАДЬ
# ═════════════════════════════════════════════════════════════════════════════

def right_page(cv, style="плотная"):
    cv.setFillColorRGB(1, 1, 1)
    cv.rect(HALF_W, 0, HALF_W, PAGE_H, fill=1, stroke=0)

    # Поля, измеренные из оригинального PDF (rx0=HALF_W+30mm, rx1=PAGE_W-20mm)
    rx0 = HALF_W + 30 * MM   # 506pt — совпадает с оригиналом
    rx1 = PAGE_W  - 20 * MM  # 785pt — совпадает с оригиналом
    rcx_tet = (HALF_W + PAGE_W) / 2  # 631pt — центр правой половины (для ТЕТРАДЬ)

    # ── ТЕТРАДЬ ──────────────────────────────────────────────────────────────
    tetrad_y = PAGE_H * 0.589   # 351pt — из оригинала
    cv.setFont(BOLD, 20)
    cv.setFillColorRGB(0, 0, 0)
    cv.drawCentredString(rcx_tet, tetrad_y, "Т Е Т Р А Д Ь")

    # Подзаголовок
    cv.setFont(REG, 10)
    cv.setFillColorRGB(0.25, 0.25, 0.25)
    cv.drawCentredString(rcx_tet, tetrad_y - 19, "для прописей")

    # ── Поля ─────────────────────────────────────────────────────────────────
    cv.setFont(REG, 11)
    cv.setFillColorRGB(0.12, 0.12, 0.12)
    cv.setStrokeColorRGB(0.15, 0.15, 0.15)
    cv.setLineWidth(0.55)

    GAP = 5   # отступ между концом метки и началом линии (pt)

    def field(y, label):
        lw = pdfmetrics.stringWidth(label, REG, 11)
        cv.drawString(rx0, y, label)
        cv.line(rx0 + lw + GAP, y, rx1, y)

    y = tetrad_y - 62     # Имя
    field(y, "Имя")

    y -= 33               # Фамилия
    field(y, "Фамилия")

    y -= 31               # Начата
    field(y, "Начата")

    # ── Миниатюра прописей (правый нижний угол, половинный размер, скруглённые углы) ──
    th_w = 21 * MM
    th_h = 14 * MM
    th_r = 2  * MM      # радиус скругления
    th_x1 = rx1
    th_x0 = th_x1 - th_w
    th_y0 = 16 * MM
    th_y1 = th_y0 + th_h

    th_pitch  = th_h / 5
    th_narrow = th_pitch / 3
    th_y_first = th_y1 - th_narrow

    # Клип в форме скруглённого прямоугольника для содержимого
    K = 0.5523  # bezier-аппроксимация четверти окружности
    cv.saveState()
    rp = cv.beginPath()
    rp.moveTo(th_x0 + th_r, th_y0)
    rp.lineTo(th_x1 - th_r, th_y0)
    rp.curveTo(th_x1 - th_r*(1-K), th_y0,      th_x1, th_y0 + th_r*(1-K), th_x1, th_y0 + th_r)
    rp.lineTo(th_x1, th_y1 - th_r)
    rp.curveTo(th_x1, th_y1 - th_r*(1-K),      th_x1 - th_r*(1-K), th_y1, th_x1 - th_r, th_y1)
    rp.lineTo(th_x0 + th_r, th_y1)
    rp.curveTo(th_x0 + th_r*(1-K), th_y1,      th_x0, th_y1 - th_r*(1-K), th_x0, th_y1 - th_r)
    rp.lineTo(th_x0, th_y0 + th_r)
    rp.curveTo(th_x0, th_y0 + th_r*(1-K),      th_x0 + th_r*(1-K), th_y0, th_x0 + th_r, th_y0)
    rp.close()
    cv.clipPath(rp, stroke=0, fill=0)
    if style == "точки":
        propis_rows(cv, th_x0, th_x1, th_y_first, 5, narrow_h=th_narrow, pitch=th_pitch)
        thumbnail_dots(cv, th_x0, th_x1, th_y0, th_y1, th_narrow, th_pitch, 5)
    else:
        diag_step = 3 * MM if style == "плотная" else 7 * MM
        diag_lines(cv, th_x0, th_x1, th_y0, th_y1, step=diag_step)
        propis_rows(cv, th_x0, th_x1, th_y_first, 5, narrow_h=th_narrow, pitch=th_pitch)
    cv.restoreState()

    # Скруглённая рамка поверх содержимого
    cv.setStrokeColorRGB(0.45, 0.55, 0.72)
    cv.setLineWidth(0.5)
    cv.roundRect(th_x0, th_y0, th_w, th_h, th_r, fill=0, stroke=1)


# ═════════════════════════════════════════════════════════════════════════════
# Сборка
# ═════════════════════════════════════════════════════════════════════════════

def main():
    style   = "плотная"
    variant = "poem"
    for arg in sys.argv[1:]:
        if arg.startswith("--style="):
            style = arg.split("=", 1)[1]
        elif arg.startswith("--variant="):
            variant = arg.split("=", 1)[1]

    suffix = "" if variant == "poem" else f"_{variant}"
    out = os.path.join(ROOT_DIR, f"cover_{style}{suffix}.pdf")
    cv = canvas.Canvas(out, pagesize=landscape(A4))

    if variant == "alphabet":
        left_page_alphabet(cv)
    else:
        left_page(cv)
    right_page(cv, style=style)

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
