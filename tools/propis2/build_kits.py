"""Builds the «Методика» kits of `propis2` (src/topics/renderers/propis2/kits.json) from the SAME content lists the `propis` («Прописи старые») print
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

ROWS = 17  # rows of an A5 page on the narrow ruling: all 17 ruling rows of the printed notebook
wide = json.load(open(ROOT / "tools" / "propis" / "wide.json", encoding="utf-8"))
HAVE = {g["label"] for g in wide["glyphs"]} | {a for g in wide["glyphs"] for a in g.get("aliases", [])}

# every kit page is a page of the printed notebooks: the narrow ruling, the standard 20 mm slants, the red margin
PAGE = {"ruling": "narrow", "grid": "regular", "gridKind": "propis", "margin": "left", "format": "a5", "midDash": True}


def row(text, repeat="all", dots="all", as_text=None, kind="text", gap=None):
    r = {"text": text, "kind": kind, "repeat": repeat, "dots": dots, "copies": "dash"}
    if as_text is not None:
        r["asText"] = as_text
    if gap:
        r["gap"] = gap
    return r


def sample(text, repeat="one", gap=None):
    """A row of the independent-practice pages: the model once at the start, the rest of the row is the child's."""
    return row(text, repeat=repeat, dots="one", as_text=False, gap=gap)


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
            # a pair is the capital FIRST, then the lowercase, with a gap between them (there is no connection in front of a capital, and a
            # lowercase letter must not run into it); the next pair stands further off than the letters of one pair
            pair = f"{up}  {lower}" if up else None
            base = [row(lower, "fade"), row(lower, "fade")] + ([row(up, "fade"), row(pair, "fade", as_text=False, gap=2), row(pair, "fade", as_text=False, gap=2)] if up else [])
            reps = -(-ROWS // len(base))
            title = f"{up} {lower}" if up else lower
            out.append(page(f"{title} — с образцом", (base * reps)[:ROWS]))
            if up:
                n_lower, n_upper = round(ROWS * 0.3), round(ROWS * 0.3)
                rows = [sample(lower)] * n_lower + [sample(up)] * n_upper + [sample(pair, gap=2)] * (ROWS - n_lower - n_upper)
            else:
                rows = [sample(lower)] * ROWS
            out.append(page(f"{title} — самостоятельно", rows))
    return out


kits = []
for nb, name in ((lg.NOTEBOOKS[0], "часть 1 (простые формы)"), (lg.NOTEBOOKS[1], "часть 2 (сложные формы)")):
    kits.append(kit(f"letters-{nb['id']}", f"Прописи — {name}", "Для каждой буквы две страницы: с образцом и повторами, затем самостоятельно. Строчная и заглавная.", letter_pages(nb)))


# ---- letters in alphabet order (owner, 2026-10-21: «просто буквы для отработки»): one page per letter, from tracing to writing alone ----
# The two parts above go by letter shape and give a letter two pages; these are plain practice in the order of the alphabet, the
# whole page one letter: the lowercase (fading copies, the row to trace, start dots, the model alone), then the capital the same way,
# a pair row at the bottom. No capital glyph (Ё Й, and Ъ Ы Ь have none) -> the whole page is the lowercase.
ALPHABET = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"


def ladder(t, n):
    """n rows of one letter, help shrinking down the page: fading copies, copies across the row, start dots only, the model alone."""
    steps = [row(t, "fade"), row(t, "all", gap=1), row(t, "one", "all", as_text=False, gap=1), sample(t)]
    shares = {8: (2, 2, 3, 1), ROWS: (3, 4, 7, 3)}[n]
    return [s for s, k in zip(steps, shares) for _ in range(k)]


def alphabet_page(lower):
    upper = lower.upper()
    if upper not in HAVE:
        return page(lower, ladder(lower, ROWS))
    return page(f"{upper} {lower}", ladder(lower, 8) + ladder(upper, 8) + [row(f"{upper}  {lower}", "one", "all", as_text=False, gap=2)])


for kid, part, letters in (("alphabet-1", "А–О", ALPHABET[:ALPHABET.index("о") + 1]), ("alphabet-2", "П–Я", ALPHABET[ALPHABET.index("п"):])):
    kits.append(kit(kid, f"Буквы по алфавиту, {part}", f"Буквы {part} по порядку, по странице на букву: строчная и заглавная — с затухающими копиями, обводка по строке, по точкам начала и самостоятельно.",
                    [alphabet_page(ch) for ch in letters]))

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

# ---- digits: the digits workbook (scripts/digits_workbook, the printed «Прописи — цифры»), page for page --------------------------
# Pages 1-20 on squared paper (5 mm, A5: 20 rows, a row every two cells), 21-24 digits inside handwritten text on the copybook ruling:
# a page's own paper (`paper`, over the kit's `page`). What the constructor has no row for yet is simplified: the two big rows
# (2 cells tall) are ordinary rows, the gap rows («1 _ 3 _ 5») and the half-tone traced sentences are a model and an empty row.
# «Model + start dots across the row» (repeat "one", dots "all") is the workbook's rhythm row: where the child writes alone.
sys.path.insert(0, str(ROOT / "scripts" / "digits_workbook"))
import digits_pages as dp  # noqa: E402

SQ_ROWS = 20
SQUARE = {"gridKind": "square", "ruling": "narrow", "grid": "regular", "margin": "left", "format": "a5", "midDash": True}
COPYBOOK = {"gridKind": "propis", "ruling": "narrow", "grid": "regular", "margin": "left", "format": "a5", "midDash": True}


def num(text):
    """Digits and signs as the rows keep them (glyph labels «№5», «№+»; fieldText.js digitsOut): every run of digits/signs that
    stands as a word, also before a closing comma or full stop («3.», «20,»)."""
    import re
    return re.sub(r"(?<!\S)([0-9+\-=<>−]+)(?=[.,!?]*(?:\s|$))", lambda m: "".join("№" + ("-" if c == "−" else c) for c in m.group(1)), text)


def trace(t):      # model + copies fading out: tracing
    return row(num(t), "fade", "all", as_text=False)


def rhythm(t):     # model, then only the start dots: the child writes alone
    return row(num(t), "one", "all", as_text=False)


def model(t):      # the model once, nothing else in the row
    return row(num(t), "one", "none", as_text=False)


def blank():
    return {"text": "", "kind": "blank", "repeat": "one", "dots": "none", "copies": "dash"}


def sq(title, rows):
    assert len(rows) <= SQ_ROWS, (title, len(rows))
    return {"title": title, "paper": SQUARE, "rows": rows}


def spaced(items):
    return " ".join(items)


def digit_page(d):
    done = dp.ORDER[:dp.ORDER.index(d)]
    rows = [trace(d)] * 6
    review = [row(num(spaced(done + d)), "all", "none", as_text=False), rhythm(spaced(done + d))] if done else []
    rows += [rhythm(d)] * (SQ_ROWS - len(rows) - len(review))
    return sq(f"Цифра {d}", rows + review)


def seq_rows(seq, n):
    out = []
    while len(out) < n:
        out += [model(spaced(seq)), blank()]
    return out[:n]


def numbers_page(title, numbers):
    rows = []
    for n in numbers:
        rows += [trace(n), trace(n), rhythm(n)]
    run = [str(i) for i in range(int(numbers[0]) - 1, int(numbers[-1]) + 1)]
    return sq(title, rows + seq_rows(run, SQ_ROWS - len(rows)))


def tens_page():
    tens = [str(10 * i) for i in range(1, 10)]
    twins = [str(11 * i) for i in range(1, 10)]
    rows = []
    for block in (tens, twins):
        for half in (block[:5], block[5:]):
            rows += [row(num(spaced(half)), "all", "none", as_text=False), rhythm(spaced(half))]
    mix = [a for pair in zip(tens, twins) for a in pair]
    rows += seq_rows(mix[:8], 2) + seq_rows(mix[8:16], 2)
    rows += [rhythm(spaced(h)) for h in (tens[:5], tens[5:], twins[:5], twins[5:])]
    return sq("Десятки и «близнецы»", rows)


def order_page():
    rows = []
    for a, b in dp.ORDER_PAIRS:
        rows += [row(num(f"{a} {b}"), "all", "none", as_text=False), rhythm(f"{a} {b}"), rhythm(f"{a} {b}")]
    return sq("Порядок цифр: 12 и 21", rows + seq_rows([u for pair in dp.ORDER_PAIRS[:4] for u in pair], SQ_ROWS - len(rows)))


def signs_page():
    rows = []
    for sign in "+−=":
        rows += [trace(sign), trace(sign), rhythm(sign), rhythm(sign)]
    exprs = ["1+1", "2+1", "3−1", "2−1", "1+2", "3+1", "4−1"]
    rows += [trace(e) for e in exprs]
    return sq("Знаки + − =", rows + [blank()] * (SQ_ROWS - len(rows)))


def examples_page(title, examples):
    half = SQ_ROWS // 2
    return sq(title, [(trace if i < half else rhythm)(examples[i % len(examples)]) for i in range(SQ_ROWS)])


def text_rows(models_top, models):
    """The workbook's text pages: every sentence with an empty row under it to copy it into (17 rows of the narrow ruling: 8 sentences).
    The printed workbook traced the top sentences (half-tone dashes) instead; the constructor has no traced sentence, and model rows
    one under another left nowhere to write (owner, 2026-10-08), so every one gets its row and what does not fit is left out."""
    rows = []
    for t in (models_top + models)[:ROWS // 2]:
        rows += [model(t), blank()]
    return rows


def tx(title, rows):
    return {"title": title, "paper": COPYBOOK, "rows": rows}


digit_pages = [digit_page(d) for d in dp.ORDER]
digit_pages += [
    sq("Число 10", [trace("10")] * 4 + [rhythm("10")] * 10 + seq_rows([str(i) for i in range(1, 11)], 6)),
    numbers_page("Числа 11–15", ["11", "12", "13", "14", "15"]),
    numbers_page("Числа 16–20", ["16", "17", "18", "19", "20"]),
    tens_page(),
    order_page(),
    signs_page(),
    examples_page("Примеры: плюс до 5", dp.PLUS5),
    examples_page("Примеры: минус до 5", dp.MINUS5),
    examples_page("Примеры до 10", dp.MIXED10),
    examples_page("Примеры до 20", dp.TWO_DIGIT),
    tx("Число и слово", text_rows(["1 кот, 2 кота, 5 котов", "1 мяч, 3 мяча, 6 мячей", "1 дом, 4 дома, 7 домов"],
                                  ["1 жук, 2 жука, 5 жуков", "1 лиса, 4 лисы, 8 лис", "1 кит, 2 кита, 6 китов", "1 рыба, 2 рыбы, 10 рыб", "1 слон, 2 слона, 7 слонов", "1 утка, 4 утки, 9 уток", "1 мак, 3 мака, 5 маков"])),
    tx("Сколько? Сколько лет?", text_rows(["Мне 7 лет.", "У меня 2 руки.", "У кота 4 лапы."],
                                          ["У меня 10 пальцев.", "Мне 5 лет, а Оле 3.", "У стула 4 ножки.", "В году 12 месяцев.", "У жука 6 лап.", "В классе 20 детей.", "У паука 8 лап."])),
    tx("Даты и время", text_rows(["1 мая, 8 марта", "9 мая, 1 июня", "31 декабря"],
                                 ["Сегодня 1 сентября.", "Урок в 9 утра.", "Обед в 1 час.", "Сон в 9 вечера.", "Новый год 1 января.", "8 марта праздник.", "в 7 утра, в 9 вечера"])),
    tx("Списываем", [model(t) for t in ["На столе 3 яблока.", "У Маши 2 кошки.", "Мы едем в 8 утра.", "В классе 20 детей.", "У папы 5 рыб.", "В саду 4 утки.", "Мне 7 лет!"]] + [blank()] * 10),
]
digits_kit = kit("digits", "Прописи — цифры", "Цифры по одной на страницу (1–9, потом 0) с точками начала и повторением пройденных, числа 10–20, десятки, порядок цифр, знаки + − = и примеры — в клетку; в конце цифры в тексте на косой линейке. Как печатная тетрадь «Прописи — цифры».", digit_pages)
digits_kit["page"] = SQUARE
kits.append(digits_kit)

# ---- punctuation: the punctuation workbook (scripts/punctuation_workbook, the printed «Прописи — знаки препинания»), page for page ---
# The same 24 pages and the same order: a mark alone on the frequent slants (rhythm pages), the mark after a letter and after a word,
# in lists, in sentences, copying under a model and from a distance. What the constructor has no row for is simplified as in the
# digits kit: a printed row of DIFFERENT items to trace («а, Б, в, …») is one item per row with its copies across the row; the
# «grow a dot into the mark» page (p18) is the same sequences with fading copies.
sys.path.insert(0, str(ROOT / "scripts" / "punctuation_workbook"))
import random  # noqa: E402

import pages as pw  # noqa: E402

DENSE = {**PAGE, "grid": "dense"}


def pw_page(title, rows, dense=False):
    assert len(rows) <= ROWS, (title, len(rows))
    p = page(title, rows)
    if dense:
        p["paper"] = DENSE
    return p


def mark(t, repeat="all", gap=None):
    """A mark (or a short group of marks: «. .», «,.,») across the row; `gap` = extra cells between the copies."""
    return row(t, repeat, "none", as_text=False, gap=gap)  # a start dot would sit right on a full stop and hide it


def gap(group):
    return 5 if " " in group else 3  # spaced marks: the group must stand clearly apart from the next one


def rhythm_marks(title, one, groups):
    """A rhythm page: the mark wide apart, then close, then groups of marks, then a model with fading copies (the printed page's
    four blocks of four rows), the name of the mark as a model at the top."""
    rows = [row(title, "one", "none", as_text=False)]
    rows += [mark(one, gap=3)] * 4 + [mark(one, gap=1)] * 4
    rows += [mark(g, gap=gap(g)) for g in (groups * 4)[:4]]
    rows += [mark(g, "fade", gap=gap(g)) for g in (([one] + groups) * 4)[:4]]
    return rows


def items_rows(items, seed):
    """One item per row with its copies across the row, a different item opening every row (the printed chain rows)."""
    rng = random.Random(seed)
    items = items[:]
    rng.shuffle(items)
    return [mark(items[i % len(items)], gap=2) for i in range(ROWS)]


def ok(t):
    return not missing(t)


def letters_with_comma(seed):
    rng = random.Random(seed)
    out = []
    for ch in pw.LETTERS:
        up = ch.upper()
        out.append(f"{up if up in HAVE and rng.random() < 0.5 else ch},")
    return out


def copy_rows(models, seed):
    """Model + an empty row under it, eight times; the 17th row is a letter with a comma (the printed copy pages)."""
    rows = []
    for m in models:
        rows += [model(m), blank()]
    return rows + [mark(letters_with_comma(seed)[seed % len(pw.LETTERS)], gap=2)]


def distance_rows(models, seed):
    """All models at the top, the rows to write them into below (copying from a distance); what is left over: a word with a mark."""
    rows = [model(m) for m in models] + [blank()] * len(models)
    rng = random.Random(seed)
    words = pw.SHORT_WORDS[:]
    rng.shuffle(words)
    while len(rows) < ROWS:
        w = words[len(rows) % len(words)]
        m = rng.choice(".,?!")
        rows.append(mark((w.capitalize() if m != "," else w) + m, gap=2))
    return rows


def seq_rows(seqs, tail):
    """The printed «grow the dot into the mark» page: a sequence of marks to continue along the row. The printed dots (the part every
    mark shares) do not exist here, and start dots under every mark crowd the row: the model with copies fading out, the child goes on."""
    return [mark(s, "fade", gap=gap(s)) for s in (seqs + tail * ROWS)[:ROWS]]


def sp(group):
    """A printed group of marks two cells apart: «.,» -> «. ,» (a group written as in a text, «!!» «!!!», is given as it is)."""
    return " ".join(group)


P = []
P.append(pw_page("Точка", rhythm_marks("Точка", ".", [sp("..")]), dense=True))
P.append(pw_page("Запятая", rhythm_marks("Запятая", ",", [sp(",,")]), dense=True))
P.append(pw_page("Точка и запятая", rhythm_marks("Точка и запятая", sp(".,"), [sp(s) for s in (".,,.", ",.,.", "..,,", ",..,")]), dense=True))
P.append(pw_page("Буква и запятая", items_rows([x for x in letters_with_comma(4) if ok(x)], 4)))
P.append(pw_page("Слово и запятая", items_rows([w + "," for w in pw.SHORT_WORDS], 5)))
P.append(pw_page("Перечисление", copy_rows(["хлеб, сыр, сок, чай", "кот, пёс, мышь, ёж", "мама, папа, я, Оля", "рыба, рак, кит, сом",
                                             "шар, мяч, кукла, юла", "дом, сад, лес, луг", "суп, каша, чай, торт", "зима, весна, лето, осень"], 6)))
P.append(pw_page("Перечисление в предложении", copy_rows(["Я взял хлеб, сыр и сок.", "Тут кот, пёс и ёж.", "Вот лук, мак и мёд.", "Там лес, луг и сад.",
                                                           "Я ем суп, кашу и сыр.", "Там рыба, рак и кит.", "Я вижу дом, сад и лес.", "У Оли мяч, шар и кот."], 7)))
P.append(pw_page("Запятая и точка", rhythm_marks("Запятая и точка", ",", [sp(s) for s in (",,.", ".,,", ",.,", ",,,")]), dense=True))
P.append(pw_page("Восклицательный знак", rhythm_marks("Ура!", "!", ["!!", "!!!"]), dense=True))
P.append(pw_page("Точка и !", rhythm_marks("Точка и !", sp(".!,"), [sp(s) for s in (".!,", "!,.", ",.!", "!.,")]), dense=True))
P.append(pw_page("Слово и !", items_rows(pw.EXCLAMATIONS, 11)))
P.append(pw_page("Предложения с !", copy_rows(["Какой большой кот!", "Какой чудесный день!", "Какой добрый пёс!", "Тише, тут спят!", "Стой, тут лужа!",
                                                "Мама, иди сюда!", "Смотри, радуга!", "Папа, лови мяч!"], 12)))
P.append(pw_page("Вопросительный знак", rhythm_marks("Кто?", "?", [sp("??"), sp("?!")]), dense=True))
P.append(pw_page("? и !", rhythm_marks("Где? Ура!", sp("?!"), [sp(s) for s in ("?!.", "!?,", ".?!", ",!?")]), dense=True))
P.append(pw_page("Слово и ?", items_rows(pw.QUESTIONS, 15)))
P.append(pw_page("Вопросы", copy_rows(["Кто там стучит?", "Где лежит книга?", "Почему небо синее?", "Когда будет обед?", "Ты любишь кашу?",
                                        "Куда идёт папа?", "Что ты рисуешь?", "Кто съел торт?"], 16)))
P.append(pw_page(". ? !", copy_rows(["Да. Да? Да!", "Нет. Нет? Нет!", "Кот. Кот? Кот!", "Иди. Иди? Иди!", "Это кот. Это кот?", "Он спит. Он спит!",
                                     "Мы тут. Мы тут?", "Снег идёт. Снег идёт!"], 17)))
P.append(pw_page("Ряды знаков", seq_rows(["  ".join(s) for s in [",", "!", "?", ",", ",!", "?,", "!?", ".,", "?!", ",!?.", "?.,!", "!,.?", ".?!,"]],
                                          ["  ".join(s) for s in (",!?.", "!.,?", "?,.!", ".!?,")])))
P.append(pw_page("Запятая, ? и !", copy_rows(["Смотри, какой дом!", "Где хлеб, сыр и сок?", "Коля, иди обедать!", "Аня, где мой мяч?", "Ах, какая роза!",
                                              "Мама, можно сок?", "Ой, какой ёжик!", "Бабушка, ты где?"], 19)))
P.append(pw_page("Списываем 1", copy_rows(["Кто там? Это я.", "Где кот? Вот он!", "Мама, ты где? Я тут.", "Ура! Снег идёт.", "Что это? Это ёж.",
                                           "Ой, дождь! Беги домой.", "Папа, ты дома? Да.", "Тише! Малыш спит."], 20)))
P.append(pw_page("Списываем 2", copy_rows(["Можно сок? Можно.", "Где мяч? Он там.", "Кто это? Это Оля.", "Ты рад? Очень!", "Аня, ты где? Иди есть!",
                                           "Где книга? Вот она.", "Стой! Там лужа.", "Кто пришёл? Бабушка!"], 21)))
P.append(pw_page("По памяти 1", distance_rows(["Оля, ты где? Я тут!", "Ой, снег! Ура, зима!", "Кто там? Папа, ты?", "Где кот? Вон, на окне.",
                                               "Кто там? Это я, Оля.", "Где сыр? Вот, на столе."], 22)))
P.append(pw_page("По памяти 2", distance_rows(["Ваня, стой! Там лужа.", "Ура! Мы едем в лес.", "Мама, где сок? Вот он.", "Ой, дождь! Беги, Оля!",
                                               "Кто это? Это я, Витя.", "Смотри, птица! Где?", "Ты рад? Да, очень!"], 23)))
P.append(pw_page("По памяти 3", distance_rows(["Ура, снег! Бежим, Оля!", "Ой, какой кот! Чей он?", "Лови мяч, Оля! Лови!", "Кто съел торт? Не я!",
                                               "Мы ели суп, кашу и сыр.", "Ура! Снег, горка, санки!", "Где мяч? Вот он, Оля!", "Кто там? Это я, мама."], 24)))
kits.append(kit("punctuation", "Прописи — знаки препинания", "Точка, запятая, ! и ?: отдельный знак на частой косой (ритм по наклонным), знак после буквы и слова, перечисление, предложения, списывание под образцом и по памяти. Как печатная тетрадь «Прописи — знаки препинания».", P))

# Blank copybooks (owner, 2026-10-14: «пустографки»): 12 notebook leaves = 24 pages of the copybook ruling, nothing written, the red
# margin as in the printed notebooks; one on the narrow row, one on the wide. Printed with any cover, «По порядку» or «Тетрадью».
BLANK_LEAVES = 12
for kid, ruling, name, rows in (("blank-narrow", "narrow", "узкая строка", 17), ("blank-wide", "wide", "широкая строка", 16)):
    blank_kit = kit(kid, f"Пропись — {name}", f"Чистая тетрадь на {BLANK_LEAVES} листов: {BLANK_LEAVES * 2} страницы косой линейки ({name}) без образцов.",
                    [page(f"Стр. {i + 1}", [blank()] * rows) for i in range(BLANK_LEAVES * 2)])
    blank_kit["group"] = "Чистые тетради"
    blank_kit["page"] = {**PAGE, "ruling": ruling}
    kits.append(blank_kit)
# the frequent slants (owner, 2026-10-21: the `propis` «Тетрадь — плотная косая», 3 mm slants, had no blank notebook here): the
# editor's «Частая» slants on the narrow row (2.5 mm, the letters' own cell)
blank_kit = kit("blank-dense", "Пропись — частая косая", f"Чистая тетрадь на {BLANK_LEAVES} листов: {BLANK_LEAVES * 2} страницы узкой строки с частыми косыми линиями (через 2,5 мм) без образцов.",
                [page(f"Стр. {i + 1}", [blank()] * ROWS) for i in range(BLANK_LEAVES * 2)])
blank_kit["group"] = "Чистые тетради"
blank_kit["page"] = DENSE
kits.append(blank_kit)
# and the plain school papers (owner, 2026-10-14), the same paper as «Клетка» / «Линейка» in the editor; ruled paper has its own
# rows: a line every 8 mm, 24 on an A5 page (PrintPageView OWN_ROWS)
RULED_ROWS = 24
for kid, paper, name, rows in (("blank-square", SQUARE, "в клетку", SQ_ROWS), ("blank-ruled", {**PAGE, "gridKind": "ruled"}, "в линейку", RULED_ROWS)):
    blank_kit = kit(kid, f"Тетрадь {name}", f"Чистая тетрадь {name} на {BLANK_LEAVES} листов ({BLANK_LEAVES * 2} страницы).",
                    [page(f"Стр. {i + 1}", [blank()] * rows) for i in range(BLANK_LEAVES * 2)])
    blank_kit["group"] = "Чистые тетради"
    blank_kit["page"] = paper
    kits.append(blank_kit)

out = ROOT / "src" / "topics" / "renderers" / "propis2" / "kits.json"
out.write_text(json.dumps({"version": 1, "kits": kits}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(kits)} kits -> {out} ({out.stat().st_size // 1024} KB)")
for k in kits:
    print(f"  {k['id']}: {len(k['pages'])} pages")
for line in sorted(set(report))[:30]:
    print("  !", line)
print(f"  warnings: {len(set(report))}")
