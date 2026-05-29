"""Generate a single PDF with all 12 recipes."""

import os, re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

FONTS_DIR = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Arial",      os.path.join(FONTS_DIR, "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", os.path.join(FONTS_DIR, "arialbd.ttf")))

W, H    = A4
ML      = 20 * mm   # left margin
MR      = 20 * mm   # right margin
MT      = 22 * mm   # top margin
MB      = 18 * mm   # bottom margin
TW      = W - ML - MR

BASE_DIR     = os.path.dirname(__file__)
RECIPES_DIR  = os.path.join(BASE_DIR, "..", "content", "recipes")
OUTPUT       = os.path.join(BASE_DIR, "..", "recipes.pdf")

ORDER = [
    "omelet.txt", "fried_eggs.txt", "pasta.txt", "mashed_potatoes.txt",
    "oatmeal.txt", "salad.txt", "chicken.txt", "syrnik.txt",
    "tea.txt", "cocoa.txt", "kompot.txt", "lemonade.txt",
]

GREEN_DARK  = (0.15, 0.35, 0.30)
GREEN_MID   = (0.25, 0.55, 0.48)
GREY_DARK   = (0.12, 0.12, 0.12)
GREY_MID    = (0.40, 0.40, 0.40)


def parse_recipe(path):
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip() for l in f.readlines()]
    title = lines[0].strip() if lines else ""
    body  = lines[2:] if len(lines) > 2 else []
    return title, body


def wrap_text(cv, text, font, size, max_width, indent_x=0):
    """Return list of (x_offset, text_fragment) lines."""
    words = text.split()
    result = []
    current = ""
    first = True
    for word in words:
        trial = (current + " " + word).strip()
        if cv.stringWidth(trial, font, size) > max_width:
            result.append((indent_x if not first else 0, current))
            current = word
            first = False
        else:
            current = trial
    if current:
        result.append((indent_x if not first else 0, current))
    return result


def draw_recipe(cv, title, body, page_num, total):
    cv.showPage()
    y = H - MT

    # ── Title bar background ──
    bar_h = 10 * mm
    cv.setFillColorRGB(*GREEN_DARK)
    cv.rect(ML - 4, y - bar_h + 3, TW + 8, bar_h, fill=1, stroke=0)
    cv.setFillColorRGB(1, 1, 1)
    cv.setFont("Arial-Bold", 14)
    cv.drawString(ML, y - bar_h + 3 + 3.5 * mm, title)
    y -= bar_h + 5 * mm

    cv.setFillColorRGB(*GREY_DARK)

    for raw in body:
        if not raw.strip():
            y -= 2 * mm
            continue

        is_bullet = raw.startswith("- ")
        is_step   = bool(re.match(r"^\d+\.", raw))
        text = raw[2:].strip() if is_bullet else raw

        if is_step:
            font, size, color = "Arial-Bold", 11, GREY_DARK
            indent = 0
        elif is_bullet:
            font, size, color = "Arial", 10, GREY_MID
            indent = 5 * mm
        else:
            font, size, color = "Arial", 11, GREY_DARK
            indent = 0

        line_h = size * 1.45

        # prefix for first line
        first_prefix = "• " if is_bullet else ""
        full_text    = first_prefix + text

        cv.setFont(font, size)
        cv.setFillColorRGB(*color)

        fragments = wrap_text(cv, full_text, font, size, TW - indent)
        for i, (x_off, frag) in enumerate(fragments):
            if y < MB + line_h:
                cv.showPage()
                y = H - MT
                cv.setFont(font, size)
                cv.setFillColorRGB(*color)
            cv.drawString(ML + indent + x_off, y, frag)
            y -= line_h

        y -= 1   # small gap between items

    # ── Page number ──
    cv.setFont("Arial", 8)
    cv.setFillColorRGB(0.6, 0.6, 0.6)
    cv.drawCentredString(W / 2, MB - 5 * mm, f"{page_num} / {total}")


def main():
    recipes = []
    for fname in ORDER:
        path = os.path.join(RECIPES_DIR, fname)
        if os.path.exists(path):
            recipes.append(parse_recipe(path))
        else:
            print(f"WARN: {fname} not found, skipping")

    cv = canvas.Canvas(OUTPUT, pagesize=A4)
    cv.setTitle("Рецепты")

    # ── Cover ──
    cv.setFillColorRGB(*GREEN_DARK)
    cv.rect(0, 0, W, H, fill=1, stroke=0)
    cv.setFillColorRGB(1, 1, 1)
    cv.setFont("Arial-Bold", 42)
    cv.drawCentredString(W / 2, H / 2 + 15 * mm, "Рецепты")
    cv.setFont("Arial", 16)
    cv.setFillColorRGB(0.75, 0.92, 0.88)
    cv.drawCentredString(W / 2, H / 2 - 5 * mm, f"{len(recipes)} рецептов")

    total = len(recipes)
    for i, (title, body) in enumerate(recipes, 1):
        draw_recipe(cv, title, body, i, total)

    cv.save()
    print(f"Saved: {os.path.abspath(OUTPUT)}")


if __name__ == "__main__":
    main()
