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

from svg_path import path_bounds, draw_path

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOPIC_JSON = os.path.join(ROOT, "tools", "propis", "topic.json")

# Mirrors propisRuling.js: UNIT_H is the native-unit height of one row
# (150), matched to a real 25mm row (10mm ascender gap + 5mm узкая строка +
# 10mm descender gap) -- so every letter's native coordinates scale by the
# same fixed ROW_MM / UNIT_H factor, regardless of which row it's drawn on.
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
    c.setLineWidth(1.1)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()

    return (maxx - minx) * SCALE
