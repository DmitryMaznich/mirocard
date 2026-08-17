#!/usr/bin/env python3
"""Generates one imposed booklet PDF per notebook (see
letter_groups.NOTEBOOKS) into output/, then merges them into one
downloadable file.

Usage:
  python build.py         # all notebooks
  python build.py 1       # just notebook 1 (fast iteration while tuning layout)
"""

import os
import sys

from pypdf import PdfReader, PdfWriter

from letter_groups import NOTEBOOKS, notebook_groups
from render import load_letters
from booklet import build_notebook_pdf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "output")
ALL_PDF_PATH = os.path.join(OUTPUT_DIR, "propis_worksheets_all.pdf")


def _merge_all(notebook_paths):
    """Concatenates every already-built notebook PDF, in order, into one
    downloadable file -- each notebook's own page block stays a complete,
    correctly-imposed standalone booklet (no re-imposition here, just page
    concatenation), so printing/folding/stapling one notebook's page range
    still produces that notebook on its own. One file instead of separate
    downloads (confirmed with the user 2026-08-15)."""
    writer = PdfWriter()
    page_ranges = []
    page_num = 1
    for notebook_id, path in notebook_paths:
        reader = PdfReader(path)
        writer.append(reader)
        n = len(reader.pages)
        page_ranges.append((notebook_id, page_num, page_num + n - 1))
        page_num += n
    with open(ALL_PDF_PATH, "wb") as f:
        writer.write(f)
    return page_ranges


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    letters = load_letters()

    target = int(sys.argv[1]) if len(sys.argv) > 1 else None

    notebook_paths = []
    for notebook in NOTEBOOKS:
        if target is not None and notebook["id"] != target:
            continue
        groups = notebook_groups(notebook)
        all_letters = [pair for g in groups for pair in g["letters"]]
        missing = [l for l, u in all_letters if l not in letters or (u and u not in letters)]
        if missing:
            print(f"  тетрадь {notebook['id']}: ПРОПУЩЕНЫ буквы {missing}, пропускаю")
            continue
        out_path = os.path.join(OUTPUT_DIR, f"propis_worksheets_notebook{notebook['id']}.pdf")
        sheets = build_notebook_pdf(groups, letters, out_path)
        print(f"  тетрадь {notebook['id']} ({notebook['label']}, {len(all_letters)} букв): {sheets} лист(ов) A4 -> {out_path}")
        notebook_paths.append((notebook["id"], out_path))

    if target is None and len(notebook_paths) == len(NOTEBOOKS):
        page_ranges = _merge_all(notebook_paths)
        print(f"\n  объединено в {ALL_PDF_PATH}:")
        for notebook_id, first, last in page_ranges:
            print(f"    тетрадь {notebook_id}: страницы {first}-{last}")


if __name__ == "__main__":
    main()
