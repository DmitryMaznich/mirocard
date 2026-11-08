# archive/ — removed topics, kept just in case (2026-11-08)

Code that no longer runs in the app. Kept as it was on the day it was removed (owner's decision:
«удаляй всё старое только в архивную папку на всякий случай»). Not built, not tested
(`vite.config.js` test `exclude`), not in the Docker image (`.dockerignore`). Imports inside these
files point at their old locations and are **not** maintained — restoring means moving the folder
back and fixing paths. Everything here is also in git history.

The topics stay in `public/decks/catalog.json` with status `archived`: that is what keeps an
installed copy off every device's home screen (the server sends `archivedTopicIds` from it). Do not
delete those catalog entries — the topic would reappear for whoever has it installed.

| Folder | What | Why removed |
|---|---|---|
| `propis/src/topics/renderers/propis/` | «Прописи старые» (`propis`): its own screens (practice, show, write words/text, old dictation, print materials view), task engine, tests | Replaced by `propis2` (shown as «Прописи») since 2026-10-14. Its shared engine moved to `src/handwriting/` and its Cyrillic glyph data to `tools/handwriting/cyrillic/` first — those are alive. |
| `propis/scripts/build-propis-deck.mjs` | builder of the `propis` deck ZIP | same; the committed ZIP's `print/` and `thumbnails/` (ready PDF notebooks) have no sources in git, so it no longer rebuilds that ZIP exactly anyway |
| `latin_letters/` | a first standalone «Латиница» constructor (deck 0.1.0, 2026-11-07) | wrong direction: Latin goes into the `propis2` engine as languages/styles instead of a new constructor (docs/latin-letters.md). The print-letter glyph draft it used is kept in `tools/latin_letters/`. |

Still in place on purpose: `tools/propis/topic.json` (the old topic's deck source). The Python
print-workbook tools (`scripts/propis_worksheets/`, `digits_workbook/`, `punctuation_workbook/`,
`cover_tetrad.py`, `propis_print_notebooks.py`) read captured digit/punctuation strokes from it.
