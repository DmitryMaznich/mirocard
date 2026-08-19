"""Draws one page of the "тексты для переписывания" notebook: a real
HAND-CURSIVE model text (same captured-stroke system every other
propis_worksheets content type uses, via text_layout.layout_text_into_rows
+ render.draw_pair -- NOT a plain printed font, confirmed with the user
2026-08-19 after an earlier printed-font version was rejected: "мне
нужен рукописный текст") in the top rows of the page, and nothing at all
in the remaining rows -- that blank space IS the exercise, ruled lines
from the real ruling PDF already sitting there for the child to copy the
text into by hand.

Every current TEXTS entry (5 sentences each, confirmed with the user
2026-08-19 that the model text should land around ~40% of the page, not
the ~20% an earlier 3-sentence pass produced) lays out to 5-8 real
cursive rows -- checked against every text, not estimated. MODEL_ROWS=8
covers the actual maximum with no headroom to spare wasted.
"""

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from page import LEFT_INSET_MM, row_baselines, draw_page_number_badge
from render import draw_pair, SCALE
from text_layout import layout_text_into_rows

MODEL_ROWS = 8

INK_COLOR = (0.11, 0.30, 0.85)  # same blue as every cursive stroke elsewhere in this pipeline

# Punctuation (currently just the sentence-ending period) has no captured
# cursive stroke -- rendered as a plain glyph instead, same as
# WriteTextView.jsx's own fallback-segment handling in the app (see
# text_layout.build_word_segments). Needs a real Cyrillic-capable font
# registered even though a period itself doesn't -- keeps one font
# object for any future fallback character that does.
FALLBACK_FONT = "Helvetica"
for _path in ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/calibri.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
    try:
        pdfmetrics.registerFont(TTFont("PropisFallback", _path))
        FALLBACK_FONT = "PropisFallback"
        break
    except Exception:
        pass

# Real point size the fallback glyph should visually appear at; the
# canvas is already scale(mm, mm)'d (booklet.py), so the value actually
# passed to setFont must be divided by mm-per-point (2.83465) -- same
# gotcha page.py's draw_page_number_badge already works around (see its
# own comment for the fuller explanation).
FALLBACK_FONT_REAL_PT = 16


def draw_text_page(c, text, letters, connectors_by_key, variant_index, row_width_units,
                    inset_mm=LEFT_INSET_MM, page_number=None, number_align="left"):
    if page_number is not None:
        draw_page_number_badge(c, page_number, number_align)

    if text is None:
        return

    baselines = row_baselines()[:MODEL_ROWS]
    layout = layout_text_into_rows(text, letters, connectors_by_key, variant_index, row_width_units)

    c.saveState()
    c.translate(inset_mm, 0)

    for item in layout["placed"]:
        if item["row_index"] >= len(baselines):
            continue  # defensive: a future longer text shouldn't overrun into the copying zone
        baseline_y = baselines[item["row_index"]]
        word_x_mm = item["x"] * SCALE
        for seg in item["segments"]:
            seg_x_mm = word_x_mm + seg["xOffset"] * SCALE
            if seg["type"] == "cursive":
                draw_pair(c, seg["trajectory"], seg_x_mm, baseline_y, 1.0, color=INK_COLOR)
            else:
                c.saveState()
                c.setFont(FALLBACK_FONT, FALLBACK_FONT_REAL_PT / 2.83465)
                c.setFillColorRGB(*INK_COLOR)
                c.drawString(seg_x_mm, baseline_y, seg["text"])
                c.restoreState()

    c.restoreState()
