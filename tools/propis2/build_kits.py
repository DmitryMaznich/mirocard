"""Builds the «Методика» kits of «Прописи 2» (src/topics/renderers/propis2/kits.json) from the SAME content lists the v1 print
notebooks (scripts/propis_worksheets) are generated from: letter groups, syllables, words, texts. The PDFs themselves are not
parsed. A page is the constructor's own page: rows with their options, so every kit can be opened and edited in the constructor.

Run: python3 tools/propis2/build_kits.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "propis_worksheets"))

import letter_groups as lg  # noqa: E402
import syllables  # noqa: E402
import texts  # noqa: E402
import words  # noqa: E402

ROWS = 16  # content rows of an A5 page in the constructor (the v1 notebook has 17: its first ruling row is part of the page)
wide = json.load(open(ROOT / "tools" / "propis" / "wide.json", encoding="utf-8"))
HAVE = {g["label"] for g in wide["glyphs"]} | {a for g in wide["glyphs"] for a in g.get("aliases", [])}

# every kit page is a page of the printed notebooks: the narrow ruling, the standard 20 mm slants, the red margin
PAGE = {"ruling": "narrow", "grid": "regular", "gridKind": "propis", "margin": "left", "format": "a5", "midDash": True}


def row(text, repeat="all", dots="all", as_text=None, kind="text"):
    r = {"text": text, "kind": kind, "repeat": repeat, "dots": dots, "copies": "dash"}
    if as_text is not None:
        r["asText"] = as_text
    return r


def sample(text, repeat="one"):
    """A row of the independent-practice pages: the model once at the start, the rest of the row is the child's."""
    return row(text, repeat=repeat, dots="one", as_text=False)


def chunks(rows, n=ROWS):
    return [rows[i:i + n] for i in range(0, len(rows), n)]


def page(title, rows):
    return {"title": title, "rows": rows}


def missing(text):
    return [ch for ch in text if ch.isalpha() and ch not in HAVE]


report = []


def kit(kid, title, description, pages):
    for p in pages:
        for r in p["rows"]:
            m = missing(r["text"])
            if m:
                report.append(f"{kid}: «{r['text']}» нет начертания: {''.join(m)}")
    return {"id": kid, "title": title, "description": description, "group": "Методика", "page": PAGE, "pages": pages}


# ---- letters: for every letter two pages (practice with fading copies, then independent writing) --------------------------------
def letter_pages(notebook):
    out = []
    for group in lg.notebook_groups(notebook):
        for lower, upper in group["letters"]:
            up = upper if upper and upper in HAVE else None
            pair = f"{lower} {up}" if up else None
            base = [row(lower, "fade"), row(lower, "fade")] + ([row(up, "fade"), row(pair, "fade", as_text=False), row(pair, "fade", as_text=False)] if up else [])
            reps = -(-ROWS // len(base))
            title = f"{lower}{(' ' + up) if up else ''}"
            out.append(page(f"{title} — с образцом", (base * reps)[:ROWS]))
            if up:
                n_lower, n_upper = round(ROWS * 0.3), round(ROWS * 0.3)
                rows = [sample(lower)] * n_lower + [sample(up)] * n_upper + [sample(pair)] * (ROWS - n_lower - n_upper)
            else:
                rows = [sample(lower)] * ROWS
            out.append(page(f"{title} — самостоятельно", rows))
    return out


kits = []
for nb, name in ((lg.NOTEBOOKS[0], "часть 1 (простые формы)"), (lg.NOTEBOOKS[1], "часть 2 (сложные формы)")):
    kits.append(kit(f"letters-{nb['id']}", f"Прописи — {name}", "Для каждой буквы две страницы: с образцом и повторами, затем самостоятельно. Строчная и заглавная.", letter_pages(nb)))

# ---- syllables: 160 pairs, three rows each, the model once at the start of a row ------------------------------------------------
syl_rows = [sample(c + v) for c, v in syllables.all_pairs() for _ in range(syllables.ROWS_PER_SYLLABLE)]
kits.append(kit("syllables", "Прописи — соединения букв", "Слоги: согласная и гласная а, о, и, е, строчные и с заглавной согласной. По три строки на слог.",
                [page(f"Слоги {i + 1}", r) for i, r in enumerate(chunks(syl_rows))]))

# ---- words: two blocks, two rows per word --------------------------------------------------------------------------------------
def word_rows(ws):
    return [sample(w) for w in ws for _ in range(words.ROWS_PER_WORD)]


kits.append(kit("words-1", "Прописи — слова, часть 1 (простые формы)", "Слова из букв первой части; каждое слово строчными и с заглавной. По две строки на слово.",
                [page(f"Слова {i + 1}", r) for i, r in enumerate(chunks(word_rows(words.block_a_notebook_words())))]))
kits.append(kit("words-2", "Прописи — слова, часть 2 (любые буквы)", "Слова с любыми буквами. По две строки на слово.",
                [page(f"Слова {i + 1}", r) for i, r in enumerate(chunks(word_rows(words.BLOCK_B)))]))

# ---- texts: a model text at the top of the page, the rest of the page is for copying ----------------------------------------------
kits.append(kit("texts", "Тетрадь — тексты для переписывания", "Образец текста вверху страницы, ниже пустые строки для переписывания.",
                [page(f"Текст {i + 1}", [row(t, "one", "one", as_text=True, kind="passage")]) for i, t in enumerate(texts.TEXTS)]))

out = ROOT / "src" / "topics" / "renderers" / "propis2" / "kits.json"
out.write_text(json.dumps({"version": 1, "kits": kits}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(kits)} kits -> {out} ({out.stat().st_size // 1024} KB)")
for k in kits:
    print(f"  {k['id']}: {len(k['pages'])} pages")
for line in sorted(set(report))[:30]:
    print("  !", line)
print(f"  warnings: {len(set(report))}")
