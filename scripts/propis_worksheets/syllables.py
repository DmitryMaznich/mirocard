"""Curates the letter-connection ("слоги") notebook's content: which
letter-pairs get practiced, and how many rows each pair gets.

Volume plan confirmed with the user 2026-08-19 -- 4 representative vowel
partners per consonant, covering the app's own connector-type diversity
(EXIT_LINE_OVERRIDES / ENTRY_LINE_OVERRIDES / DUAL_NATURE_LETTERS in
wordEngine.js, ported in connectors.py), both lowercase and
uppercase-consonant forms:

    а -- ENTRY_LINE_OVERRIDES (looping entry)
    о -- ENTRY_LINE_OVERRIDES + DUAL_NATURE_LETTERS (looping entry, resolves
         through a captured "_first_*" variant card instead of the plain
         letter + connector path)
    и -- conn_4_3_straight's forLetters set (straight-diagonal entry)
    е -- no override on either side (plain/default entry)

Using the SAME 4 vowels for every consonant keeps the list mechanical and
auditable (each pair is also real, pronounceable Russian, not just a
phonetic exercise) while still exercising every connector category at
least once per consonant, since a consonant's OWN exit-side classification
(plain vs. EXIT_LINE_OVERRIDES upper-hook, e.g. б/в/ф) already varies
independently of which vowel follows.

20 consonants x 4 vowels x 2 cases (lower, upper-consonant) = 160 pairs.
"""

CONSONANTS = "бвгджзклмнпрстфхцчшщ"
VOWELS = "аоие"

ROWS_PER_SYLLABLE = 3  # confirmed with the user 2026-08-19: 3 rows per pair, not 1


def lowercase_pairs():
    return [(c, v) for c in CONSONANTS for v in VOWELS]


def uppercase_pairs():
    """Capital consonant + lowercase vowel -- how a syllable actually looks
    at the start of a real name or sentence, not a fully-capitalized pair."""
    return [(c.upper(), v) for c in CONSONANTS for v in VOWELS]


def all_pairs():
    return lowercase_pairs() + uppercase_pairs()


def syllable_notebook_rows(pairs=None):
    """Flattens pairs into the row list draw_syllable_page consumes --
    each pair repeated ROWS_PER_SYLLABLE times in a row, model-only
    ("sample" style, no dotted tracing) per pair."""
    if pairs is None:
        pairs = all_pairs()
    rows = []
    for pair in pairs:
        rows.extend([pair] * ROWS_PER_SYLLABLE)
    return rows
