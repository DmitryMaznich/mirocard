#!/usr/bin/env python3
"""
make_notebook.py — сборка тетрадей для прописей

Использование:
  python make_notebook.py стандарт     # один вариант
  python make_notebook.py all          # все варианты
  python make_notebook.py              # список вариантов
"""

import sys, os, subprocess, shutil
import fitz  # PyMuPDF

from notebooks import NOTEBOOKS, COVER_SCRIPT, COVER_PDF, OUTPUT_DIR

ROOT = os.path.dirname(os.path.abspath(__file__))


def run(script):
    subprocess.run([sys.executable, os.path.join(ROOT, script)], cwd=ROOT, check=True)


def build(name):
    cfg = NOTEBOOKS[name]
    out_dir = os.path.join(ROOT, OUTPUT_DIR)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n── {name}: {cfg['label']} ──────────────────────")

    # 1. Генерируем один лист страниц
    print("  Страницы...", end=" ", flush=True)
    run(cfg["script"])
    src = os.path.join(ROOT, cfg["pdf"])

    # 2. Дублируем N раз → итоговый PDF страниц
    doc = fitz.open(src)
    merged = fitz.open()
    for _ in range(cfg["sheets"]):
        merged.insert_pdf(doc)
    out_pages = os.path.join(out_dir, f"{name}_pages.pdf")
    merged.save(out_pages)
    print(f"{cfg['sheets']} листов A4 = {cfg['sheets'] * 2} страниц A5")

    # 3. Генерируем обложку
    print("  Обложка...", end=" ", flush=True)
    run(COVER_SCRIPT)
    out_cover = os.path.join(out_dir, f"{name}_cover.pdf")
    shutil.copy(os.path.join(ROOT, COVER_PDF), out_cover)
    print("готово")

    # 4. Инструкция
    sheets = cfg["sheets"]
    print(f"""
  Файлы в папке output/:
    {name}_cover.pdf   — обложка
    {name}_pages.pdf   — страницы

  Как печатать:
    1. Обложка  — 1 лист, плотная бумага (180–250 г/м²), одностороннее
    2. Страницы — {sheets} листов, обычная бумага, двустороннее,
                  ориентация: альбомная, переплёт по короткому краю
    3. Сложить все листы вместе, обложка снаружи
    4. Скрепить степлером по центральному сгибу (2 скобки)
""")


def list_notebooks():
    print("\nДоступные варианты тетрадей:")
    for name, cfg in NOTEBOOKS.items():
        print(f"  {name:12} — {cfg['label']}  ({cfg['sheets']} листов A4)")
    print("\nПримеры:")
    print("  python make_notebook.py стандарт")
    print("  python make_notebook.py all")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        list_notebooks()
    elif sys.argv[1] == "all":
        for name in NOTEBOOKS:
            build(name)
        print("═" * 50)
        print(f"Все тетради сгенерированы → папка output/")
    elif sys.argv[1] in NOTEBOOKS:
        build(sys.argv[1])
    else:
        print(f"Вариант '{sys.argv[1]}' не найден.")
        list_notebooks()
        sys.exit(1)
