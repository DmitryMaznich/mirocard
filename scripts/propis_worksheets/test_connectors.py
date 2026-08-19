from connectors import (
    classify_line,
    pick_connector,
    build_variant_index,
    resolve_variant,
    get_connection_info,
    build_pair,
    build_word_trajectory,
    build_connectors_by_key,
)


def test_classify_line_picks_nearest_guide_line():
    assert classify_line(88) == 5  # exact baseline
    assert classify_line(76) == 4  # closer to 75 than 62
    assert classify_line(0) == 1   # clamps to the nearest, not out of range


def test_pick_connector_prefers_forLetters_match_over_default():
    default = {"id": "default", "strokes": []}
    specific = {"id": "specific", "forLetters": ["ы", "и"], "strokes": []}
    assert pick_connector([default, specific], "и") is specific
    assert pick_connector([default, specific], "т") is default


def test_pick_connector_empty_or_missing():
    assert pick_connector(None, "и") is None
    assert pick_connector([], "и") is None


def test_get_connection_info_simple_line():
    card = {"label": "x", "strokes": [{"d": "M 0 75 L 10 62"}]}
    info = get_connection_info(card)
    assert info["entryPoint"] == (0.0, 75.0)
    assert info["exitPoint"] == (10.0, 62.0)
    assert info["entryLine"] == 4
    assert info["exitLine"] == 3


def test_get_connection_info_respects_mainStrokeIndex():
    card = {
        "label": "x",
        "mainStrokeIndex": 0,
        "strokes": [
            {"d": "M 0 75 L 10 62"},
            {"d": "M 50 10 L 55 12"},  # decorative mark, e.g. й's breve -- should be ignored
        ],
    }
    info = get_connection_info(card)
    assert info["exitPoint"] == (10.0, 62.0)


def _variant_fixture():
    return {
        "о": {"type": "letter", "label": "о", "strokes": [{"d": "M 0 88 L 10 88"}]},
        "о_first_l": {
            "type": "letter", "label": "о_first_l", "variantOf": "о", "position": "first",
            "nextLetters": ["л", "м"], "strokes": [{"d": "M 0 88 L 10 88"}],
        },
        "о_last_l": {
            "type": "letter", "label": "о_last_l", "variantOf": "о", "position": "last",
            "entryType": "lower", "strokes": [{"d": "M 0 88 L 10 88"}],
        },
    }


def test_resolve_variant_first_position_matches_nextLetters():
    letters = _variant_fixture()
    index = build_variant_index(letters)
    variant = resolve_variant(index, "о", "first", None, "л")
    assert variant["id"] if "id" in variant else variant["label"] == "о_first_l"
    assert variant["label"] == "о_first_l"


def test_resolve_variant_first_position_no_match_falls_through():
    letters = _variant_fixture()
    index = build_variant_index(letters)
    # "т" isn't in о_first_l's nextLetters and there's no "any" bucket entry here
    assert resolve_variant(index, "о", "first", None, "т") is None


def test_resolve_variant_last_position_falls_back_to_lower():
    letters = _variant_fixture()
    index = build_variant_index(letters)
    # no о_last_u exists -- an upper-entry request (prev is dual-nature) must still
    # fall back to о_last_l rather than returning nothing (see wordEngine.js's fix).
    variant_from_dual_prev = resolve_variant(index, "о", "last", "ю", None)
    variant_from_plain_prev = resolve_variant(index, "о", "last", "т", None)
    assert variant_from_dual_prev["label"] == "о_last_l"
    assert variant_from_plain_prev["label"] == "о_last_l"


def test_build_pair_no_connector_direct_snap():
    """Two letters with no captured connector on either side (e.g. "с"
    exiting plain, "т" entering plain): letter 2 should land with its own
    entry point snapped onto letter 1's canonical exit line, not just
    translated by letter 1's raw (imprecise) exit point."""
    letters = {
        "с": {"label": "с", "strokes": [{"d": "M 0 88 L 20 74.5"}]},  # exit near line4 (75), not exact
        "т": {"label": "т", "strokes": [{"d": "M 0 75 L 10 62"}]},
    }
    segments = build_pair("с", "т", letters, {}, {})
    assert len(segments) == 2  # just the two letters, no connector piece
    letter2 = segments[1]
    # т's own entry point (0,75) translated by (dx, dy) must land at (20, 75) --
    # x from с's raw exit, y snapped to the canonical line-4 y (75), not 74.5.
    assert letter2["dx"] == 20.0
    assert letter2["translateY"] == 75.0 - 75.0


def test_build_word_trajectory_chains_three_plain_letters_via_canonical_snap():
    """No dual-nature letters, no captured connectors anywhere: each
    letter after the first should land with its own entry point snapped
    onto the PREVIOUS letter's canonical exit line, chained across all
    three -- the same rule test_build_pair_no_connector_direct_snap
    verifies for 2 letters, extended to a real N-letter loop."""
    letters = {
        "с": {"label": "с", "strokes": [{"d": "M 0 88 L 20 74.5"}]},  # exit near line4 (75)
        "т": {"label": "т", "strokes": [{"d": "M 0 75 L 10 62"}]},    # exit near line3 (62)
        "и": {"label": "и", "strokes": [{"d": "M 0 62 L 15 62"}]},
    }
    segments = build_word_trajectory("сти", letters, {}, {})
    assert len(segments) == 3
    # "т" snaps onto "с"'s canonical exit line (4 -> y=75), not с's raw exit y (74.5).
    assert segments[1]["dx"] == 20.0
    assert segments[1]["translateY"] == 0.0
    # "и" snaps onto "т"'s canonical exit line (3 -> y=62), chained from т's own dx.
    assert segments[2]["dx"] == 20.0 + 10.0
    assert segments[2]["translateY"] == 0.0


def _middle_variant_fixture():
    return {
        "б": {"label": "б", "strokes": [{"d": "M 0 88 L 10 88"}]},
        "е": {"label": "е", "strokes": [{"d": "M 0 88 L 10 88"}]},
        "о": {"type": "letter", "label": "о", "strokes": [{"d": "M 0 88 L 10 88"}]},
        "о_middle_any": {
            "type": "letter", "label": "о_middle_any", "variantOf": "о", "position": "middle",
            "nextLetters": ["е"], "strokes": [{"d": "M 0 88 L 10 88"}],
        },
    }


def test_build_word_trajectory_resolves_middle_variant_agnostic_of_entry_type():
    """Mirrors wordEngine.test.js's "picks the entryType-agnostic middle
    variant regardless of the preceding letter": "бое" -- о is in the
    middle, preceded by a plain (non-dual-nature) letter "б" (entryType
    "lower", but no lower-entryType card is registered), followed by "е"
    (matches the entryType-agnostic card's own nextLetters) -- must fall
    through to variants.any rather than resolving to the plain "о" card."""
    letters = _middle_variant_fixture()
    variant_index = build_variant_index(letters)
    segments = build_word_trajectory("бое", letters, {}, variant_index)
    assert len(segments) == 3
    assert segments[1]["strokes"] is letters["о_middle_any"]["strokes"]


def test_build_pair_with_real_connector_inserts_a_segment():
    letters = {
        "б": {"label": "б", "strokes": [{"d": "M 0 88 L 20 88"}]},  # б: exit override -> line 5
        "т": {"label": "т", "strokes": [{"d": "M 0 75 L 10 62"}]},
    }
    connector = {
        "id": "conn_5_4", "fromLine": 5, "toLine": 4,
        "strokes": [{"d": "M 0 88 L 5 75"}],
    }
    by_key = build_connectors_by_key([connector])
    segments = build_pair("б", "т", letters, by_key, {})
    assert len(segments) == 3  # letter, connector, letter
    assert segments[1]["strokes"] is connector["strokes"]
