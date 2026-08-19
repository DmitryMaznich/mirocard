"""Curates the two whole-word ("слова") notebooks' content: which words
get practiced, and how many rows each word gets.

Word list confirmed with the user 2026-08-19 -- two blocks, split at the
same letter boundary as the two LETTER notebooks (letter_groups.py's
NOTEBOOKS: 14 "простые формы" letters vs the 19 "сложные формы" letters
added after), not the 6 fine-grained graphomotor groups those notebooks
use internally. That finer split doesn't work for whole words: no real
Russian word exists using only group 1 or group 1+2's letters (no vowel
appears until group 3's а/е/ё/о/э), so grouping words by NOTEBOOKS' own
two-way split is the coarsest boundary that still produces two real,
non-empty word lists in reading order.

BLOCK_A words use ONLY the 14 "простые формы" letters (NOTEBOOK_1_LETTERS
below) -- a child can write every one of these as soon as they've
finished the first letter notebook. BLOCK_B words need at least one
"сложные формы" letter. Every word is a short, concrete, everyday word a
child already knows by ear (person/animal names included) -- not a
mechanical letter permutation the way syllables.py's pairs are, since a
real word (unlike a syllable) has to actually mean something to be worth
writing.

Expanded 2026-08-19 (second pass) with more real words per category
(animals, people, names, food, household, clothing, nature, transport,
toys, body, school, numbers, time). BLOCK_A stays much smaller than
BLOCK_B even after this pass -- genuinely common, non-contrived words
spelled from only 14 letters (no к, н, р, у, в, б, д and more) run out
well before matching BLOCK_B's size; padding it further would mean
inventing words no child actually uses. The two blocks build into
SEPARATE notebook files (word_booklet.py, confirmed with the user
2026-08-19, same as the letter notebooks' "часть 1"/"часть 2" split) --
BLOCK_A's own notebook is deliberately padded with blank ruled pages
past its real content to reach a fuller physical booklet size (see
word_booklet.py's build_word_notebook_pdf `min_pages`), rather than by
inventing more words just to fill pages.
"""

NOTEBOOK_1_LETTERS = set("илмшптцщаеёосэ")

BLOCK_A = [
    # Original pass (2026-08-19).
    "мама", "папа", "лапа", "липа", "лето", "лес", "сом", "стол", "мост",
    "масло", "тесто", "оса", "пила", "сито", "салат", "лист", "плита",
    "лампа", "солома", "полёт", "полоса", "поле", "метла", "место",
    "лапша", "лицо", "плащ", "поэт",
    # Second pass -- more real block-A-only words, found by widening past
    # "food/furniture" into any concrete noun category (объекты, животные,
    # профессии), plus person names built from only these 14 letters
    # (checked letter-by-letter -- most short Russian names need к/н/в/р/д,
    # which is why this list is short: "Маша" is the only common FULL
    # name that fits; the rest are real informal/diminutive forms).
    "лапти", "спица", "паста", "лиса", "пилот", "самолёт", "мел",
    "Маша", "Мила", "Тёма", "Сёма", "Тоша", "Стёпа", "Лёша", "Тимоша",
    "Саша", "Миша",
]

BLOCK_B = [
    # Original pass (2026-08-19).
    "дом", "кот", "жук", "ёж", "гриб", "груша", "банан", "ведро", "ключ",
    "замок", "зима", "весна", "ветер", "рыба", "крыша", "крыло", "гнездо",
    "ковёр", "ложка", "вилка", "чашка", "кружка", "окно", "дверь", "забор",
    "огонь", "вода", "звезда", "луна", "туча", "дождь", "снег", "лёд",
    "санки", "коньки", "мяч", "муха", "май", "флаг",
    # Second pass -- animals.
    "кролик", "мышь", "волк", "медведь", "заяц", "белка",
    "олень", "тигр", "лев", "слон", "жираф", "зебра",
    "змея", "лягушка", "бабочка",
    "пчела", "муравей", "улитка", "курица", "петух", "корова", "лошадь",
    "свинья", "собака", "кошка", "котёнок", "гусь", "утка",
    # Second pass -- people.
    "брат", "сестра", "бабушка", "дедушка", "тётя", "дядя", "семья",
    "друг", "мальчик", "девочка", "ребёнок", "учитель",
    # Second pass -- names.
    "Вова", "Катя", "Аня", "Настя", "Женя", "Витя", "Коля", "Юра",
    "Дима", "Гриша", "Боря", "Вася", "Лена", "Вера", "Надя",
    "Люда", "Нина", "Ира", "Юля", "Оля", "Соня",
    "Полина", "Даша",
    # Second pass -- food.
    "хлеб", "молоко", "сыр", "яйцо", "мясо", "картошка", "морковь",
    "капуста", "огурец", "помидор", "лук", "яблоко", "арбуз",
    "вишня", "мёд", "суп", "блины", "пирог",
    # Second pass -- household objects.
    "стул", "диван", "кресло", "шкаф", "полка", "кровать", "подушка",
    "часы", "телефон", "книга", "тетрадь", "ручка", "очки",
    # Second pass -- clothing.
    "футболка", "платье", "юбка", "куртка", "пальто", "шапка",
    "ботинки",
    # Second pass -- nature.
    "солнце", "небо", "облако", "гроза", "молния", "радуга", "мороз",
    "река", "озеро", "море", "гора", "дорога",
    # Second pass -- transport.
    "машина", "автобус", "поезд", "вертолёт", "корабль", "лодка",
    "велосипед",
    # Second pass -- toys.
    "мишка", "робот", "машинка", "кубики", "юла", "качели", "горка",
    "самокат", "скакалка",
    # Second pass -- body.
    "голова", "волосы", "глаза", "нос", "рот", "зубы", "язык", "руки",
    "ноги", "сердце",
    # Second pass -- school.
    "школа", "урок", "парта", "доска", "дневник", "класс",
    # Second pass -- numbers.
    "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь",
    "девять", "десять",
    # Second pass -- time.
    "утро", "день", "вечер", "ночь", "месяц", "год", "час", "завтра",
    "вчера",
    # Second pass -- season (весна/лето/зима already above).
    "осень",
]

# Sanity check against the block boundary described above -- run at import
# time so a future edit to either list (or to letter_groups' own notebook
# split) can't silently misfile a word into the wrong block.
for _word in BLOCK_A:
    _bad = set(_word.lower()) - NOTEBOOK_1_LETTERS
    assert not _bad, f"BLOCK_A word {_word!r} uses letters outside notebook 1: {_bad}"
for _word in BLOCK_B:
    assert set(_word.lower()) - NOTEBOOK_1_LETTERS, f"BLOCK_B word {_word!r} only uses notebook-1 letters -- belongs in BLOCK_A"

_all = BLOCK_A + BLOCK_B
assert len(_all) == len(set(_all)), "duplicate word across BLOCK_A/BLOCK_B"

# Capitalized-first-letter twin of every BLOCK_A word that starts lowercase
# (confirmed with the user 2026-08-19): a child reads "дом" and "Дом" as
# two different words, not the same one written twice -- the capitalized
# form is real, separate practice (sentence-initial capitalization), which
# is why BLOCK_A's own notebook (block_a_notebook_words below) doesn't run
# out of real content nearly as fast as BLOCK_A alone would suggest. Names
# (Маша, Тёма...) already start capitalized -- capitalizing them is a
# no-op, so they're skipped rather than "doubled" into a duplicate.
BLOCK_A_CAPITALIZED = [w.capitalize() for w in BLOCK_A if w[0].islower()]

_all_a_notebook = BLOCK_A + BLOCK_A_CAPITALIZED
assert len(_all_a_notebook) == len(set(_all_a_notebook)), "duplicate word in BLOCK_A's own capitalized-twin expansion"

ROWS_PER_WORD = 2  # confirmed with the user 2026-08-19: 2 rows per word (vs 3 for
# syllable pairs) -- words are wider and more varied in length than a
# 2-letter pair, so one fewer repeat keeps the notebook from growing much
# larger than the syllables one for the same practice value.


def all_words():
    return BLOCK_A + BLOCK_B


def block_a_notebook_words():
    """BLOCK_A's own notebook content: each lowercase word immediately
    followed by its capitalized-first-letter twin (see BLOCK_A_CAPITALIZED
    above) -- interleaved rather than appended as one big block afterward,
    so the notebook teaches "same word, two forms" as a paired concept,
    the same way the letter notebooks pair a letter's lowercase and
    uppercase practice rows back to back. Names have no twin to interleave."""
    words = []
    for w in BLOCK_A:
        words.append(w)
        if w[0].islower():
            words.append(w.capitalize())
    return words


def word_notebook_rows(words=None):
    """Flattens words into the row list draw_word_page consumes -- each
    word repeated ROWS_PER_WORD times in a row, model-only ("sample"
    style, no dotted tracing), same content shape as
    syllables.syllable_notebook_rows()."""
    if words is None:
        words = all_words()
    rows = []
    for word in words:
        rows.extend([word] * ROWS_PER_WORD)
    return rows
