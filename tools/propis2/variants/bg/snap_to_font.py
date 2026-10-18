#!/usr/bin/env python3
"""A letter traced over a Boyan underlay -> the same pen path laid exactly on the font's centre line (no shake of the hand).

The hand gives what only it knows: where each stroke starts, its order, its direction, where the pen lifts (А: the bar is a stroke of
its own), what is gone over twice. The font gives the shape. Every point of a traced stroke is matched to the nearest point of the
font's centre line (font_glyphs.py's skeleton graph, placed where make_underlays.py puts the underlay on the capture canvas, then
nudged onto the trace); the stroke is rebuilt by walking the centre line through those matches: along a line while the hand stays on
it, through the joint where the hand passes from one line to the next. Used by build_glyphs.py for every underlay capture.
"""
import heapq
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize

import font_glyphs as fg
import make_underlays as mu

STEP = 0.5        # resampling of the trace, tool units
MIN_RUN = 4       # a stay on a line shorter than this (points) is a slip of the matching near a joint, not a visit
END_SNAP = 3.0    # a stroke starting / ending this close to a free end of a line starts / ends exactly there


def centre_lines(gs, cm, ch):
    """The font letter's centre line as a graph, in capture-canvas units where the underlay shows it: nodes {id: xy}, edges [(a, b, pts)]."""
    pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
    xs = [p[0] for poly in pen.polys for p in poly]; ys = [p[1] for poly in pen.polys for p in poly]
    x0, y1 = min(xs) - 20, max(ys) + 20
    W, H = int((max(xs) - x0 + 20) * fg.SC) + 2, int((y1 - min(ys) + 20) * fg.SC) + 2
    wind = np.zeros((H, W), int)
    for poly in pen.polys:
        m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([((x - x0) * fg.SC, (y1 - y) * fg.SC) for x, y in poly], fill=1)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))
        wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
    nodes, edges = fg.build(skeletonize(wind != 0))
    tool = lambda r, c: mu.bank_to_tool(*fg.to_bank(c / fg.SC + x0, y1 - r / fg.SC))
    # the underlay's own placement (make_underlays.py): ink from LEFT, the image's left edge at canvas x = 100
    xmin = min(mu.bank_to_tool(*fg.to_bank(x, y))[0] for poly in pen.polys for x, y in poly)
    dx = mu.LEFT - xmin + 100.0
    to_canvas = lambda r, c: np.array(tool(r, c)) + [dx, 0.0]
    N = {i: to_canvas(*nodes[i]) for i in nodes}
    E = [(a, b, np.array([to_canvas(r, c) for r, c in ch_])) for a, b, ch_ in edges]
    return N, E


def _nearest(points, E):
    """For every point: (edge, index on the edge, distance) of the nearest centre-line point."""
    allp = np.concatenate([e[2] for e in E]); owner = np.concatenate([[k] * len(e[2]) for k, e in enumerate(E)])
    index = np.concatenate([np.arange(len(e[2])) for e in E])
    out = []
    for p in points:
        d = np.hypot(allp[:, 0] - p[0], allp[:, 1] - p[1]); j = int(np.argmin(d))
        out.append((int(owner[j]), int(index[j]), float(d[j])))
    return out


def _align(points, E):
    """The trace and the centre line can be a hair apart (the underlay nudged): the shift that brings them together."""
    allp = np.concatenate([e[2] for e in E])
    best = (np.inf, 0.0, 0.0)
    for sx in np.arange(-3, 3.01, 0.5):
        for sy in np.arange(-3, 3.01, 0.5):
            q = points[::6] + [sx, sy]
            d = np.min(np.hypot(q[:, None, 0] - allp[None, :, 0], q[:, None, 1] - allp[None, :, 1]), axis=1).mean()
            if d < best[0]: best = (d, sx, sy)
    return np.array(best[1:])


def _piece(E, k, i, j, direction):
    pts = E[k][2]; n = len(pts)
    if E[k][0] == E[k][1] and direction != 0:  # a closed loop: round it the way the hand went
        idx = [(i + direction * t) % n for t in range(((j - i) * direction) % n + 1)]
        return pts[idx]
    return pts[i:j + 1] if j >= i else pts[j:i + 1][::-1]


def _path_between(N, E, a, b):
    """Nodes a -> b along the centre line: the pieces of edges to walk (shortest)."""
    dist = {a: 0.0}; prev = {}; h = [(0.0, a)]
    while h:
        d, u = heapq.heappop(h)
        if u == b: break
        if d > dist.get(u, np.inf): continue
        for k, (x, y, pts) in enumerate(E):
            for v, fwd in ((y, True), (x, False)):
                if (x if fwd else y) != u: continue
                nd = d + len(pts)
                if nd < dist.get(v, np.inf): dist[v] = nd; prev[v] = (u, k, fwd); heapq.heappush(h, (nd, v))
    out = []; u = b
    while u != a and u in prev:
        p, k, fwd = prev[u]; out.append(E[k][2] if fwd else E[k][2][::-1]); u = p
    return out[::-1]


def snap_stroke(trace, N, E):
    """One traced stroke (canvas points) -> the same stroke along the centre line."""
    p = fg.dg.resample(np.asarray(trace, float), STEP)
    m = _nearest(p, E)
    # runs of points on one line; a short run between two others is a slip at a joint
    runs = []
    for k, (e, i, d) in enumerate(m):
        if runs and runs[-1][0] == e: runs[-1][1].append(k)
        else: runs.append([e, [k]])
    while len(runs) > 1:
        short = [r for r in range(len(runs)) if len(runs[r][1]) < MIN_RUN]
        if not short: break
        r = short[0]
        into = r - 1 if r > 0 else r + 1
        runs[into][1] = sorted(runs[into][1] + runs[r][1]); del runs[r]
        merged = []
        for run in runs:
            if merged and merged[-1][0] == run[0]: merged[-1][1] += run[1]
            else: merged.append(run)
        runs = merged
    out = []
    for r, (e, ks) in enumerate(runs):
        a, b = E[e][0], E[e][1]
        idx = [m[k][1] for k in ks]
        loop = a == b
        steps = np.diff(idx)
        if loop: steps = (steps + len(E[e][2]) // 2) % len(E[e][2]) - len(E[e][2]) // 2
        direction = int(np.sign(steps.sum())) if len(steps) else 0
        i0, i1 = idx[0], idx[-1]
        n = len(E[e][2])
        # entering from the previous line: from the joint they share
        if r > 0:
            pe = runs[r - 1][0]; shared = {E[pe][0], E[pe][1]} & {a, b}
            if shared:
                # two lines can share both ends (the oval of а): the joint the hand passed is the one nearest where it passed
                node = min(shared, key=lambda nd: np.hypot(*(N[nd] - p[ks[0]])))
                i0 = 0 if node == a else n - 1
                if loop: i0 = 0
            else:
                last_node = min((E[pe][0], E[pe][1]), key=lambda nd: np.hypot(*(N[nd] - out[-1])) if out else 0)
                to = min((a, b), key=lambda nd: np.hypot(*(N[nd] - N[last_node])))
                for seg in _path_between(N, E, last_node, to): out.extend(seg)
                i0 = 0 if to == a else n - 1
        # leaving to the next line: to the joint they share
        if r < len(runs) - 1:
            ne = runs[r + 1][0]; shared = {E[ne][0], E[ne][1]} & {a, b}
            if shared:
                node = min(shared, key=lambda nd: np.hypot(*(N[nd] - p[ks[-1]]))); i1 = 0 if node == a else n - 1
                if loop: i1 = 0
                if not loop: direction = 1 if i1 >= i0 else -1
        if not loop: direction = 1 if i1 >= i0 else -1
        piece = _piece(E, e, i0, i1, direction)
        if loop and r < len(runs) - 1 and i0 == i1 == 0: piece = _piece(E, e, 0, n - 1, direction or 1)
        out.extend(piece)
    out = np.array(out)
    # a start / end right at a free end of a line: exactly there
    free = [N[i] for i in N if sum((x == i) + (y == i) for x, y, _ in E) == 1]
    for at in (0, -1):
        near = [q for q in free if np.hypot(*(q - out[at])) < END_SNAP]
        if near: out[at] = min(near, key=lambda q: np.hypot(*(q - out[at])))
    return out


def snap(item, gs, cm):
    """A capture item (the tool's export) -> its strokes as canvas point arrays, laid on the font."""
    N, E = centre_lines(gs, cm, item["label"])
    traces = [np.array(fg.parse_path(st["d"])) for st in item["strokes"]]
    shift = _align(np.concatenate(traces), E)
    traces = [t + shift for t in traces]
    return [snap_stroke(t, N, E) for t in traces]
