"""
Генерирует PDF «День 1»:
  Страница 1 — план дня
  Страница 2 — список покупок со сворачиваемыми категориями

Использование:
  python scripts/export_day1_plan.py            → day1_plan.pdf
  python scripts/export_day1_plan.py --no-shop  → только план дня
"""

import os, sys, re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

# ── Fonts ──────────────────────────────────────────────────────────────────────
FONTS_DIR = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Segoe",     os.path.join(FONTS_DIR, "segoeui.ttf")))
pdfmetrics.registerFont(TTFont("SegoeBold", os.path.join(FONTS_DIR, "segoeuib.ttf")))

# ── Geometry ───────────────────────────────────────────────────────────────────
W, H   = A4
ML     = 18 * mm
MR     = 18 * mm
MT     = 20 * mm
MB     = 16 * mm
TW     = W - ML - MR

# ── Palette ────────────────────────────────────────────────────────────────────
GREEN_DARK  = (0.13, 0.32, 0.28)
GREEN_MID   = (0.22, 0.52, 0.44)
GREEN_LIGHT = (0.82, 0.95, 0.91)
GREY_DARK   = (0.10, 0.10, 0.10)
GREY_MID    = (0.38, 0.38, 0.38)
GREY_LIGHT  = (0.88, 0.88, 0.88)
WHITE       = (1.0, 1.0, 1.0)

# ── Путь к файлу покупок ───────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(__file__)
SHOPPING_TXT = os.path.join(BASE_DIR, "..", "content", "shopping", "shopping.txt")
OUTPUT       = os.path.join(BASE_DIR, "..", "day1_plan.pdf")


# ═══════════════════════════════════════════════════════════════════════════════
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ═══════════════════════════════════════════════════════════════════════════════

def wrap(cv, text, font, size, max_w):
    """Перенос текста; возвращает список строк."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if cv.stringWidth(trial, font, size) > max_w:
            if cur:
                lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines or [""]


def draw_rounded_rect(cv, x, y, w, h, r, fill_color, stroke=False):
    """Заливка прямоугольника с закруглёнными углами."""
    cv.setFillColorRGB(*fill_color)
    p = cv.beginPath()
    p.moveTo(x + r, y)
    p.lineTo(x + w - r, y)
    p.arcTo(x + w - 2*r, y, x + w, y + 2*r, 270, 90)
    p.lineTo(x + w, y + h - r)
    p.arcTo(x + w - 2*r, y + h - 2*r, x + w, y + h, 0, 90)
    p.lineTo(x + r, y + h)
    p.arcTo(x, y + h - 2*r, x + 2*r, y + h, 90, 90)
    p.lineTo(x, y + r)
    p.arcTo(x, y, x + 2*r, y + 2*r, 180, 90)
    p.close()
    cv.drawPath(p, fill=1, stroke=1 if stroke else 0)


# ═══════════════════════════════════════════════════════════════════════════════
# СТРАНИЦА 1: ПЛАН ДНЯ
# ═══════════════════════════════════════════════════════════════════════════════

DAY_PLAN = {
    "day_num":  "1",
    "date":     "ЧЕТВЕРГ, 11 ИЮНЯ 2026",
    "subtitle": "Заезд",
    "start":    "Начало в 11:00",
    "adults": [
        ("↑ Катя",  "12:00"),
        ("↑ Миша",  "12:00"),
        ("Дима",    None),
    ],
    "children": [
        ("↑ Маша",  None),
        ("Мирон",   "дома"),
        ("Алекс",   "~23:00"),
        ("Сергей",  "~23:00"),
    ],
    "activities": [
        ("🌟", "Приезд Маши, Кати и Миши",
               "Мирон встречает гостей"),
        ("🏠", "Размещение и знакомство с правилами дома",
               "Мирон, Маша"),
        ("📱", "Самостоятельное составление списка для покупок в приложении",
               "Мирон, Маша"),
        ("🛒", "Поход в магазин (список)",
               "Мирон, Маша · пешком"),
        ("🍳", "Приготовление обеда по инструкции на планшете",
               "Чевапчичи на гриле · Овощной салат (по приложению)"),
        ("🍽", "Обед",
               "Мирон, Маша"),
        ("🧹", "Уборка кухни",
               "Мирон, Маша"),
        ("📚", "Разбор гардероба",
               "Мирон, Маша"),
        ("🔨", "Тренировка жизненно важных навыков",
               "Мирон, Маша"),
        ("🥗", "Приготовление ужина по инструкции на планшете",
               "Крылышки в духовке · Жареная картошка"),
        ("🍽", "Ужин",
               "Мирон, Маша"),
        ("🧹", "Уборка кухни",
               "Мирон, Маша"),
        ("💬", "Разговоры о важном",
               "Мирон, Маша"),
        ("📞", "Рубрика «Позвоните родителям»",
               "Мирон, Маша"),
        ("🕺", "Сельская дискотека 90-х",
               "Мирон, Маша"),
        ("🛁", "Мытьё и коллективная деградация по интересам",
               "Мирон, Маша"),
        ("💤", "Отбой",
               "Мирон, Маша"),
    ],
}


def draw_day_plan(cv):
    plan = DAY_PLAN
    y = H - MT

    # ── Большой заголовок ДЕНЬ N ──────────────────────────────────────────────
    # Фоновый блок
    header_h = 28 * mm
    cv.setFillColorRGB(*GREEN_DARK)
    cv.rect(0, H - header_h, W, header_h, fill=1, stroke=0)

    # «ДЕНЬ» + номер
    cv.setFillColorRGB(*WHITE)
    cv.setFont("SegoeBold", 13)
    cv.drawString(ML, H - MT - 3, "ДЕНЬ")
    cv.setFont("SegoeBold", 38)
    cv.drawString(ML + 21 * mm, H - MT - 1, plan["day_num"])

    # Дата — справа
    cv.setFont("Segoe", 11)
    date_w = cv.stringWidth(plan["date"], "Segoe", 11)
    cv.drawString(W - MR - date_w, H - MT - 3, plan["date"])

    y = H - header_h - 5 * mm

    # ── Подзаголовок ──────────────────────────────────────────────────────────
    cv.setFont("SegoeBold", 13)
    cv.setFillColorRGB(*GREEN_DARK)
    cv.drawString(ML, y, plan["subtitle"])
    y -= 5 * mm

    cv.setFont("Segoe", 10)
    cv.setFillColorRGB(*GREY_MID)
    cv.drawString(ML, y, plan["start"])
    y -= 6 * mm

    # ── Горизонтальный разделитель ───────────────────────────────────────────
    cv.setStrokeColorRGB(*GREY_LIGHT)
    cv.setLineWidth(0.5)
    cv.line(ML, y, W - MR, y)
    y -= 5 * mm

    # ── Блок взрослые / дети ──────────────────────────────────────────────────
    half = (TW - 6 * mm) / 2
    for title, people, x_start in [
        ("ВЗРОСЛЫЕ", plan["adults"],   ML),
        ("ДЕТИ",     plan["children"], ML + half + 6 * mm),
    ]:
        bx, by = x_start, y - 14 * mm
        # фон
        cv.setFillColorRGB(*GREEN_LIGHT)
        cv.roundRect(bx, by, half, 14 * mm, 2 * mm, fill=1, stroke=0)

        # заголовок
        cv.setFillColorRGB(*GREEN_DARK)
        cv.setFont("SegoeBold", 8)
        cv.drawString(bx + 3 * mm, by + 9 * mm, title)

        # участники
        cv.setFont("Segoe", 8.5)
        cv.setFillColorRGB(*GREY_DARK)
        px = bx + 3 * mm
        parts = []
        for name, note in people:
            if note is None:
                parts.append(name)
            elif note.startswith("~"):
                parts.append(f"{name} {note}")
            else:
                parts.append(f"{name} ({note})")
        line = "  ".join(parts)
        lines = wrap(cv, line, "Segoe", 8.5, half - 6 * mm)
        for i, ln in enumerate(lines[:2]):
            cv.drawString(px, by + 4.5 * mm - i * 3.5 * mm, ln)

    y -= 20 * mm

    # ── Активности ───────────────────────────────────────────────────────────
    icon_size  = 11
    title_size = 10
    sub_size   = 8.5
    item_gap   = 1 * mm      # зазор между активностями

    for emoji, title, participants in plan["activities"]:
        if y < MB + 10 * mm:
            cv.showPage()
            y = H - MT

        # emoji
        cv.setFont("Segoe", icon_size)
        cv.setFillColorRGB(*GREEN_MID)
        cv.drawString(ML, y, emoji)

        # Текст заголовка активности (перенос)
        title_x = ML + 8 * mm
        title_w = TW - 8 * mm
        title_lines = wrap(cv, title, "SegoeBold", title_size, title_w)
        cv.setFont("SegoeBold", title_size)
        cv.setFillColorRGB(*GREY_DARK)
        lh = title_size * 1.45
        cv.drawString(title_x, y, title_lines[0])
        for j, tl in enumerate(title_lines[1:], 1):
            cv.drawString(title_x, y - j * lh, tl)

        y -= len(title_lines) * lh

        # Участники
        cv.setFont("Segoe", sub_size)
        cv.setFillColorRGB(*GREY_MID)
        cv.drawString(title_x, y, participants)
        y -= sub_size * 1.5 + item_gap

    cv.showPage()


# ═══════════════════════════════════════════════════════════════════════════════
# СТРАНИЦА 2: СПИСОК ПОКУПОК СО СВОРАЧИВАЕМЫМИ КАТЕГОРИЯМИ
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORY_ICONS = [
    "🥦", "🍎", "🍓", "🌿", "🌾",
    "🥩", "🐟", "🥤", "🥛", "🧴",
    "🍬", "🍞", "🥫", "🧊", "🐾",
]


def parse_shopping_txt(path):
    """Разбирает shopping.txt → список (название, [элементы])."""
    categories = []
    cur_name = None
    cur_items = []
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip()
            if not line:
                continue
            # «N. Название:» или «N. Название»
            m = re.match(r"^\d+\.\s+(.+?):\s*$", line) or re.match(r"^\d+\.\s+(.+)$", line)
            if m:
                if cur_name is not None:
                    categories.append((cur_name, cur_items))
                cur_name  = m.group(1).rstrip(":")
                cur_items = []
            elif line.startswith("- ") and cur_name is not None:
                cur_items.append(line[2:].strip())
    if cur_name is not None:
        categories.append((cur_name, cur_items))
    return categories


def draw_shopping_list(cv, shopping_path):
    y = H - MT
    categories = parse_shopping_txt(shopping_path)

    # ── Шапка ────────────────────────────────────────────────────────────────
    # Фоновый блок
    header_h = 18 * mm
    cv.setFillColorRGB(*GREEN_DARK)
    cv.rect(0, H - header_h, W, header_h, fill=1, stroke=0)
    cv.setFillColorRGB(*WHITE)
    cv.setFont("SegoeBold", 16)
    cv.drawString(ML, H - MT - 1, "🛒  СПИСОК ПОКУПОК")
    cv.setFont("Segoe", 9)
    cv.setFillColorRGB(0.75, 0.95, 0.89)
    hint = "Нажми на категорию → разверни список → отмечай нужное"
    cv.drawRightString(W - MR, H - MT - 1, hint)

    y = H - header_h - 7 * mm

    # ── Двухколоночный макет категорий ───────────────────────────────────────
    COL_GAP  = 5 * mm
    COL_W    = (TW - COL_GAP) / 2
    col_x    = [ML, ML + COL_W + COL_GAP]
    col_y    = [y, y]

    HEADER_H  = 8.5 * mm   # высота заголовка категории
    ITEM_H    = 5.5 * mm   # высота одной строки товара
    CAT_GAP   = 4 * mm     # пробел между категориями

    for i, (name, items) in enumerate(categories):
        icon = CATEGORY_ICONS[i] if i < len(CATEGORY_ICONS) else "📦"

        # Нужная высота: заголовок + items + отступ
        card_h = HEADER_H + len(items) * ITEM_H + 2 * mm

        # Выбор колонки — берём ту, что выше (больше y)
        c = 0 if col_y[0] >= col_y[1] else 1
        cx = col_x[c]
        cy = col_y[c]

        if cy - card_h < MB:
            # Выходим за поля — новая страница
            cv.showPage()
            col_y = [H - MT, H - MT]
            cy = col_y[c]

        card_top = cy

        # ── Заголовок категории (аккордеон-шапка) ────────────────────────────
        # Фон шапки
        draw_rounded_rect(cv,
                          cx, card_top - HEADER_H,
                          COL_W, HEADER_H,
                          2 * mm, GREEN_DARK)

        # Иконка
        cv.setFont("Segoe", 11)
        cv.setFillColorRGB(*WHITE)
        cv.drawString(cx + 2.5 * mm, card_top - HEADER_H + 2.5 * mm, icon)

        # Название категории
        cv.setFont("SegoeBold", 10)
        cv.setFillColorRGB(*WHITE)
        cat_lines = wrap(cv, name, "SegoeBold", 10, COL_W - 20 * mm)
        cv.drawString(cx + 9 * mm, card_top - HEADER_H + 2.8 * mm, cat_lines[0])

        # Стрелка «▼» — визуальный индикатор разворачивания
        cv.setFont("Segoe", 9)
        cv.setFillColorRGB(*GREEN_LIGHT)
        cv.drawRightString(cx + COL_W - 2 * mm,
                           card_top - HEADER_H + 2.8 * mm, "▼")

        # Кол-во товаров (маленький бейдж)
        badge_txt = str(len(items))
        badge_w   = cv.stringWidth(badge_txt, "SegoeBold", 7) + 4 * mm
        bx = cx + COL_W - 2 * mm - 6 * mm - badge_w
        draw_rounded_rect(cv,
                          bx, card_top - HEADER_H + 1.5 * mm,
                          badge_w, 5 * mm,
                          1.5 * mm, GREEN_MID)
        cv.setFont("SegoeBold", 7)
        cv.setFillColorRGB(*WHITE)
        cv.drawCentredString(bx + badge_w / 2,
                             card_top - HEADER_H + 2.8 * mm, badge_txt)

        # ── Список товаров ──────────────────────────────────────────────────
        # Фон списка
        cv.setFillColorRGB(0.97, 0.99, 0.98)
        cv.rect(cx, card_top - card_h,
                COL_W, card_h - HEADER_H + 0.3 * mm,
                fill=1, stroke=0)

        # Граница карточки снизу
        cv.setStrokeColorRGB(*GREY_LIGHT)
        cv.setLineWidth(0.4)
        cv.rect(cx, card_top - card_h, COL_W, card_h, fill=0, stroke=1)

        item_y = card_top - HEADER_H - ITEM_H * 0.15
        for item in items:
            item_y -= ITEM_H
            # Чекбокс
            cb_size = 3 * mm
            cb_x = cx + 2.5 * mm
            cb_y = item_y + 0.5 * mm
            cv.setFillColorRGB(*WHITE)
            cv.setStrokeColorRGB(*GREY_MID)
            cv.setLineWidth(0.6)
            cv.roundRect(cb_x, cb_y, cb_size, cb_size, 0.5 * mm, fill=1, stroke=1)

            # Текст товара
            cv.setFont("Segoe", 8.5)
            cv.setFillColorRGB(*GREY_DARK)
            item_lines = wrap(cv, item, "Segoe", 8.5, COL_W - 9 * mm)
            cv.drawString(cx + 7.5 * mm, item_y + 1.2 * mm, item_lines[0])

        col_y[c] = card_top - card_h - CAT_GAP

    cv.showPage()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    no_shop = "--no-shop" in sys.argv

    cv = canvas.Canvas(OUTPUT, pagesize=A4)
    cv.setTitle("День 1 — план дня")

    draw_day_plan(cv)

    if not no_shop and os.path.exists(SHOPPING_TXT):
        draw_shopping_list(cv, SHOPPING_TXT)

    cv.save()
    print(f"Сохранено: {os.path.abspath(OUTPUT)}")


if __name__ == "__main__":
    main()
