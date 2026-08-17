#!/usr/bin/env python3
"""
make_print_zip.py — сборка темы «Печатные материалы» для Mirocard2

Что делает:
  1. Запускает make_notebook.py all → генерирует PDF в output/
  2. Копирует PDF в src/print_materials/print/
  3. Генерирует PNG-превью обложки для каждого варианта (PyMuPDF)
  4. Бампит patch-версию в src/print_materials/topic.json
  5. Собирает ZIP → public/decks/print_materials_vX.Y.Z.zip
  6. Обновляет public/decks/catalog.json
"""

import os, sys, json, subprocess, shutil, zipfile
import fitz  # PyMuPDF

ROOT          = os.path.dirname(os.path.abspath(__file__))
SRC           = os.path.join(ROOT, "src", "print_materials")
STAGING_PRINT = os.path.join(SRC, "print")
STAGING_THUMBS = os.path.join(SRC, "thumbnails")
OUTPUT_DIR    = os.path.join(ROOT, "output")
DECKS_DIR     = os.path.join(ROOT, "public", "decks")
TOPIC_JSON    = os.path.join(SRC, "topic.json")


def run_make_notebook():
    print("── Генерирую PDF (make_notebook.py all)...")
    subprocess.run(
        [sys.executable, os.path.join(ROOT, "make_notebook.py"), "all"],
        cwd=ROOT, check=True
    )


def copy_pdfs():
    os.makedirs(STAGING_PRINT, exist_ok=True)
    mapping = {
        "cover_стандарт.pdf":          os.path.join(OUTPUT_DIR, "стандарт_cover.pdf"),
        "cover_плотная.pdf":           os.path.join(OUTPUT_DIR, "плотная_cover.pdf"),
        "cover_точки.pdf":             os.path.join(OUTPUT_DIR, "точки_cover.pdf"),
        "cover_алфавит_стандарт.pdf":  os.path.join(OUTPUT_DIR, "стандарт_cover_alphabet.pdf"),
        "cover_алфавит_плотная.pdf":   os.path.join(OUTPUT_DIR, "плотная_cover_alphabet.pdf"),
        "cover_алфавит_точки.pdf":     os.path.join(OUTPUT_DIR, "точки_cover_alphabet.pdf"),
        "стандарт_pages.pdf": os.path.join(OUTPUT_DIR, "стандарт_pages.pdf"),
        "плотная_pages.pdf":  os.path.join(OUTPUT_DIR, "плотная_pages.pdf"),
        "точки_pages.pdf":    os.path.join(OUTPUT_DIR, "точки_pages.pdf"),
        "прописи_буквы.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_all.pdf"),
    }
    print("── Копирую PDF в staging...")
    for dest_name, src_path in mapping.items():
        if not os.path.exists(src_path):
            print(f"  ВНИМАНИЕ: {src_path} не найден, пропускаю")
            continue
        shutil.copy(src_path, os.path.join(STAGING_PRINT, dest_name))
        sz = os.path.getsize(os.path.join(STAGING_PRINT, dest_name))
        print(f"  {dest_name}: {sz/1024:.0f} KB")


def generate_thumbnails(topic):
    os.makedirs(STAGING_THUMBS, exist_ok=True)
    print("── Генерирую превью...")
    for item in topic.get("items", []):
        thumb_rel = item.get("thumbnail")
        if not thumb_rel:
            continue
        # first available PDF for this item
        first_pdf = None
        for f in item.get("files", []):
            pdf_abs = os.path.join(SRC, f["path"])
            if os.path.exists(pdf_abs):
                first_pdf = pdf_abs
                break
        if not first_pdf:
            print(f"  {item['id']}: PDF не найден, пропускаю превью")
            continue
        out_path = os.path.join(SRC, thumb_rel)
        doc  = fitz.open(first_pdf)
        page = doc[0]
        mat  = fitz.Matrix(1.5, 1.5)  # ~108 DPI
        pix  = page.get_pixmap(matrix=mat)
        pix.save(out_path)
        doc.close()
        print(f"  {os.path.basename(out_path)}: {pix.width}×{pix.height}px")


def bump_version(topic):
    v     = topic["meta"]["version"]
    parts = v.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    new_v = ".".join(parts)
    topic["meta"]["version"] = new_v
    return new_v


def build_zip(topic, version):
    zip_name = f"print_materials_v{version}.zip"
    zip_path = os.path.join(DECKS_DIR, zip_name)
    os.makedirs(DECKS_DIR, exist_ok=True)
    print(f"── Собираю {zip_name}...")
    total = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # Always write the current (bumped) topic.json
        content = json.dumps(topic, ensure_ascii=False, indent=2).encode("utf-8")
        zf.writestr("topic.json", content)
        total += len(content)
        # Walk all other files in SRC
        for dirpath, _, filenames in os.walk(SRC):
            for fname in filenames:
                full    = os.path.join(dirpath, fname)
                arcname = os.path.relpath(full, SRC).replace("\\", "/")
                if arcname == "topic.json":
                    continue
                zf.write(full, arcname)
                total += os.path.getsize(full)
    sz = os.path.getsize(zip_path)
    print(f"  → {zip_name}: {sz/1024:.0f} KB  (raw {total/1024:.0f} KB)")
    return zip_name


def update_catalog(zip_name, topic):
    cat_path = os.path.join(DECKS_DIR, "catalog.json")
    if not os.path.exists(cat_path):
        print(f"  ВНИМАНИЕ: {cat_path} не найден, пропускаю")
        return
    with open(cat_path, encoding="utf-8") as f:
        catalog = json.load(f)
    decks = catalog.get("decks", [])
    decks = [d for d in decks if d.get("id") != "print_materials"]
    decks.append({
        "id":          "print_materials",
        "version":     topic["meta"]["version"],
        "title":       topic["meta"]["title"],
        "description": topic["meta"].get("description", {}),
        "url":         f"./decks/{zip_name}",
    })
    catalog["decks"] = decks
    with open(cat_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"  catalog.json обновлён → print_materials v{topic['meta']['version']}")


def main():
    run_make_notebook()

    with open(TOPIC_JSON, encoding="utf-8") as f:
        topic = json.load(f)

    copy_pdfs()
    generate_thumbnails(topic)

    version = bump_version(topic)
    with open(TOPIC_JSON, "w", encoding="utf-8") as f:
        json.dump(topic, f, ensure_ascii=False, indent=2)
    print(f"── Версия: {version}")

    zip_name = build_zip(topic, version)
    update_catalog(zip_name, topic)

    print(f"\n✓ print_materials v{version} → public/decks/{zip_name}")
    print("  Следующий шаг: npm run deploy:prod")


if __name__ == "__main__":
    main()
