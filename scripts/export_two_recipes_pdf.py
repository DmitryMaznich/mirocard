"""Generate a PDF with soup and tea recipes."""

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
ML      = 20 * mm
MR      = 20 * mm
MT      = 22 * mm
MB      = 18 * mm
TW      = W - ML - MR

BASE_DIR    = os.path.dirname(__file__)
RECIPES_DIR = os.path.join(BASE_DIR, "..", "content", "recipes")
OUTPUT      = os.path.join(BASE_DIR, "..", "soup_and_tea.pdf")

ORDER = ["soup.txt", "tea.txt"]

GREEN_DARK = (0.15, 0.35, 0.30)
GREY_DARK  = (0.12, 0.12, 0.12)
GREY_MID   = (0.40, 0.40, 0.40)


def parse_recipe(path):
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip() for l in f.readlines()]
    title = lines[0].strip() if lines else ""
    body  = lines[2:] if len(lines) > 2 else []
    return title, body


def wrap_text(cv, text, font, size, max_width):
    words = text.split()
    result = []
    current = ""
    first = True
    for word in words:
        trial = (current + " " + word).strip()
        if cv.stringWidth(trial, font, size) > max_width:
            result.append((0 if first else 0, current))
            current = word
            first = False
        else:
            current = trial
    if current:
        result.append((0, current))
    return result


def draw_recipe(cv, title, body, page_num, total):
    cv.showPage()
    y = H - MT

    # Title bar
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

        is_bullet  = raw.startswith("- ")
        is_step    = bool(re.match(r"^\d+\.", raw))
        is_preamble = not is_bullet and not is_step
        text = raw[2:].strip() if is_bullet else raw

        if is_step:
            font, size, color = "Arial-Bold", 11, GREY_DARK
            indent = 0
        elif is_bullet:
            font, size, color = "Arial", 10, GREY_MID
            indent = 5 * mm
        elif is_preamble:
            font, size, color = "Arial-Bold", 12, GREEN_DARK
            indent = 0
        else:
            font, size, color = "Arial", 11, GREY_DARK
            indent = 0

        line_h = size * 1.45
        first_prefix = "• " if is_bullet else ""
        full_text    = first_prefix + text

        cv.setFont(font, size)
        cv.setFillColorRGB(*color)

        fragments = wrap_text(cv, full_text, font, size, TW - indent)
        for frag_i, (_, frag) in enumerate(fragments):
            if y < MB + line_h:
                cv.showPage()
                y = H - MT
                cv.setFont(font, size)
                cv.setFillColorRGB(*color)
            cv.drawString(ML + indent, y, frag)
            y -= line_h

        y -= 1
        cv.setFillColorRGB(*GREY_DARK)

    # Page number
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
            print(f"WARN: {fname} not found")

    cv = canvas.Canvas(OUTPUT, pagesize=A4)
    cv.setTitle("Суп и чай")

    # Cover
    cv.setFillColorRGB(*GREEN_DARK)
    cv.rect(0, 0, W, H, fill=1, stroke=0)
    cv.setFillColorRGB(1, 1, 1)
    cv.setFont("Arial-Bold", 36)
    cv.drawCentredString(W / 2, H / 2 + 10 * mm, "Суп и чай")
    cv.setFont("Arial", 14)
    cv.setFillColorRGB(0.75, 0.92, 0.88)
    cv.drawCentredString(W / 2, H / 2 - 8 * mm, f"{len(recipes)} рецепта")

    total = len(recipes)
    for i, (title, body) in enumerate(recipes, 1):
        draw_recipe(cv, title, body, i, total)

    cv.save()
    print(f"Saved: {os.path.abspath(OUTPUT)}")


if __name__ == "__main__":
    main()
