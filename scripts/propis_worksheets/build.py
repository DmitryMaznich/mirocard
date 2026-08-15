#!/usr/bin/env python3
"""Generates one imposed booklet PDF per letter group (see
letter_groups.GROUPS) into output/.

Usage:
  python build.py         # all groups
  python build.py 1       # just group 1 (fast iteration while tuning layout)
"""

import os
import sys

from letter_groups import GROUPS
from render import load_letters
from booklet import build_group_pdf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "output")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    letters = load_letters()

    target = int(sys.argv[1]) if len(sys.argv) > 1 else None

    for group in GROUPS:
        if target is not None and group["id"] != target:
            continue
        missing = [l for l, u in group["letters"] if l not in letters or (u and u not in letters)]
        if missing:
            print(f"  группа {group['id']}: ПРОПУЩЕНЫ буквы {missing}, пропускаю")
            continue
        out_path = os.path.join(OUTPUT_DIR, f"propis_worksheets_group{group['id']}.pdf")
        sheets = build_group_pdf(group, letters, out_path)
        print(f"  группа {group['id']} ({group['label']}): {sheets} лист(ов) A4 -> {out_path}")


if __name__ == "__main__":
    main()
