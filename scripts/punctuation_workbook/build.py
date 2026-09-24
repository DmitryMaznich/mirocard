"""Builds the punctuation handwriting workbook: 24 A5 pages imposed as a
saddle-stitch booklet on A4-landscape sheets, like every other
propis_worksheets notebook.

    python build.py                     # gray grid (chosen by the user 2026-09-24)
    python build.py --palette blue      # or black: the other notebooks' grid / max contrast
    python build.py --png 2 3 20        # + 200dpi PNG of these A5 pages

Output: <repo>/output/punctuation_workbook[_<palette>].pdf
"""

import argparse
import os

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from content import HERE, Ink, LEFT_INSET_MM, CENTER_INSET_MM, page_number
from pages import CONTENT, KIND
from ruling import draw_sheet_ruling, HALF_W

from booklet import _imposition_order  # noqa: E402  (content.py put ../propis_worksheets on sys.path)

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "output")
N_PAGES = 24


def build(out_path, palette):
    ink = Ink()
    warnings = []
    c = canvas.Canvas(out_path, pagesize=landscape(A4))
    c.setTitle("Знаки препинания — пропись")
    c.setAuthor("Mironium TEAM")
    placement = {}  # page number -> (pdf page index, is_left)
    pdf_index = 0
    for front, back in _imposition_order(N_PAGES):
        for left, right in (front, back):
            ln, rn = left + 1, right + 1
            draw_sheet_ruling(c, KIND[ln], KIND[rn], palette)
            for n, is_left in ((ln, True), (rn, False)):
                offset_mm = 0.0 if is_left else HALF_W / mm
                inset = LEFT_INSET_MM if is_left else CENTER_INSET_MM
                c.saveState()
                c.translate(offset_mm * mm, 0)
                c.scale(mm, mm)
                if n in CONTENT:
                    CONTENT[n](ink, c, inset, offset_mm, warnings, n)
                page_number(c, n, "left" if is_left else "right")
                c.restoreState()
                placement[n] = (pdf_index, is_left)
            c.showPage()
            pdf_index += 1
    c.save()
    return warnings, placement


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--palette", default="gray", choices=["blue", "gray", "black"])
    ap.add_argument("--png", nargs="*", type=int, default=None)
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    suffix = "" if args.palette == "gray" else f"_{args.palette}"
    out = os.path.join(OUT_DIR, f"punctuation_workbook{suffix}.pdf")
    warnings, placement = build(out, args.palette)
    for w in warnings:
        print("WARNING:", w)
    print(out)

    if args.png is not None:
        import pymupdf
        doc = pymupdf.open(out)
        for n in args.png or sorted(CONTENT):
            idx, is_left = placement[n]
            page = doc[idx]
            r = page.rect
            clip = pymupdf.Rect(0, 0, r.width / 2, r.height) if is_left else \
                pymupdf.Rect(r.width / 2, 0, r.width, r.height)
            png = out[:-4] + f"_p{n:02d}.png"
            page.get_pixmap(dpi=200, clip=clip).save(png)
            print(png)


if __name__ == "__main__":
    main()
