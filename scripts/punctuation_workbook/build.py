"""Builds the punctuation handwriting workbook as sequential A5 pages.

    python build.py                 # every page defined in pages.PAGES
    python build.py 2 3 20          # just these pages (test proof)
    python build.py 2 3 20 --png    # + 200dpi PNG previews (needs pymupdf)

Output: <repo>/output/punctuation_workbook[_pages].pdf
"""

import os
import sys

from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from layout import HERE, PAGE_W, PAGE_H, Hand, Page
from pages import PAGES

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "output")


def build(numbers, out_path):
    hand = Hand()
    c = canvas.Canvas(out_path, pagesize=(PAGE_W * mm, PAGE_H * mm))
    c.setTitle("Знаки препинания — рабочая тетрадь")
    warnings = []
    for n in numbers:
        c.saveState()
        c.scale(mm, mm)
        pg = Page(c, hand, n)
        PAGES[n](pg)
        warnings += pg.finish()
        c.restoreState()
        c.showPage()
    c.save()
    return warnings


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    numbers = [int(a) for a in args] or sorted(PAGES)
    os.makedirs(OUT_DIR, exist_ok=True)
    suffix = "" if not args else "_p" + "-".join(map(str, numbers))
    out = os.path.join(OUT_DIR, f"punctuation_workbook{suffix}.pdf")
    for w in build(numbers, out):
        print("WARNING:", w)
    print(out)
    if "--png" in sys.argv:
        import pymupdf
        doc = pymupdf.open(out)
        for i, page in enumerate(doc):
            png = out[:-4] + f"_{numbers[i]:02d}.png"
            page.get_pixmap(dpi=200).save(png)
            print(png)


if __name__ == "__main__":
    main()
