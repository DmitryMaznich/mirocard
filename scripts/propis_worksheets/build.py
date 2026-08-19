#!/usr/bin/env python3
"""Generates one imposed booklet PDF per notebook (see
letter_groups.NOTEBOOKS) into output/ -- each notebook is its own
downloadable file (confirmed with the user 2026-08-18: 2 separate files,
not merged into one), so printing/binding one doesn't require pulling a
page range out of a bigger file.

Usage:
  python build.py         # all notebooks
  python build.py 1       # just notebook 1 (fast iteration while tuning layout)
"""

import os
import sys

from letter_groups import NOTEBOOKS, notebook_groups
from render import load_letters
from booklet import build_notebook_pdf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "output")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    letters = load_letters()

    target = int(sys.argv[1]) if len(sys.argv) > 1 else None

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


if __name__ == "__main__":
    main()
