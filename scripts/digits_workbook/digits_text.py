"""Pages 21-24: digits inside handwritten text, on the standard propis
ruling. Letters, connectors and punctuation come from the punctuation
workbook's Ink (captured strokes); a token made of digits is drawn with the
«Прописи 2» digits (p2_digits.json "text": the app's copybook-row geometry),
a capital letter tall, so they sit right next to capitals.
"""

from content import (Ink, BASELINES, CONTENT_W_MM, DASH, FADE_OPACITIES,  # noqa: E402
                     LEFT_INSET_MM, CENTER_INSET_MM, WORD_GAP_MM, MARK_GAP_MM, INK)
from render import SCALE, LETTER_BASELINE_UNIT  # noqa: E402
from svg_path import draw_path, path_bounds  # noqa: E402

# a capital letter's height on the propis ruling (top of the captured capitals: native y 39.5, baseline 88)
CAP_MM = (LETTER_BASELINE_UNIT - 39.5) * SCALE


def _text_width(card):
    return max(path_bounds(d, samples_per_curve=60)[1] for d in card["text"]) * CAP_MM


def draw_number_digit(c, card, x_mm, baseline, opacity, color):
    """One digit at letter scale, its ink's left edge at x_mm; returns its width."""
    path = c.beginPath()
    for d in card["text"]:
        draw_path(path, d, lambda nx, ny: (x_mm + nx * CAP_MM, baseline - ny * CAP_MM))
    c.saveState()
    c.setStrokeColorRGB(*color)
    c.setStrokeAlpha(opacity)
    c.setLineWidth(0.275)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()
    return _text_width(card)

DIGIT_GAP_MM = 0.9   # between the digits of one number ("10", "31")

from digits_content import MARGIN_MM  # noqa: E402
TEXT_LEFT_INSET_MM = MARGIN_MM + 2.0   # hug this notebook's narrower red margin


class DigitInk(Ink):
    def __init__(self, cards):
        super().__init__()
        self.digit_cards = cards

    def _number_width(self, num):
        ws = [_text_width(self.digit_cards[d]) for d in num]
        return sum(ws) + DIGIT_GAP_MM * (len(ws) - 1)

    def _layout(self, text):
        ops, x, first = [], 0.0, True
        for token in text.split():
            core = token.rstrip(".,!?")
            tail = token[len(core):]
            if core:
                if not first:
                    x += WORD_GAP_MM
                if all(ch in self.digit_cards for ch in core):   # a number or a sign
                    ops.append(("n", core, x))
                    x += self._number_width(core)
                else:
                    ops.append(("w", core, x))
                    _, width, low = self._word(core)
                    x += low if tail else width
            for ch in tail:
                ax = x + MARK_GAP_MM[ch]
                ops.append(("m", ch, ax))
                x = ax + self.mark_right_mm(ch)
            first = False
        return ops, x

    def draw_text(self, c, text, x0, baseline, opacity, mark_opacity=None):
        from render import draw_pair
        mark_opacity = opacity if mark_opacity is None else mark_opacity
        ops, width = self._layout(text)
        for kind, val, x in ops:
            if kind == "w":
                draw_pair(c, self._word(val)[0], x0 + x, baseline, opacity, color=INK)
            elif kind == "n":
                for d in val:
                    x += draw_number_digit(c, self.digit_cards[d], x0 + x, baseline, opacity, INK) + DIGIT_GAP_MM
            else:
                self.draw_mark(c, val, x0 + x, baseline, mark_opacity)
        return width


_INK = {}


def ink_for(cards):
    if "ink" not in _INK:
        _INK["ink"] = DigitInk(cards)
    return _INK["ink"]


def _row(ink, c, text, baseline, inset, kind, warnings, n):
    w = ink.sentence_width(text)
    if w > CONTENT_W_MM:
        warnings.append(f"p{n}: '{text}' is {w:.0f}mm, row is {CONTENT_W_MM:.0f}mm")
    if kind == "trace":
        c.saveState()
        c.setDash(*DASH)
        ink.draw_text(c, text, inset, baseline, FADE_OPACITIES[0])
        c.restoreState()
    else:
        ink.draw_text(c, text, inset, baseline, 1.0)


def ladder_text_page(c, cards, is_left, trace, models, warnings, n):
    """Same ladder as the punctuation workbook's copy pages: top rows
    half-tone dashed to trace, then each model with an empty row under it."""
    ink = ink_for(cards)
    inset = TEXT_LEFT_INSET_MM if is_left else CENTER_INSET_MM
    rows = [(t, "trace") for t in trace]
    for m in models:
        rows += [(m, "model"), None]
    assert len(rows) <= len(BASELINES), (n, len(rows))
    for baseline, spec in zip(BASELINES, rows):
        if spec:
            _row(ink, c, spec[0], baseline, inset, spec[1], warnings, n)


def distance_text_page(c, cards, is_left, models, fill, warnings, n):
    """Copying at a distance: all models on top, the empty rows below; rows
    left over after one copy of each are filled with number+word phrases,
    half-tone dashed (no empty rows)."""
    ink = ink_for(cards)
    inset = TEXT_LEFT_INSET_MM if is_left else CENTER_INSET_MM
    for k, s in enumerate(models):
        _row(ink, c, s, BASELINES[k], inset, "model", warnings, n)
    for baseline, text in zip(BASELINES[2 * len(models):], fill):
        _row(ink, c, text, baseline, inset, "trace", warnings, n)
