"""Ports src/topics/renderers/propis/wordEngine.js's buildWordSegments and
layoutTextIntoRows to Python -- wraps arbitrary text (not just a single
word) across multiple ruled rows, the same way the in-app "Пишем текст"
mode (WriteTextView.jsx) does, for the print pipeline's text-copying
notebook (confirmed with the user 2026-08-19: the model text must be
real cursive handwriting, like every other notebook in this series, not
a plain printed font).

Kept separate from connectors.py -- that file is about building ONE
word/pair's own trajectory; this one is about placing many already-built
trajectories on a page, which needs render.py's ink-bounds measurement
too (connectors.py deliberately doesn't depend on render.py).
"""

from connectors import build_word_trajectory
from render import segments_ink_bounds

# Mirrors wordEngine.js's own constants exactly (see that file for the
# full reasoning): WORD_GAP_UNITS is the median real ink width of a single
# captured letter, chosen so the visible gap between words reads as
# roughly "one letter wide"; FALLBACK_CHAR_WIDTH_UNITS is a rough estimate
# for the one uncaptured character these texts actually use -- the
# sentence-ending period.
WORD_GAP_UNITS = 33
FALLBACK_CHAR_WIDTH_UNITS = 24


def build_word_segments(word, letters_by_label, connectors_by_key, variant_index):
    """Splits `word` into runs of consecutive captured-letter vs
    uncaptured characters -- a captured run still goes through
    build_word_trajectory exactly as before (so connectors within it
    chain normally), but an uncaptured run (currently just the trailing
    "." on a sentence's last word) becomes a fixed-width fallback
    placeholder instead of raising and dropping the whole word. Returns
    `{"segments": [...], "width": total}` -- each segment is either
    `{"type": "cursive", "xOffset", "trajectory", "width"}` (trajectory
    is a connectors.build_word_trajectory() segments list, drawn via
    render.draw_pair) or `{"type": "fallback", "xOffset", "text",
    "width"}` (drawn as a plain glyph -- see text_page.py)."""
    chars = list(word)
    runs = []
    for ch in chars:
        supported = ch in letters_by_label
        if runs and runs[-1]["supported"] == supported:
            runs[-1]["text"] += ch
        else:
            runs.append({"supported": supported, "text": ch})

    segments = []
    x = 0.0
    for run in runs:
        trajectory = None
        if run["supported"]:
            try:
                trajectory = build_word_trajectory(run["text"], letters_by_label, connectors_by_key, variant_index)
            except KeyError:
                trajectory = None
        if trajectory:
            minx, maxx = segments_ink_bounds(trajectory)
            width = maxx - minx
            segments.append({"type": "cursive", "xOffset": x, "trajectory": trajectory, "width": width})
            x += width
        else:
            width = len(run["text"]) * FALLBACK_CHAR_WIDTH_UNITS
            segments.append({"type": "fallback", "xOffset": x, "text": run["text"], "width": width})
            x += width
    return {"segments": segments, "width": x}


def layout_text_into_rows(text, letters_by_label, connectors_by_key, variant_index, row_width_units):
    """Lays a block of text (words separated by " ", manual line breaks by
    "\\n") onto a multi-row grid `row_width_units` wide, greedily wrapping
    a word onto the next row whenever it would no longer fit. Returns
    `{"placed": [...], "row_count": N}` -- each placed entry is
    `{"word", "row_index", "x", "segments"}`, row_index counting down from
    the top row (0) exactly like wordEngine.js's own layoutTextIntoRows."""
    hard_lines = (text or "").split("\n")
    placed = []
    row_index = 0

    for line_idx, line in enumerate(hard_lines):
        words = [w for w in line.split(" ") if w]
        x = 0.0
        row_has_content = False

        for word in words:
            built = build_word_segments(word, letters_by_label, connectors_by_key, variant_index)
            segments, word_width = built["segments"], built["width"]
            if not segments:
                continue

            if row_has_content and x + WORD_GAP_UNITS + word_width > row_width_units:
                row_index += 1
                x = 0.0
                row_has_content = False

            if row_has_content:
                x += WORD_GAP_UNITS
            placed.append({"word": word, "row_index": row_index, "x": x, "segments": segments})
            x += word_width
            row_has_content = True

        if line_idx < len(hard_lines) - 1:
            row_index += 1

    row_count = max(row_index + 1, 1)
    return {"placed": placed, "row_count": row_count}
