"""Saddle-stitch booklet build for the "тексты для переписывания"
notebook -- same real ruling PDF, same imposition/pypdf-merge plumbing
as booklet.py's letter notebooks, just one texts.py entry per PAGE
(text_page.draw_text_page) instead of packing multiple rows per page the
way letters/syllables/words do -- a whole page's worth of blank ruled
lines below the model text IS the exercise, not overflow to pack more
content into.
"""

import os

from page import CONTENT_W_MM
from render import UNIT_H, ROW_MM
from text_page import draw_text_page

from booklet import (
    _ensure_ruling_pdf,
    _build_overlay_pdf_generic,
    _merge_with_ruling,
)

# Same native-units row width connectors/text_layout work in, converted
# from the real content width every other notebook in this pipeline
# already uses (page.py's CONTENT_W_MM) -- so wrapping decisions match
# exactly what render.draw_pair will actually place within the margins.
ROW_WIDTH_UNITS = CONTENT_W_MM / (ROW_MM / UNIT_H)


def _build_text_overlay_pdf(pages, out_path, letters, connectors_by_key, variant_index):
    def draw_page_fn(c, index, text, inset, page_number, number_align):
        draw_text_page(
            c, text, letters, connectors_by_key, variant_index, ROW_WIDTH_UNITS,
            inset_mm=inset, page_number=page_number, number_align=number_align,
        )

    return _build_overlay_pdf_generic(pages, out_path, draw_page_fn)


def build_text_notebook_pdf(letters, connectors_by_key, variant_index, out_path, texts, min_pages=0):
    pages = list(texts)
    n = max(len(pages), min_pages)
    if n % 4 != 0:
        n += 4 - (n % 4)
    pages = pages + [None] * (n - len(pages))  # pad with fully-ruled, text-free pages

    ruling_path = _ensure_ruling_pdf()
    overlay_path = out_path + ".overlay.tmp.pdf"
    sheets = _build_text_overlay_pdf(pages, overlay_path, letters, connectors_by_key, variant_index)
    _merge_with_ruling(overlay_path, ruling_path, out_path)
    os.remove(overlay_path)

    return sheets
