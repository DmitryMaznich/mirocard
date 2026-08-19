"""Ports src/topics/renderers/propis/wordEngine.js's buildWordTrajectory
(the in-app word-trajectory builder) to Python, for rendering real
connected letters -- both letter PAIRS ("слоги" / letter connections)
and full multi-letter WORDS -- in the print pipeline, reusing the actual
captured connector strokes from tools/propis/topic.json instead of just
placing letters side by side (confirmed with the user 2026-08-19: the
whole point of both notebooks is teaching the real connecting motion).

build_word_trajectory (below) is the full port: an N-letter loop with
"middle"-position о/ю-variant resolution and the same drift-accumulation
corrections (canonical-line snap, exit/entry connector Y-rescale) as the
JS original. build_pair is now a thin 2-letter convenience wrapper around
it, kept only because the syllables notebook (and its existing tests)
call it by that name; it does not duplicate any logic. See wordEngine.js
itself for the full reasoning behind each piece ported here.

Coordinate system: identical to render.py's (UNIT_H=150,
LETTER_BASELINE_UNIT=88) -- wordEngine.js's own NATIVE_L3=88 is the same
constant, so no unit conversion is needed anywhere in this file.
"""

from svg_path import parse_path, sample_path

# propisRuling.js's GUIDE_LINES (native units, 0-150 canvas).
GUIDE_LINES = {
    1: 10,
    2: 36,
    3: 62,
    4: 75,
    5: 88,
    6: 110,
    7: 140,
}


def classify_line(y):
    return min(GUIDE_LINES, key=lambda line: abs(GUIDE_LINES[line] - y))


# wordEngine.js's EXIT_LINE_OVERRIDES / ENTRY_LINE_OVERRIDES / DUAL_NATURE_LETTERS,
# copied verbatim (see that file for the full "why" on each entry).
EXIT_LINE_OVERRIDES = {
    "б": 5, "в": 5, "ф": 5, "о": 5, "ю": 5, "ь": 5, "ъ": 5, "э": 5,
    "Б": 5, "В": 5, "Г": 5, "Д": 5, "З": 5, "О": 5, "Р": 5, "У": 5, "Ф": 5, "Э": 5, "Ю": 5,
}
ENTRY_LINE_OVERRIDES = {
    "б": 3, "а": 3, "о": 3, "ф": 3, "д": 3,
}
DUAL_NATURE_LETTERS = {"о", "ю"}

BASELINE_CONTACT_TOLERANCE = 2.0


def _endpoints(d):
    """Mirrors pathGeometry.js's getPathEndpoints: first M's point (start)
    -- a captured stroke always starts with a moveto, per parse_path's own
    contract -- and the final command's endpoint (end)."""
    commands = parse_path(d)
    start = commands[0][1]
    last_cmd, last_args = commands[-1]
    end = last_args if last_cmd in ("M", "L") else last_args[4:6]
    return start, end


def get_connection_info(card):
    strokes = card["strokes"]
    entry_start, _ = _endpoints(strokes[0]["d"])
    exit_stroke_index = card.get("mainStrokeIndex", len(strokes) - 1)
    _, exit_end = _endpoints(strokes[exit_stroke_index]["d"])
    return {
        "entryPoint": entry_start,
        "exitPoint": exit_end,
        "entryLine": classify_line(entry_start[1]),
        "exitLine": classify_line(exit_end[1]),
    }


def resolve_connection_info(card):
    info = get_connection_info(card)
    label = card.get("label")
    info["entryLine"] = ENTRY_LINE_OVERRIDES.get(label, info["entryLine"])
    info["exitLine"] = EXIT_LINE_OVERRIDES.get(label, info["exitLine"])
    return info


def find_closest_approach(points, target_y, tolerance_margin=1.5):
    min_dist = min(abs(p[1] - target_y) for p in points)
    tol = min_dist + tolerance_margin

    def dist(i):
        return abs(points[i][1] - target_y)

    last_local_min_idx = None
    for i in range(len(points) - 2, 0, -1):
        if dist(i) > tol:
            continue
        if dist(i) <= dist(i - 1) and dist(i) <= dist(i + 1):
            last_local_min_idx = i
            break
    if last_local_min_idx is None:
        last_local_min_idx = len(points) - 1
    near = [p for p in points if abs(p[1] - target_y) <= tol]
    return {"first": near[0], "last": points[last_local_min_idx]}


def get_baseline_contacts(card):
    points = []
    for stroke in card["strokes"]:
        points.extend(sample_path(stroke["d"]))
    return find_closest_approach(points, GUIDE_LINES[5], BASELINE_CONTACT_TOLERANCE)


def place_exit_connector(connector, anchor):
    """Real captured exit connector: X translate-only from the previous
    letter's real baseline-contact point; Y is scaled so the connector's
    own far end lands exactly on its canonical toLine (see
    wordEngine.js's placeExitConnector for the full "why" -- captured
    letters don't reliably reach the nominal guide line on their own)."""
    info = get_connection_info(connector)
    dx = anchor[0] - info["entryPoint"][0]
    orig_span_y = info["exitPoint"][1] - info["entryPoint"][1]
    target_line_y = GUIDE_LINES[connector["toLine"]]
    if orig_span_y != 0:
        target_y = target_line_y
        scale_y = (target_y - anchor[1]) / orig_span_y
    else:
        target_y = info["exitPoint"][1] + (anchor[1] - info["entryPoint"][1])
        scale_y = 1
    translate_y = anchor[1] - info["entryPoint"][1] * scale_y
    return {
        "strokes": connector["strokes"],
        "dx": dx, "scaleY": scale_y, "translateY": translate_y,
        "endPoint": (info["exitPoint"][0] + dx, target_y),
    }


def place_entry_connector_local(connector, letter_raw_entry_point):
    """Mirror of place_exit_connector: END stays exactly on the next
    letter's own real entry point; START is scaled to land on the
    connector's own canonical fromLine."""
    info = get_connection_info(connector)
    dx = letter_raw_entry_point[0] - info["exitPoint"][0]
    orig_span_y = info["exitPoint"][1] - info["entryPoint"][1]
    canonical_y = GUIDE_LINES[connector["fromLine"]]
    if orig_span_y != 0:
        target_start_y = canonical_y
        scale_y = (letter_raw_entry_point[1] - target_start_y) / orig_span_y
    else:
        target_start_y = info["entryPoint"][1] + (letter_raw_entry_point[1] - info["exitPoint"][1])
        scale_y = 1
    translate_y = letter_raw_entry_point[1] - info["exitPoint"][1] * scale_y
    return {
        "strokes": connector["strokes"],
        "dx": dx, "scaleY": scale_y, "translateY": translate_y,
        "startPoint": (info["entryPoint"][0] + dx, target_start_y),
    }


def build_connectors_by_key(connector_cards):
    by_key = {}
    for card in connector_cards:
        key = f"{card['fromLine']}_{card['toLine']}"
        by_key.setdefault(key, []).append(card)
    return by_key


def pick_connector(candidates, letter_label):
    if not candidates:
        return None
    for c in candidates:
        if letter_label in c.get("forLetters", ()):
            return c
    for c in candidates:
        if "forLetters" not in c:
            return c
    return None


def find_exit_connector(connectors_by_key, exit_line, letter_label):
    return pick_connector(connectors_by_key.get(f"{exit_line}_4"), letter_label)


def find_entry_connector(connectors_by_key, entry_line, letter_label):
    return pick_connector(connectors_by_key.get(f"4_{entry_line}"), letter_label)


def build_variant_index(letters_by_label):
    """Only used for DUAL_NATURE_LETTERS (о, ю). Mirrors
    wordEngine.js's buildVariantIndex; "middle"/"any" buckets are built
    for completeness but never consulted by build_pair_trajectory below
    (a 2-letter pair never has a "middle"-position letter)."""
    index = {}
    for card in letters_by_label.values():
        base = card.get("variantOf")
        if not base:
            continue
        bucket = index.setdefault(base, {"first": [], "last": {}, "middle": {"lower": [], "upper": []}, "any": []})
        position = card.get("position")
        entry_type = card.get("entryType")
        if position == "first":
            bucket["first"].append(card)
        elif position == "last":
            bucket["last"][entry_type] = card
        elif position == "middle":
            if entry_type:
                bucket["middle"][entry_type].append(card)
                if card.get("alsoFirst"):
                    bucket["first"].append(card)
            else:
                bucket["any"].append(card)
    for base, bucket in index.items():
        for key in ("first", "any"):
            bucket[key].sort(key=lambda c: len(c.get("nextLetters", [])) or 10 ** 6)
        for key in ("lower", "upper"):
            bucket["middle"][key].sort(key=lambda c: len(c.get("nextLetters", [])) or 10 ** 6)
    return index


def _matches_next(card, next_label):
    next_letters = card.get("nextLetters")
    return next_letters is None or next_label in next_letters


def resolve_variant(variant_index, label, position, prev_label, next_label):
    bucket = variant_index.get(label)
    if not bucket:
        return None

    # A run of 2+ consecutive о's (2026-08-14, user-specified rule): every о
    # immediately followed by another о resolves the SAME way regardless of
    # its own word position -- whichever first-position variant's
    # nextLetters includes "о". The run's LAST о (preceded by о, not itself
    # followed by one) returns None here on purpose, so the caller falls
    # through to the plain card. See wordEngine.js's resolveVariant for the
    # full reasoning; only relevant once a word has 3+ letters (a 2-letter
    # pair can never contain a full о-run).
    if label == "о":
        if next_label == "о":
            for c in bucket["first"]:
                if _matches_next(c, "о"):
                    return c
            return None
        if prev_label == "о":
            return None

    entry_type = ("upper" if prev_label in DUAL_NATURE_LETTERS else "lower") if prev_label else None

    if position == "first":
        for c in bucket["first"]:
            if _matches_next(c, next_label):
                return c
        for c in bucket["any"]:
            if _matches_next(c, next_label):
                return c
        return None
    if position == "last":
        return bucket["last"].get(entry_type) or bucket["last"].get("lower")
    if position == "middle":
        if not entry_type:
            return None
        for c in bucket["middle"][entry_type]:
            if _matches_next(c, next_label):
                return c
        for c in bucket["any"]:
            if _matches_next(c, next_label):
                return c
        return None
    return None  # "isolated" (single-letter word): no variant, use the plain card


def build_word_trajectory(word, letters_by_label, connectors_by_key, variant_index):
    """Full N-letter port of wordEngine.js's buildWordTrajectory. Walks
    `word` left to right, resolving for each letter: (a) whether it's a
    dual-nature (о/ю) letter needing its own captured first/middle/last
    variant, (b) the single junction with whatever came before it (a real
    captured exit/entry connector pair if the methodology calls for one,
    else an exact-snap direct translate onto the previous letter's own
    canonical exit line).

    Returns a list of segments, each `{"strokes": [...], "dx", "scaleY",
    "translateY"}` -- render.py's draw_pair applies each segment's own
    affine transform (x -> x + dx, y -> y * scaleY + translateY) at draw
    time, composed with the usual world placement, instead of
    re-serializing new path `d` strings the way wordEngine.js does (this
    file only ever needs the numbers, not new SVG text)."""
    chars = list(word)
    segments = []
    prev = None  # {exitLine, exitPointWorld, baselineContactWorld, usedVariant, label}

    for i, ch in enumerate(chars):
        letter = letters_by_label[ch]
        prev_label = chars[i - 1] if i > 0 else None
        next_label = chars[i + 1] if i < len(chars) - 1 else None

        used_variant = False
        if ch in DUAL_NATURE_LETTERS:
            if len(chars) == 1:
                position = "isolated"
            elif i == 0:
                position = "first"
            elif i == len(chars) - 1:
                position = "last"
            else:
                position = "middle"
            variant = resolve_variant(variant_index, ch, position, prev_label, next_label)
            if variant:
                letter = variant
                used_variant = True

        info = resolve_connection_info(letter)
        dx, dy = 0.0, 0.0

        if prev is not None:
            exit_connector = None if prev["usedVariant"] else find_exit_connector(
                connectors_by_key, prev["exitLine"], prev["label"])
            entry_connector = None if (used_variant or prev["usedVariant"]) else find_entry_connector(
                connectors_by_key, info["entryLine"], ch)
            # A resolved о/ю variant's own tail already reaches wherever the
            # next letter needs to start (captured as part of the same
            # continuous stroke) -- both the ordinary exit-connector lookup
            # AND the canonical-line snap below are skipped for it, using
            # its own raw (untouched) exit point as the anchor directly
            # instead (see wordEngine.js's `variantTailReachesHere`).
            variant_tail_reaches_here = prev["usedVariant"]

            if exit_connector:
                placed = place_exit_connector(exit_connector, prev["baselineContactWorld"])
                segments.append(placed)
                anchor = placed["endPoint"]
            elif variant_tail_reaches_here:
                anchor = prev["exitPointWorld"]
            else:
                canonical_y = GUIDE_LINES.get(prev["exitLine"])
                anchor = (prev["exitPointWorld"][0], canonical_y) if canonical_y is not None else prev["exitPointWorld"]

            if entry_connector:
                local = place_entry_connector_local(entry_connector, info["entryPoint"])
                dx = anchor[0] - local["startPoint"][0]
                dy = anchor[1] - local["startPoint"][1]
                segments.append({
                    "strokes": local["strokes"],
                    "dx": local["dx"] + dx, "scaleY": local["scaleY"], "translateY": local["translateY"] + dy,
                })
            else:
                dx = anchor[0] - info["entryPoint"][0]
                dy = anchor[1] - info["entryPoint"][1]

        segments.append({"strokes": letter["strokes"], "dx": dx, "scaleY": 1.0, "translateY": dy})

        contacts = get_baseline_contacts(letter)
        prev = {
            "exitLine": info["exitLine"],
            "exitPointWorld": (info["exitPoint"][0] + dx, info["exitPoint"][1] + dy),
            "baselineContactWorld": (contacts["last"][0] + dx, contacts["last"][1] + dy),
            "usedVariant": used_variant,
            "label": ch,
        }

    return segments


def build_pair(label1, label2, letters_by_label, connectors_by_key, variant_index):
    """2-letter convenience wrapper around build_word_trajectory, kept for
    the syllables notebook (and its own tests) which only ever deal with
    letter pairs, not full words."""
    return build_word_trajectory(label1 + label2, letters_by_label, connectors_by_key, variant_index)
