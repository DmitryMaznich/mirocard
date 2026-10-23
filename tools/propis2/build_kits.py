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


def row(text, repeat="all", dots="all", as_text=None, kind="text", gap=None, even=False):
    r = {"text": text, "kind": kind, "repeat": repeat, "dots": dots, "copies": "dash"}
    if as_text is not None:
        r["asText"] = as_text
    if gap:
        r["gap"] = gap
    if even:
        r["even"] = True
    return r


def sample(text, repeat="one", gap=None, even=False):
    """A row of the independent-practice pages: the model once at the start, the rest of the row is the child's."""
    return row(text, repeat=repeat, dots="one", as_text=False, gap=gap, even=even)


def pair(upper, lower, repeat="fade", dots="all"):
    """A pair «Аа»: the capital FIRST, then the lowercase (there is no connection in front of a capital, and the lowercase must not
    run into it), the next pair 2 cells further off. `even` (model.js, wordEngine `#v`): every letter a fixed gap after the ink of
    the one before, as the alphabet on the cover's back. Counted in slant cells from the capital's start instead, a wide capital
    (Г Б Д Ж Ф …) pushed its lowercase a whole cell further than И did its и (owner, 2026-10-21)."""
    return row(f"{upper} {lower}", repeat, dots, as_text=False, gap=2, even=True)


def chunks(rows, n=ROWS):
    return [rows[i:i + n] for i in range(0, len(rows), n)]


def page(title, rows):
    return {"title": title, "rows": rows}


def missing(text):
    return [ch for tok in text.split() if tok not in HAVE for ch in tok if ch.isalpha() and ch not in HAVE]


report = []


def kit(kid, title, description, pages):
    for p in pages:
        for r in p["rows"]:
            m = missing(r["text"])
            if m:
                report.append(f"{kid}: «{r['text']}» нет начертания: {''.join(m)}")
    return {"id": kid, "title": title, "description": description, "group": "Методика", "page": PAGE, "pages": pages}


kits = []


# ---- texts: a model text at the top of the page, the rest of the page is for copying ----------------------------------------------
texts_kit = (kit("texts", "16. Списываем текст", "Последняя ступень: короткий текст образцом вверху страницы, ниже строки, чтобы списать его целиком.",
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
digits_kit = kit("digits", "Цифры", "Отдельно от букв, не ступень лесенки: можно вести в любое время. В клетку — цифры по одной (1–9, 0) с повторением пройденных, числа до 20, знаки + − = и примеры; в конце цифры в тексте на косой линейке.", digit_pages)
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
punct_kit = (kit("punctuation", "15. Знаки препинания", "Точка, запятая, ! и ?: сначала знак отдельно на частой косой, затем после буквы и слова, в перечислении и предложении, списывание под образцом и по памяти.", P))

# ==== The series (owner, 2026-10-23; plan: docs/propis2-series-plan.md) ==============================================================
# One methodical series of ready notebooks, as a primary teacher and a speech therapist for children with ASD would lay it out: every
# notebook exactly 24 A5 pages (12 notebook leaves: printed «Тетрадью», 6 A4 sheets folded and stapled, nothing to trim), one new thing
# at a time, a new element or letter gets 2-3 pages, a review page every few pages, the last page sums the notebook up. The WIDE row
# holds only what stays inside the row (elements without loops, а г е ё ж и й к л м н о п с т х ч ш ъ ы ь э ю я — the methodology's
# first part); loops, б в д з р у ф ц щ and every capital come on the NARROW row. All lowercase first, the capitals after.
SERIES_PAGES = 24
W_ROWS, N_ROWS = 16, 17
S_WIDE = {**PAGE, "ruling": "wide", "grid": "dense"}   # the frequent slants of the methodology sheets: they show the slope
S_NARROW = {**PAGE, "grid": "dense"}
HAVE |= {"Ё", "Й"}  # built from Е / И and the marks in the app (propis2/glyphOverrides.js withMarkedCapitals), not in wide.json
ELEMENT_IDS = {e["id"] for e in json.load(open(ROOT / "tools" / "propis" / "elements.json", encoding="utf-8"))["elements"]}
HAVE |= ELEMENT_IDS  # drawn from elements.json by id (pageTask.js buildGlyphMap)
# what makes an element row (the editor's «Элемент» kind): the elements.json ids and the wide elements that are not a letter
ELEMENT_TOKENS = ELEMENT_IDS | {g["label"] for g in wide["glyphs"] if g.get("kind") == "element" and not (len(g["label"]) == 1 and g["label"].isalpha())}

# the elements the series uses: only those checked on the page (owner's capture; the badly drawn ones of elements.json are left out)
E = {
    "|": "Наклонная палочка", "5": "Соединительная черта", "заборчик": "Заборчик", "22_zaborchik_peremennyy": "Переменный заборчик",
    "25_palka_naklon_vysokaya": "Длинная соединительная", "6": "Палочка с закруглением внизу", "8": "Палочка с закруглением вверху",
    "7 |": "Соединительная и палочка", "г1": "Закругление вверху и внизу", "п1": "Арка", "| 5": "Палочка и черта",
    "5 6": "Черта и крючок", "р": "Арка с палочкой вниз (основа «р»)", "у1": "Петля вниз", "у2": "Петля вниз с перекладиной", "в1": "Петля вверх",
}
LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"


def one_letter(t):
    return len(t) == 1 and t.isalpha()


# fences: one stroke that closes on itself — traced, the engine draws them as ONE unbroken line across the row (an «auto» row, as the
# methodology sheets have them); a fading copy would cut the fence into pieces, so their «fading» rows are traced in full too
CHAIN = {"заборчик", "22_zaborchik_peremennyy"}


def s_gap(t):
    # copies a cell apart: a single letter or element (a stick on every slant line was too dense to start with), and a word (a copy of
    # «Утро» ran into the next one: У's hook ends left of its stem). Fences are one unbroken line.
    return None if t in CHAIN else 1


def chain_row(t):
    r = {"text": t, "kind": "element", "repeat": "auto", "dots": "all", "copies": "dash"}  # «auto»: the engine's own rule, the unbroken fence
    return r


def as_element(r):
    if all(tok in ELEMENT_TOKENS for tok in r["text"].split()):
        r["kind"] = "element"
    return r


def s_fade(t):
    return chain_row(t) if t in CHAIN else as_element(row(t, "fade"))


def s_trace(t):
    return chain_row(t) if t in CHAIN else as_element(row(t, "all", gap=s_gap(t)))


def s_dots(t):
    return as_element(row(t, "one", "all", as_text=False, gap=s_gap(t)))


def s_alone(t):
    return as_element(sample(t))


def s_intro(t, n):
    """«Знакомство»: 4 fading copies, 4 traced across the row, 4 by the start dots, the rest alone, the last row an easy trace (end on success)."""
    return [s_fade(t)] * 4 + [s_trace(t)] * 4 + [s_dots(t)] * 4 + [s_alone(t)] * (n - 13) + [s_trace(t)]


def s_cons(t, n):
    """«Закрепление»: less help, more alone; the last row an easy trace."""
    f, d = max(1, round(n * 2 / 16)), round(n * 6 / 16)
    return [s_fade(t)] * f + [s_dots(t)] * d + [s_alone(t)] * (n - f - d - 1) + [s_trace(t)]


def s_review(items, n):
    """«Повторение»: every row another item already learnt — first half by the start dots, then alone; the last row an easy trace."""
    k = n - 1
    rows = [(s_dots if i < k // 2 else s_alone)(items[i % len(items)]) for i in range(k)]
    return rows + [s_trace(items[0])]


def s_words(ws, n):
    """«Слоги и слова»: two rows an item (traced across the row, then the model and alone); the last row an easy trace."""
    rows = []
    for i in range(n):
        w = ws[(i // 2) % len(ws)]
        rows.append(s_trace(w) if i % 2 == 0 else s_alone(w))
    return rows[: n - 1] + [s_trace(ws[0])]


def s_final(items, n):
    """«Итог»: everything of the notebook, a model at the start of each row only."""
    return [s_alone(items[i % len(items)]) for i in range(n - 1)] + [s_trace(items[0])]


def s_page(title, rows, paper):
    return {"title": title, "paper": paper, "rows": rows}


def checked(words_, allowed):
    """Words of a page must use only the letters learnt so far (lowercase): the series never runs ahead of the child."""
    bad = [w for w in words_ if not set(w.lower()) <= set(allowed) | {" "}]
    assert not bad, (bad, allowed)
    return words_


def letter_pages(letters, n, paper):
    out = []
    for ch in letters:
        out += [s_page(ch, s_intro(ch, n), paper), s_page(ch, s_cons(ch, n), paper)]
    return out


def series_kit(kid, title, description, pages, paper):
    assert len(pages) == SERIES_PAGES, (kid, len(pages))
    k = kit(kid, title, description, pages)
    k["page"] = paper
    return k


series = []
# ---- 1. elements: sticks and fences (wide) ----------------------------------------------------------------------------------------
P1 = [
    *[s_page(E["|"], f("|", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    *[s_page(E["5"], f("5", W_ROWS), S_WIDE) for f in (s_intro, s_cons)],
    s_page("Повторение", s_review(["|", "5"], W_ROWS), S_WIDE),
    *[s_page(E["заборчик"], f("заборчик", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    *[s_page(E["22_zaborchik_peremennyy"], f("22_zaborchik_peremennyy", W_ROWS), S_WIDE) for f in (s_intro, s_cons)],
    s_page("Повторение", s_review(["|", "5", "заборчик", "22_zaborchik_peremennyy"], W_ROWS), S_WIDE),
    *[s_page(E["25_palka_naklon_vysokaya"], f("25_palka_naklon_vysokaya", W_ROWS), S_WIDE) for f in (s_intro, s_cons)],
    *[s_page(E["| 5"], f("| 5", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    s_page("Повторение", s_review(["|", "5", "заборчик", "25_palka_naklon_vysokaya", "| 5"], W_ROWS), S_WIDE),
    *[s_page("Чередуем", s_cons(t, W_ROWS), S_WIDE) for t in ("| 5", "заборчик", "22_zaborchik_peremennyy", "| 5", "25_palka_naklon_vysokaya")],
    s_page("Итог", s_final(["|", "5", "заборчик", "22_zaborchik_peremennyy", "25_palka_naklon_vysokaya", "| 5"], W_ROWS), S_WIDE),
]
series.append(series_kit("s01-sticks", "1. Палочки и заборчики", "Широкая строка, только элементы: наклонная палочка, соединительная черта, заборчики. Каждый элемент 2–3 страницы, повторение, итог.", P1, S_WIDE))

# ---- 2. elements: hooks and curves (wide) ------------------------------------------------------------------------------------------
P2 = [
    *[s_page(E["6"], f("6", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    *[s_page(E["8"], f("8", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    s_page("Повторение", s_review(["6", "8", "|"], W_ROWS), S_WIDE),
    *[s_page(E["7 |"], f("7 |", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    *[s_page(E["г1"], f("г1", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    s_page("Повторение", s_review(["6", "8", "7 |", "г1"], W_ROWS), S_WIDE),
    *[s_page(E["п1"], f("п1", W_ROWS), S_WIDE) for f in (s_intro, s_cons, s_cons)],
    *[s_page(E["5 6"], f("5 6", W_ROWS), S_WIDE) for f in (s_intro, s_cons)],
    *[s_page("Чередуем", s_cons(t, W_ROWS), S_WIDE) for t in ("6 8", "п1 |", "5 6", "6 8")],
    s_page("Итог", s_final(["|", "заборчик", "6", "8", "7 |", "г1", "п1", "5 6"], W_ROWS), S_WIDE),
]
series.append(series_kit("s02-hooks", "2. Крючки и закругления", "Широкая строка, только элементы: палочки с закруглением внизу и вверху, соединительная с палочкой, арка. Из них потом складываются буквы.", P2, S_WIDE))

# ---- 3-5. the letters inside the row (wide) -----------------------------------------------------------------------------------------
L3, L4, L5 = "ийшнптгк", "лмяоаюс", "еёэхжчьыъ"
A3, A4, A5 = L3, L3 + L4, L3 + L4 + L5
P3 = [
    *letter_pages("ийш", W_ROWS, S_WIDE),
    s_page("Слоги", s_words(checked(["ии", "иш", "ши", "шиш", "ий", "ши"], A3), W_ROWS), S_WIDE),
    *letter_pages("нпт", W_ROWS, S_WIDE),
    s_page("Слоги", s_words(checked(["ни", "ин", "пи", "ип", "ти", "нини", "нипи"], A3), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["тип", "нити", "шип", "шипит", "ини", "инш", "тип"], A3), W_ROWS), S_WIDE),
    s_page("Повторение", s_review(list("ийшнпт"), W_ROWS), S_WIDE),
    *letter_pages("гк", W_ROWS, S_WIDE),
    s_page("Слова", s_words(checked(["ги", "ки", "кит", "пик", "тик", "шик", "книги"], A3), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["нитки", "пикник", "шипит", "книги", "кит", "тип", "нити"], A3), W_ROWS), S_WIDE),
    s_page("Повторение", s_review(list(L3), W_ROWS), S_WIDE),
    s_page("Итог", s_final(list(L3) + ["нити", "книги"], W_ROWS), S_WIDE),
]
series.append(series_kit("s03-letters-i", "3. Буквы и й ш н п т г к", "Широкая строка. Первые буквы — из знакомых элементов: каждая 2 страницы, затем слоги и слова только из пройденных букв.", P3, S_WIDE))

P4 = [
    *letter_pages("лмя", W_ROWS, S_WIDE),
    s_page("Слоги и слова", s_words(checked(["ли", "ил", "мл", "мини", "лимит", "пилит", "клип"], A3 + "лмя"), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["линии", "мял", "як", "няня", "лилия", "мини", "лимит"], A3 + "лмя"), W_ROWS), S_WIDE),
    *letter_pages("оа", W_ROWS, S_WIDE),
    s_page("Слова", s_words(checked(["он", "по", "пол", "тон", "кот", "пион", "котик"], A3 + "лмяоа"), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["мама", "папа", "лапа", "молоко", "панама", "лимон", "пилот"], A3 + "лмяоа"), W_ROWS), S_WIDE),
    s_page("Повторение", s_review(list("лмяоа"), W_ROWS), S_WIDE),
    *letter_pages("юс", W_ROWS, S_WIDE),
    s_page("Слова", s_words(checked(["юла", "юн", "сок", "оса", "нос", "сом", "лиса"], A4), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["сосиска", "компас", "салат", "сито", "масло", "стол", "мост"], A4), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["лист", "плита", "пилот", "молоток", "потолок", "солома", "полоса"], A4), W_ROWS), S_WIDE),
    s_page("Повторение", s_review(list(L4), W_ROWS), S_WIDE),
    s_page("Итог", s_final(list(L4) + ["мама", "лиса"], W_ROWS), S_WIDE),
]
series.append(series_kit("s04-letters-l", "4. Буквы л м я о а ю с", "Широкая строка. Буквы л м я, затем овал на буквах о и а, затем ю с; слова только из пройденных букв.", P4, S_WIDE))

P5 = [
    *letter_pages("еёэ", W_ROWS, S_WIDE),
    s_page("Слова", s_words(checked(["пе", "ен", "енот", "пена", "ёлка", "эти", "поэт"], A4 + "еёэ"), W_ROWS), S_WIDE),
    *letter_pages("хжч", W_ROWS, S_WIDE),
    s_page("Слова", s_words(checked(["хи", "хохолок", "этаж", "жасмин", "мяч", "печка", "чай"], A4 + "еёэхжч"), W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["ножи", "ёж", "каша", "чашка", "ножка", "кошка", "лапша"], A4 + "еёэхжч"), W_ROWS), S_WIDE),
    s_page("Повторение", s_review(list("еёэхжч"), W_ROWS), S_WIDE),
    *letter_pages("ьы", W_ROWS, S_WIDE),
    s_page("ъ", s_intro("ъ", W_ROWS), S_WIDE),
    s_page("Слова", s_words(checked(["печь", "мышь", "ночь", "ты", "мы", "сыт", "съел"], A5), W_ROWS), S_WIDE),
    s_page("Повторение", s_review(list(A5), W_ROWS), S_WIDE),
    s_page("Итог", s_final(list(L5) + ["ёлка", "мяч", "мышь"], W_ROWS), S_WIDE),
]
series.append(series_kit("s05-letters-e", "5. Буквы е ё э х ж ч ь ы ъ", "Широкая строка. Последние буквы, которые помещаются в строку; в конце — повторение всех строчных внутри строки.", P5, S_WIDE))

# ---- 6. the same letters on the narrow row: only the size of the row changes ------------------------------------------------------
def two_letters(a, b, n):
    h = n // 2
    return s_cons(a, h) + s_cons(b, n - h)


P6 = [s_page(f"{a} {b}", two_letters(a, b, N_ROWS), S_NARROW) for a, b in ("ий", "шн", "пт", "гк", "лм", "яо", "аю", "се", "ёэ", "хж", "чь", "ыъ")]
P6 += [s_page("Повторение", s_review(list(g), N_ROWS), S_NARROW) for g in (L3, L4, L5)]
P6 += [s_page("Слова", s_words(checked(ws, A5), N_ROWS), S_NARROW) for ws in (
    ["нити", "книги", "пикник", "шипит", "тип", "кит", "нитки", "шик"],
    ["лимит", "пилит", "мини", "няня", "лилия", "мял", "клип", "линии"],
    ["кот", "пол", "молоко", "лимон", "пилот", "котик", "поток", "молоток"],
    ["мама", "папа", "лапа", "панама", "юла", "сок", "оса", "нос"],
    ["лиса", "стол", "мост", "салат", "сито", "масло", "лист", "плита"],
    ["енот", "пена", "ёлка", "поэт", "эти", "сом", "полёт", "место"],
    ["ножи", "ёж", "каша", "чашка", "кошка", "мяч", "печка", "лапша"],
    ["печь", "мышь", "ночь", "ты", "мы", "сыт", "съел", "мел"],
)]
P6.append(s_page("Итог", s_final(list(A5), N_ROWS), S_NARROW))
series.append(series_kit("s06-narrow", "6. Знакомые буквы на узкой строке", "Переход на узкую строку: те же буквы и слова, что в тетрадях 3–5, меняется только высота строки.", P6, S_NARROW))

# ---- 7. loops (narrow) -------------------------------------------------------------------------------------------------------------
P7 = [
    *[s_page(E["р"], f("р", N_ROWS), S_NARROW) for f in (s_intro, s_cons, s_cons, s_cons)],
    *[s_page(E["у1"], f("у1", N_ROWS), S_NARROW) for f in (s_intro, s_cons, s_cons)],
    s_page(E["у2"], s_intro("у2", N_ROWS), S_NARROW),
    *[s_page("Повторение", s_review(items, N_ROWS), S_NARROW) for items in (["р", "у1"], ["у1", "у2", "р"])],
    *[s_page(E["в1"], f("в1", N_ROWS), S_NARROW) for f in (s_intro, s_cons, s_cons, s_cons)],
    *[s_page("Повторение", s_review(items, N_ROWS), S_NARROW) for items in (["в1", "р"], ["в1", "у1", "р", "у2"])],
    *[s_page("Чередуем", s_cons(t, N_ROWS), S_NARROW) for t in ("| р", "6 у1", "в1 6", "р у1", "у1 в1", "п1 р", "8 у1")],
    s_page("Итог", s_final(["р", "у1", "у2", "в1", "р у1", "у1 в1"], N_ROWS), S_NARROW),
]
series.append(series_kit("s07-loops", "7. Петли", "Узкая строка, только элементы: палочка вниз за строку, петля вниз, петля вверх — основа букв р у д з б в.", P7, S_NARROW))

# ---- 8. the letters below the row (narrow) ------------------------------------------------------------------------------------------
A8 = A5 + "руздцщ"
P8 = [
    *letter_pages("ру", N_ROWS, S_NARROW),
    *[s_page("Слова", s_words(checked(ws, A5 + "ру"), N_ROWS), S_NARROW) for ws in (["пир", "гири", "крик", "тир", "рот", "нора", "сыр", "река"], ["ум", "паук", "утка", "рука", "урок", "гора", "куртка", "суп"])],
    *letter_pages("дз", N_ROWS, S_NARROW),
    *[s_page("Слова", s_words(checked(ws, A5 + "рудз"), N_ROWS), S_NARROW) for ws in (["дом", "дед", "дуга", "радуга", "дедушка", "дорога", "дыня", "день"], ["зонт", "коза", "заноза", "зима", "роза", "гроза", "мимоза", "узел"])],
    *letter_pages("цщ", N_ROWS, S_NARROW),
    *[s_page("Слова", s_words(checked(ws, A8), N_ROWS), S_NARROW) for ws in (["цирк", "конец", "лицо", "огурец", "курица", "яйцо", "сердце", "цапля"], ["щука", "щенок", "щи", "роща", "ящик", "плащ", "щётка", "пища"])],
    s_page("Повторение", s_review(list("руздцщ"), N_ROWS), S_NARROW),
    *[s_page("Слова", s_words(checked(ws, A8), N_ROWS), S_NARROW) for ws in (["мороз", "руки", "ноги", "друг", "мир", "сад", "душ", "дождь"],
                                                                         ["гнездо", "медуза", "кукуруза", "узор", "пузырь", "грузди", "заря", "дыра"],
                                                                         ["ромашка", "черепаха", "задача", "дача", "туча", "дудка", "щит", "царь"])],
    s_page("Повторение", s_review(list(A8[-6:]) + ["рука", "зима"], N_ROWS), S_NARROW),
    s_page("Итог", s_final(list("руздцщ") + ["радуга", "щука"], N_ROWS), S_NARROW),
]
series.append(series_kit("s08-letters-r", "8. Буквы р у д з ц щ", "Узкая строка. Буквы с петлёй или палочкой вниз за строку; после каждой пары букв — слова из пройденного.", P8, S_NARROW))

# ---- 9. the letters above the row + the whole lowercase alphabet (narrow) -----------------------------------------------------------
P9 = [
    *[s_page(ch, f(ch, N_ROWS), S_NARROW) for ch in "бвф" for f in (s_intro, s_cons, s_cons)],
    *[s_page("Слова", s_words(checked(ws, LOWER), N_ROWS), S_NARROW) for ws in (
        ["барабан", "бабочка", "банан", "белка", "баобаб", "коробка", "рыба", "хлеб"],
        ["ветер", "вода", "сова", "волк", "диван", "удав", "павлин", "морковь"],
        ["кофе", "лифт", "фонари", "фабрика", "шарф", "жираф", "футболка", "шкаф"],
        ["бабушка", "вилка", "ведро", "зебра", "буква", "фонтан", "обувь", "завтрак"],
        ["воробей", "бегемот", "фиалка", "верблюд", "буфет", "автобус", "вафли", "сова"],
    )],
    *[s_page("Алфавит", s_review(list(LOWER[i:i + 4]), N_ROWS), S_NARROW) for i in range(0, 32, 4)],
    s_page("Алфавит", s_review(["я", "ё", "й", "щ"], N_ROWS), S_NARROW),
    s_page("Итог", s_final(list("бвф") + ["бабочка", "ветер", "кофе"], N_ROWS), S_NARROW),
]
series.append(series_kit("s09-letters-b", "9. Буквы б в ф и весь алфавит", "Узкая строка. Буквы с петлёй вверх; затем весь строчный алфавит по порядку — повторение перед заглавными.", P9, S_NARROW))


# ---- 10-11. capitals (narrow), in the teacher's groups by shape ---------------------------------------------------------------------
def capital_pages(caps):
    out = []
    for C in caps:
        c = C.lower()
        rows = s_intro(C, N_ROWS)[:-3] + [pair(C, c, "one", "all"), pair(C, c, "one", "one"), s_trace(C)]
        out.append(s_page(f"{C} {c}", rows, S_NARROW))
    return out


NAMES = [w for w in words.BLOCK_B + words.block_a_notebook_words() if w[0].isupper() and w[1:].islower()]
C10, C11 = "ИШЦЩУЧГПТРЛАНЮКЙ", "МЯОФБДЗВЕСЭХЖЁ"


def capital_words(caps, n_pages):
    # names and words with a capital learnt so far; a capital's own word where there is no name for it
    extra = {"И": "Ира", "Ш": "Шар", "Ц": "Цирк", "Щ": "Щука", "У": "Утро", "Ч": "Чай", "Г": "Гриша", "П": "Петя", "Т": "Таня",
             "Р": "Рома", "Л": "Лена", "А": "Аня", "Н": "Нина", "Ю": "Юля", "К": "Коля", "Й": "Йогурт", "М": "Маша", "Я": "Яна",
             "О": "Оля", "Ф": "Федя", "Б": "Боря", "Д": "Даша", "З": "Зоя", "В": "Вера", "Е": "Егор", "С": "Соня", "Э": "Эля",
             "Х": "Хлеб", "Ж": "Женя", "Ё": "Ёжик"}
    ws = list(dict.fromkeys([extra[C] for C in caps] + [w for w in NAMES if w[0] in caps]))
    return [s_page("Имена и слова", s_words(ws[i * 8 % len(ws):][:8] or ws[:8], N_ROWS), S_NARROW) for i in range(n_pages)]


P10 = capital_pages(C10) + capital_words(C10, 8)
series.append(series_kit("s10-capitals-1", "10. Заглавные: И Ш Ц Щ У Ч Г П Т Р Л А Н Ю К Й", "Узкая строка. Заглавные по группам формы, как у преподавателя: страница на букву (с парой «Аа»), затем имена и слова с заглавной.", P10, S_NARROW))
P11 = capital_pages(C11) + capital_words(C10 + C11, 10)
series.append(series_kit("s11-capitals-2", "11. Заглавные: М Я О Ф Б Д З В Е С Э Х Ж Ё", "Узкая строка. Остальные заглавные: страница на букву (с парой «Аа»), затем имена и слова с любой заглавной.", P11, S_NARROW))

# ---- 12. syllables: the 160 joins, easy to hard (narrow) ----------------------------------------------------------------------------
# the join is easy after a letter that ends low (и ш н п т …), harder after a loop below the row (р д з у), hardest after a letter that
# ends at the top (б в о-like ovals: б в ф); the vowel: и е before а о (the oval of а о has to be met by the join). Lowercase first.
CONS_RANK = {**{c: 0 for c in "гжкмнпстхцчшщл"}, **{c: 1 for c in "рдз"}, **{c: 2 for c in "бвф"}}
VOW_RANK = {"и": 0, "е": 1, "а": 2, "о": 3}
syl = sorted(syllables.all_pairs(), key=lambda p: (p[0].isupper(), CONS_RANK.get(p[0].lower(), 1), VOW_RANK[p[1]]))
syl = [c + v for c, v in syl]
P12 = [s_page(f"Слоги {i + 1}", s_words(syl[i * 8:(i + 1) * 8], N_ROWS), S_NARROW) for i in range(20)]
P12 += [s_page("Повторение", s_review(syl[k::20][:8] or syl[:8], N_ROWS), S_NARROW) for k in (3, 9, 15)]
P12.append(s_page("Итог", s_final(syl[::10], N_ROWS), S_NARROW))
series.append(series_kit("s12-syllables", "12. Слоги и соединения", "Узкая строка. Все соединения согласной с гласной — от лёгких (после и, ш, н) к трудным (после р, д, б, в и с овалом а, о); сначала строчные, потом с заглавной.", P12, S_NARROW))

# ---- 13-14. words, then words and phrases (narrow) ----------------------------------------------------------------------------------
pool = list(dict.fromkeys([w for w in words.BLOCK_B + words.block_a_notebook_words() if w.islower()]))
short = [w for w in pool if len(w) <= 5]
long_ = [w for w in pool if len(w) >= 6]


def fill_pages(items, title):
    """Word pages of 8 items, a review page of what the last four pages had after every four of them, the summary last — 24 pages."""
    out, done = [], []
    i = 0
    while len(out) < SERIES_PAGES - 1:
        if len(done) == 4:
            out.append(s_page("Повторение", s_review([w for chunk in done for w in chunk[::4]][:8], N_ROWS), S_NARROW))
            done = []
            continue
        chunk = [items[(i + k) % len(items)] for k in range(8)]
        i += 8
        out.append(s_page(title, s_words(chunk, N_ROWS), S_NARROW))
        done.append(chunk)
    return out + [s_page("Итог", s_final(items[::max(1, len(items) // 16)][:16], N_ROWS), S_NARROW)]


P13 = fill_pages(short, "Слова")
series.append(series_kit("s13-words", "13. Слова", "Узкая строка. Короткие слова из близкого ребёнку: дом, семья, еда, животные, игрушки. По две строки на слово.", P13, S_NARROW))
PHRASES = ["мама и папа", "мой дом", "кот спит", "идёт снег", "я рисую", "мой мяч", "жёлтый лист", "тёплый суп", "мама читает", "папа идёт",
           "мы гуляем", "светит солнце", "дует ветер", "мой друг", "синее небо", "белый снег", "я играю", "кот и пёс", "моя кукла", "наш сад",
           "красный мяч", "я сплю", "лес и река", "вкусный пирог", "моя семья", "чай и сок", "мой брат", "добрый день", "утка плывёт", "птица поёт",
           "мы рисуем", "я ем кашу", "сестра спит", "бабушка печёт", "дед читает", "идёт дождь"]
names_ = [w for w in NAMES]
P14 = fill_pages([x for trio in zip(long_, names_ * 9, PHRASES * 4) for x in trio], "Слова и фразы")
series.append(series_kit("s14-phrases", "14. Слова и фразы", "Узкая строка. Длинные слова, имена с заглавной и фразы из двух-трёх слов — подготовка к письму предложений.", P14, S_NARROW))

# ---- 15-16. punctuation, copying a text: the notebooks above, steps of the series ---------------------------------------------------
series += [punct_kit, texts_kit]
kits[:0] = series


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
