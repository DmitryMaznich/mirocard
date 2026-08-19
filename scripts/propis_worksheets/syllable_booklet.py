"""Saddle-stitch booklet build for the letter-connections ("слоги")
notebook -- same real ruling PDF, same imposition/pypdf-merge plumbing as
booklet.py's letter notebooks (shared via booklet._build_overlay_pdf_generic
/ booklet._merge_with_ruling), just drawing syllable_page.draw_syllable_page
pages instead of page.draw_group_page ones. One notebook, not split into
parts, per the volume plan confirmed with the user 2026-08-19."""

import os

from page import paginate_rows
from syllable_page import draw_syllable_page, ROWS_PER_PAGE
from syllables import syllable_notebook_rows

from booklet import (
    _ensure_ruling_pdf,
    _build_overlay_pdf_generic,
    _merge_with_ruling,
)


def _build_syllable_overlay_pdf(pages, out_path, letters, connectors_by_key, variant_index):
    def draw_page_fn(c, index, page_rows, inset, page_number, number_align):
        draw_syllable_page(
            c, page_rows, letters, connectors_by_key, variant_index,
            inset_mm=inset, page_number=page_number, number_align=number_align,
        )

    return _build_overlay_pdf_generic(pages, out_path, draw_page_fn)


def build_syllable_notebook_pdf(letters, connectors_by_key, variant_index, out_path, pairs=None):
    pages = paginate_rows(syllable_notebook_rows(pairs), per_page=ROWS_PER_PAGE)
    n = len(pages)
    if n % 4 != 0:
        n += 4 - (n % 4)
    pages = pages + [[]] * (n - len(pages))  # pad with fully-ruled, syllable-free pages

    ruling_path = _ensure_ruling_pdf()
    overlay_path = out_path + ".overlay.tmp.pdf"
    sheets = _build_syllable_overlay_pdf(pages, overlay_path, letters, connectors_by_key, variant_index)
    _merge_with_ruling(overlay_path, ruling_path, out_path)
    os.remove(overlay_path)

    return sheets
