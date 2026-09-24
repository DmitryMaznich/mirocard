"""Merges each propis print notebook with its cover into one print-ready PDF
(user, 2026-09-24: print materials list whole notebooks, not separate
sheets and covers):

    cover, blank page (the cover's back), then the imposed sheets,
    with the same embedded print preferences as the punctuation workbook
    (scripts/punctuation_workbook/build.py assemble_print_pdf).

Sources (cover-only and sheets-only PDFs) live in tools/propis/print_sources/,
outside print/, because scripts/build-propis-deck.mjs ships everything under
print/ in the deck zip. Merged notebooks go to tools/propis/print/. Both dirs
are gitignored (*.pdf).

    python scripts/propis_print_notebooks.py
"""

import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, DictionaryObject, NameObject

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRINT_DIR = os.path.join(ROOT, "tools", "propis", "print")
SRC_DIR = os.path.join(ROOT, "tools", "propis", "print_sources")

# merged file -> (cover, sheets)
NOTEBOOKS = {
    "тетрадь_стандарт.pdf": ("cover_алфавит_стандарт.pdf", "стандарт_pages.pdf"),
    "тетрадь_плотная.pdf": ("cover_алфавит_плотная.pdf", "плотная_pages.pdf"),
    "тетрадь_точки.pdf": ("cover_алфавит_точки.pdf", "точки_pages.pdf"),
    "тетрадь_тексты.pdf": ("cover_алфавит_тексты.pdf", "прописи_тексты.pdf"),
}


def merge(cover_pdf, sheets_pdf, out_path):
    w = PdfWriter()
    cover = PdfReader(cover_pdf)
    w.append(cover)
    box = cover.pages[0].mediabox
    w.add_blank_page(width=float(box.width), height=float(box.height))
    w.append(PdfReader(sheets_pdf))
    w._root_object[NameObject("/ViewerPreferences")] = DictionaryObject({
        NameObject("/Duplex"): NameObject("/DuplexFlipShortEdge"),
        NameObject("/PrintScaling"): NameObject("/None"),
        NameObject("/PickTrayByPDFSize"): BooleanObject(True),
    })
    with open(out_path, "wb") as f:
        w.write(f)


def main():
    for out, (cover, sheets) in NOTEBOOKS.items():
        path = os.path.join(PRINT_DIR, out)
        merge(os.path.join(SRC_DIR, cover), os.path.join(SRC_DIR, sheets), path)
        print(path, len(PdfReader(path).pages), "pages")


if __name__ == "__main__":
    main()
