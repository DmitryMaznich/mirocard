"""Draws a single propis letter card's captured strokes onto a reportlab
canvas, scaled from the app's own native coordinate system into real mm.

No connector-chaining here at all -- every instance a worksheet ever draws
is a single isolated letter (lowercase alone, uppercase alone, or a
lowercase+uppercase pair placed side by side with a plain gap, never
joined by a connecting pen stroke), so wordEngine.js's connector-lookup
system has nothing to port.
"""

import json
import os

from svg_path import path_bounds, draw_path, sample_path

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOPIC_JSON = os.path.join(ROOT, "tools", "propis", "topic.json")

# UNIT_H is the native-unit height of one letter's design canvas (150).
# ROW_MM is the mm a letter's own native-unit height maps onto. 25.0, not
# 20.0 (corrected 2026-08-19) -- the 2026-08-15 migration onto the shared
# notebook ruling dropped Phase 1's original propis-specific 25mm value
# without rechecking it against the new ruling's own narrow-zone height,
# leaving plain lowercase letters (о, с, п...) about 20% short of the
# ruling's own thin x-height guide line instead of touching it (confirmed
# 2026-08-19 from a printed proof: measured every captured letter's own
# ink bounds -- "о", the classic x-height reference, landed at 3.22mm
# against page.py's NARROW_MM=4mm target at ROW_MM=20; 25.0 puts it at
# 4.02mm, matching the line). Coincidentally (or not) the same 25mm Phase
# 1 used originally, before that migration ever touched this constant.
UNIT_H = 150
ROW_MM = 25.0
SCALE = ROW_MM / UNIT_H

# The baseline every captured letter's own path data was drawn against --
# matches propisRuling.js's LETTER_BASELINE_UNIT exactly. This, not the
# letter's own bounding box, is what has to land on the ruling's real
# baseline (native y above 88 = above the baseline; below = descender).
LETTER_BASELINE_UNIT = 88


def load_letters():
    with open(TOPIC_JSON, encoding="utf-8") as f:
        topic = json.load(f)
    letters = {}
    for card in topic["cards"]:
        if card["type"] == "letter" and not card.get("variantOf"):
            letters[card["label"]] = card
    return letters


def load_letters_with_variants():
    """Like load_letters(), but keyed by each card's own `label` field and
    including variant cards (о_first_u, etc.) -- connectors.py's
    build_variant_index/resolve_variant need the variants; the plain
    letters stay reachable under their own single-character labels
    exactly as before."""
    with open(TOPIC_JSON, encoding="utf-8") as f:
        topic = json.load(f)
    return {c["label"]: c for c in topic["cards"] if c["type"] == "letter"}


def load_connectors():
    with open(TOPIC_JSON, encoding="utf-8") as f:
        topic = json.load(f)
    return [c for c in topic["cards"] if c["type"] == "connector"]


def letter_ink_bounds(card):
    """(minx, maxx, miny, maxy) in native units, across ALL of the card's
    strokes together -- matches how the app's own minX-shift normalization
    treats a multi-stroke letter (к, х, Й, Ё...) as one combined shape."""
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for stroke in card["strokes"]:
        sx0, sx1, sy0, sy1 = path_bounds(stroke["d"])
        minx, maxx = min(minx, sx0), max(maxx, sx1)
        miny, maxy = min(miny, sy0), max(maxy, sy1)
    return minx, maxx, miny, maxy


def draw_letter(c, card, origin_x_mm, baseline_y_mm, opacity, color=(0.11, 0.30, 0.85)):
    """Draws one instance of `card`. Its own left ink edge lands at
    `origin_x_mm`; its own baseline (native y = LETTER_BASELINE_UNIT)
    lands at `baseline_y_mm`. Returns the mm width consumed (real ink
    width, not the nominal 100-unit capture-canvas box) so the caller can
    advance x for the next instance."""
    minx, maxx, _, _ = letter_ink_bounds(card)

    def transform(nx, ny):
        px = origin_x_mm + (nx - minx) * SCALE
        py = baseline_y_mm - (ny - LETTER_BASELINE_UNIT) * SCALE
        return px, py

    path = c.beginPath()
    for stroke in card["strokes"]:
        draw_path(path, stroke["d"], transform)

    c.saveState()
    c.setStrokeColorRGB(*color)
    c.setStrokeAlpha(opacity)
    c.setLineWidth(0.275)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()

    return (maxx - minx) * SCALE


def _segment_bounds(segment):
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    dx, scale_y, translate_y = segment["dx"], segment["scaleY"], segment["translateY"]
    for stroke in segment["strokes"]:
        for x, y in sample_path(stroke["d"]):
            tx, ty = x + dx, y * scale_y + translate_y
            minx, maxx = min(minx, tx), max(maxx, tx)
            miny, maxy = min(miny, ty), max(maxy, ty)
    return minx, maxx, miny, maxy


def draw_pair(c, segments, origin_x_mm, baseline_y_mm, opacity, color=(0.11, 0.30, 0.85)):
    """Draws a connectors.build_pair() trajectory (letter + real connector
    strokes + letter, in native units) -- same contract as draw_letter:
    its own combined left ink edge lands at `origin_x_mm`, letter 1's own
    native baseline (unaffected by any transform, since letter 1 is
    always segment 0 with dx=dy=0, scaleY=1 -- see build_pair) lands at
    `baseline_y_mm`. Returns the mm width consumed."""
    minx = min(_segment_bounds(s)[0] for s in segments)
    maxx = max(_segment_bounds(s)[1] for s in segments)

    path = c.beginPath()
    for segment in segments:
        dx, scale_y, translate_y = segment["dx"], segment["scaleY"], segment["translateY"]

        def transform(nx, ny, dx=dx, scale_y=scale_y, translate_y=translate_y):
            wx = nx + dx
            wy = ny * scale_y + translate_y
            px = origin_x_mm + (wx - minx) * SCALE
            py = baseline_y_mm - (wy - LETTER_BASELINE_UNIT) * SCALE
            return px, py

        for stroke in segment["strokes"]:
            draw_path(path, stroke["d"], transform)

    c.saveState()
    c.setStrokeColorRGB(*color)
    c.setStrokeAlpha(opacity)
    c.setLineWidth(0.275)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()

    return (maxx - minx) * SCALE
