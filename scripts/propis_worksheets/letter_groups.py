"""Graphomotor-complexity letter groups for propis worksheets (Phase 1).

Confirmed with the user 2026-08-14 -- see
docs/superpowers/specs/2026-08-14-propis-letter-worksheets-design.md.
Grouped by shared graphic construction element (school "Пропись"
methodology), not alphabetical order, not sound-articulation order.

Every lowercase letter pairs with its own uppercase counterpart, EXCEPT
Ъ/Ь (paired with None) -- both technically have capital forms but neither
practically appears capitalized in real Russian text, so they only get a
lowercase practice page (see page.py's handling of upper=None).
"""

GROUPS = [
    {
        "id": 1,
        "label": "Крючок",
        "letters": [("и", "И"), ("л", "Л"), ("м", "М"), ("ш", "Ш")],
    },
    {
        "id": 2,
        "label": "Крючок + доп. штрих",
        "letters": [("п", "П"), ("т", "Т"), ("ц", "Ц"), ("щ", "Щ")],
    },
    {
        "id": 3,
        "label": "Овал",
        "letters": [("а", "А"), ("е", "Е"), ("ё", "Ё"), ("о", "О"), ("с", "С"), ("э", "Э")],
    },
    {
        "id": 4,
        "label": "Петля",
        "letters": [("б", "Б"), ("в", "В"), ("д", "Д"), ("з", "З"), ("у", "У"), ("ф", "Ф")],
    },
    {
        "id": 5,
        "label": "Составные формы",
        "letters": [
            ("г", "Г"), ("ж", "Ж"), ("к", "К"), ("н", "Н"),
            ("х", "Х"), ("ч", "Ч"), ("ю", "Ю"), ("я", "Я"),
        ],
    },
    {
        "id": 6,
        "label": "Особые формы",
        "letters": [("й", "Й"), ("р", "Р"), ("ъ", None), ("ы", "Ы"), ("ь", None)],
    },
]

# Two physical notebooks (Phase 1's actual print product, confirmed with the
# user 2026-08-15) -- each letter gets a fixed PAGES_PER_LETTER pages
# (page.py), so a notebook's sheet count falls out of how many letters its
# groups cover, not a target page count. Split after group 3 ("простые
# формы": hook / hook+stroke / oval, 14 letters, 7 sheets) vs groups 4-6
# ("сложные формы": loop / compound / special forms, 19 letters, 10 sheets)
# -- the most balanced group-aligned split point.
NOTEBOOKS = [
    {"id": 1, "label": "Простые формы", "group_ids": [1, 2, 3]},
    {"id": 2, "label": "Сложные формы", "group_ids": [4, 5, 6]},
]


def notebook_groups(notebook):
    """Resolves a NOTEBOOKS entry's group_ids into the actual group dicts,
    in order."""
    by_id = {g["id"]: g for g in GROUPS}
    return [by_id[gid] for gid in notebook["group_ids"]]
