"""Saddle-stitch booklet imposition: arranges N per-letter A5 pages into
physical A4-landscape sheet-faces (2 A5 slots per face, printed
double-sided) in the order that reads correctly after folding down the
center and stapling -- the same physical assembly the existing
print_materials notebooks already use (fold + staple through the center,
per make_lined_paper_landscape_standard.py's own staple-slot markers).

Verified by hand during planning for n=4 and n=8: sheet i's front holds
pages (n-1-2i, 2i) left-to-right, its back holds pages (2i+1, n-2-2i) --
this is the standard "nested sheets" saddle-stitch layout (sheet 0 is the
OUTERMOST wrap, sheet n//4 - 1 is the INNERMOST, centered when assembled).
"""

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

from page import PAGE_W_MM, draw_letter_page


def _imposition_order(n):
    """n must be a multiple of 4. Returns a list of n//4 (front, back)
    pairs, each itself a (left_index, right_index) pair of 0-based page
    indices."""
    assert n % 4 == 0
    sheets = []
    for i in range(n // 4):
        front = (n - 1 - 2 * i, 2 * i)
        back = (2 * i + 1, n - 2 - 2 * i)
        sheets.append((front, back))
    return sheets


def build_group_pdf(group, letters, out_path):
    entries = list(group["letters"])  # [(lower, upper_or_None), ...]
    n = len(entries)
    if n % 4 != 0:
        n += 4 - (n % 4)  # pad with blank slots so the imposition math holds

    c = canvas.Canvas(out_path, pagesize=landscape(A4))

    def draw_slot(index, x_offset_mm):
        if index >= len(entries):
            return  # padding slot, left blank
        lower, upper = entries[index]
        c.saveState()
        c.translate(x_offset_mm * mm, 0)
        c.scale(mm, mm)
        draw_letter_page(c, group, lower, upper, letters)
        c.restoreState()

    sheets = _imposition_order(n)
    for front, back in sheets:
        draw_slot(front[0], 0)
        draw_slot(front[1], PAGE_W_MM)
        c.showPage()
        draw_slot(back[0], 0)
        draw_slot(back[1], PAGE_W_MM)
        c.showPage()

    c.save()
    return len(sheets)
