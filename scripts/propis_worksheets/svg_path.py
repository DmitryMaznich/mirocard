"""Minimal SVG path `d`-string parser for propis captured strokes.

Only M (move), L (line), C (cubic bezier) ever appear in
tools/propis/topic.json's stroke data (verified 2026-08-14 by scanning
every captured card) -- this parser intentionally does not support
anything else, and raises loudly if it ever sees something new (a future
capture using an unexpected command should fail the build, not silently
mis-render).
"""

import re

_TOKEN_RE = re.compile(r"([MLC])|(-?\d+\.?\d*)")

_ARITY = {"M": 2, "L": 2, "C": 6}


def parse_path(d):
    """Parse an SVG path `d` string into a list of
    ("M"|"L", (x, y)) / ("C", (x1, y1, x2, y2, x, y)) tuples, in order."""
    tokens = []
    for cmd_match, num_match in _TOKEN_RE.findall(d):
        tokens.append(cmd_match if cmd_match else float(num_match))

    commands = []
    i = 0
    while i < len(tokens):
        cmd = tokens[i]
        if cmd not in _ARITY:
            raise ValueError(f"unsupported path command {cmd!r} in {d!r}")
        arity = _ARITY[cmd]
        args = tuple(tokens[i + 1 : i + 1 + arity])
        commands.append((cmd, args))
        i += 1 + arity
    return commands


def path_bounds(d, samples_per_curve=20):
    """(minx, maxx, miny, maxy) across every command, sampling cubic
    beziers along their actual curve (control points alone can lie
    outside the curve's true bounds, and captured letters' loops
    routinely do)."""
    commands = parse_path(d)
    xs, ys = [], []
    cur = (0.0, 0.0)
    for cmd, args in commands:
        if cmd in ("M", "L"):
            xs.append(args[0])
            ys.append(args[1])
            cur = args
        else:  # "C"
            x1, y1, x2, y2, x, y = args
            x0, y0 = cur
            for s in range(samples_per_curve + 1):
                t = s / samples_per_curve
                mt = 1 - t
                bx = mt**3 * x0 + 3 * mt**2 * t * x1 + 3 * mt * t**2 * x2 + t**3 * x
                by = mt**3 * y0 + 3 * mt**2 * t * y1 + 3 * mt * t**2 * y2 + t**3 * y
                xs.append(bx)
                ys.append(by)
            cur = (x, y)
    return min(xs), max(xs), min(ys), max(ys)


def draw_path(pdf_path, d, transform):
    """Replays `d` onto `pdf_path` (a reportlab Path, or anything exposing
    moveTo/lineTo/curveTo), applying `transform(x, y) -> (x, y)` to every
    point first. Caller still owns canvas.drawPath(...)."""
    for cmd, args in parse_path(d):
        if cmd == "M":
            pdf_path.moveTo(*transform(*args))
        elif cmd == "L":
            pdf_path.lineTo(*transform(*args))
        else:  # "C"
            x1, y1 = transform(args[0], args[1])
            x2, y2 = transform(args[2], args[3])
            x, y = transform(args[4], args[5])
            pdf_path.curveTo(x1, y1, x2, y2, x, y)
