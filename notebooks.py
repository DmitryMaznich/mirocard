"""
Конфиг вариантов тетрадей для прописей.
Добавить новый вариант: создать скрипт страниц + одну запись здесь.
"""

NOTEBOOKS = {
    "плотная": {
        "script": "make_lined_paper_landscape.py",
        "pdf":    "lined_paper_A4_landscape.pdf",
        "label":  "Косая линейка 3мм",
        "sheets": 4,
    },
    "стандарт": {
        "script": "make_lined_paper_landscape_standard.py",
        "pdf":    "lined_paper_A4_landscape_standard.pdf",
        "label":  "Косая линейка 20мм (стандарт РФ)",
        "sheets": 4,
    },
    "точки": {
        "script": "make_lined_paper_landscape_dots_only.py",
        "pdf":    "lined_paper_A4_landscape_dots_only.pdf",
        "label":  "Вспомогательные точки",
        "sheets": 4,
    },
}

COVER_SCRIPT = "scripts/cover_tetrad.py"
COVER_PDF    = "cover_mama.pdf"
OUTPUT_DIR   = "output"
