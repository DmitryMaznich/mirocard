"""Ports the 2-letter-pair slice of
src/topics/renderers/propis/wordEngine.js (the in-app word-trajectory
builder) to Python, for rendering real connected letter-pairs ("слоги" /
letter connections) in the print pipeline -- reusing the actual captured
connector strokes from tools/propis/topic.json, not just placing two
letters side by side (confirmed with the user 2026-08-19: the whole
point of this notebook is teaching the real connecting motion).

Deliberately NOT a full port -- buildWordTrajectory's drift-accumulation
correction, multi-letter о/ю-run handling, and row-wrapping all exist to
serve arbitrary-length words. A 2-letter pair only ever has ONE junction
(prev=null on letter 1, then one resolve on letter 2), so this only needs:
resolveConnectionInfo, the exit/entry connector lookup+placement, and
buildVariantIndex/resolveVariant's "first"/"last" branches (never
"middle", which only exists for a letter with both a predecessor AND a
successor). See wordEngine.js itself for the full reasoning behind each
piece ported here -- comments below are trimmed to what's specific to
the 2-letter case.

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
    if position == "first":
        for c in bucket["first"]:
            if _matches_next(c, next_label):
                return c
        for c in bucket["any"]:
            if _matches_next(c, next_label):
                return c
        return None
    if position == "last":
        entry_type = "upper" if prev_label in DUAL_NATURE_LETTERS else "lower"
        return bucket["last"].get(entry_type) or bucket["last"].get("lower")
    return None  # "middle" never happens for a 2-letter pair


def build_pair(label1, label2, letters_by_label, connectors_by_key, variant_index):
    """The 2-letter slice of buildWordTrajectory: resolves (a) whether
    label1 (dual-nature) needs its own "first" variant, (b) whether
    label2 (dual-nature) needs its own "last" variant, (c) the single
    junction between them (real captured exit/entry connector pieces if
    the methodology calls for one, else an exact-snap direct translate).

    Returns a list of segments, each `{"strokes": [...], "dx", "scaleY",
    "translateY"}` -- render.py's draw_pair applies each segment's own
    affine transform (x -> x + dx, y -> y * scaleY + translateY) at draw
    time, composed with the usual world placement, instead of
    re-serializing new path `d` strings the way wordEngine.js does (this
    file only ever needs the numbers, not new SVG text)."""
    letter1 = letters_by_label[label1]
    used_variant1 = False
    if label1 in DUAL_NATURE_LETTERS:
        variant = resolve_variant(variant_index, label1, "first", None, label2)
        if variant:
            letter1 = variant
            used_variant1 = True

    letter2 = letters_by_label[label2]
    used_variant2 = False
    if label2 in DUAL_NATURE_LETTERS:
        variant = resolve_variant(variant_index, label2, "last", label1, None)
        if variant:
            letter2 = variant
            used_variant2 = True

    segments = [{"strokes": letter1["strokes"], "dx": 0.0, "scaleY": 1.0, "translateY": 0.0}]

    info1 = resolve_connection_info(letter1)
    info2 = resolve_connection_info(letter2)

    # A resolved о/ю variant's own tail already reaches wherever the next
    # letter needs to start (captured as part of the same continuous
    # stroke) -- both the ordinary exit-connector lookup AND the
    # canonical-line snap below are skipped for it, using its own raw
    # (untouched) exit point as the anchor directly instead (see
    # wordEngine.js's `variantTailReachesHere`).
    exit_connector = None if used_variant1 else find_exit_connector(connectors_by_key, info1["exitLine"], label1)
    entry_connector = None if (used_variant2 or used_variant1) else find_entry_connector(connectors_by_key, info2["entryLine"], label2)

    if exit_connector:
        contacts = get_baseline_contacts(letter1)
        placed = place_exit_connector(exit_connector, contacts["last"])
        segments.append(placed)
        anchor = placed["endPoint"]
    elif used_variant1:
        anchor = info1["exitPoint"]
    else:
        canonical_y = GUIDE_LINES.get(info1["exitLine"])
        anchor = (info1["exitPoint"][0], canonical_y) if canonical_y is not None else info1["exitPoint"]

    if entry_connector:
        local = place_entry_connector_local(entry_connector, info2["entryPoint"])
        dx = anchor[0] - local["startPoint"][0]
        dy = anchor[1] - local["startPoint"][1]
        segments.append({
            "strokes": local["strokes"],
            "dx": local["dx"] + dx, "scaleY": local["scaleY"], "translateY": local["translateY"] + dy,
        })
        letter2_dx, letter2_dy = dx, dy
    else:
        letter2_dx = anchor[0] - info2["entryPoint"][0]
        letter2_dy = anchor[1] - info2["entryPoint"][1]

    segments.append({"strokes": letter2["strokes"], "dx": letter2_dx, "scaleY": 1.0, "translateY": letter2_dy})
    return segments
