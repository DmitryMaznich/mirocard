#!/usr/bin/env python3
"""Letters of the Bulgarian variant (`propis2_bg`) traced from the customer's reference font, Boyan Maga (a free monoline school font).

  pip install fonttools scikit-image pillow numpy
  python3 tools/propis2/variants/bg/font_glyphs.py <Boyan_Maga-Regular.ttf> <letters> <out.json>

The font is not in the repository; only what this script makes from it. For every letter:
  1. the outline is filled (even-odd: the counters stay open) and thinned to its centre line (skeletonize);
  2. the centre line becomes a graph (ends, junctions, the lines between them; spurs under SPUR px dropped);
  3. the pen's path is the cheapest walk from the entry (the leftmost end; `START_TOP` letters: the topmost one) to the exit (the
     rightmost other end) that draws every line: going back over a line costs its length, a turn costs TURN_W * (1 - cos);
  4. the path goes from the font's geometry (78deg, capitals 2.06, descenders 1.13 x-heights) into the bank's (65deg, 2 and 1, the
     engine's horizontal stretch 1.806 undone), so that the deck's meta.script { slantDeg: 78, upper: 1.06, lower: 1.13 } gives back the font;
  5. it is smoothed between its corners and refit as cubics (tools/propis2/build_digit_glyphs.py), a closed loop never becomes a line.
The font's own lead-in strokes are kept: its letters join where the previous exit lands on them (tried cutting them: gaps).
`noOverrides`: propis2/glyphOverrides.js fixes this bank's shapes by stroke index and must not touch these; `noExit`: the pen ends on
the letter's left (Ф): the next letter stands after it, not joined. Probe 2026-10-18: а н и д ц щ Ф Ц, docs/propis2-variants.md.
"""
import sys, json, math, heapq, itertools
from pathlib import Path
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "tools/propis2"))
import build_digit_glyphs as dg  # noqa: E402
from tidy_trace import parse_path  # noqa: E402

SC = 0.5            # px per font unit for the raster the centre line is taken from
XH = 529.0          # x-height of Boyan Maga, font units
K = 52.0 / XH       # font units -> bank units (the bank's x-height is 52)
SLANT_FONT = 78.0
UPPER, LOWER = 1.06, 1.13
STRETCH = 1.806
# the parts that must touch the first one (К: the font leaves a gap between the arms and the stem; the school letter has none):
# moved left until the nearest point of the part meets the first stroke
ATTACH = set("К")
CORNER_DEG_FONT = 120.0  # a font letter has no sharp corners except where the pen turns back: smaller turns are skeleton noise
START_TOP = set("ФЕЗЬф")  # start at the topmost end (not the leftmost: З's tail is further left than its start)
# where the pen ends, when not at the rightmost end: "low" the lowest end (З: the tail, not the tick at its waist); "oval" the
# junction farthest right (ю Ю: the bar meets the oval; the foot of the stem is drawn on the way and gone back over)
END_HINT = {"З": "low", "Ф": "low", "ю": "oval", "Ю": "oval"}
MAX_POPS = 400000  # search states per walk (Ж Ш Щ have many lines: without a cap the search runs for minutes)
N8=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

def build(sk, spur=5):
    pts=set(zip(*np.nonzero(sk)))
    nb=lambda p:[(p[0]+a,p[1]+b) for a,b in N8 if (p[0]+a,p[1]+b) in pts]
    for _ in range(3):  # prune short spurs
        deg={p:len(nb(p)) for p in pts}
        changed=False
        for p in [p for p in pts if deg[p]==1]:
            chain=[p]; cur=p; prev=None
            while True:
                n=[q for q in nb(cur) if q!=prev and q not in chain]
                if len(n)!=1 or len(nb(n[0]))>2: 
                    if len(n)==1: pass
                    break
                prev=cur; cur=n[0]; chain.append(cur)
                if len(chain)>spur: break
            if len(chain)<=spur and any(len(nb(q))>2 for q in nb(chain[-1])+[chain[-1]]):
                for q in chain:
                    if len(nb(q))<=2: pts.discard(q)
                changed=True
        if not changed: break
    deg={p:len(nb(p)) for p in pts}
    nodepx=[p for p in pts if deg[p]!=2]
    # cluster node pixels
    cl={}; cid=0
    for p in nodepx:
        if p in cl: continue
        st=[p]; cl[p]=cid
        while st:
            q=st.pop()
            for r in nb(q):
                if r in cl or deg[r]==2: continue
                if math.dist(r,p)<10: cl[r]=cid; st.append(r)
        cid+=1
    loops_only = cid==0
    if loops_only:  # a closed loop (о): one node, at its top (where the pen starts an о)
        p=min(pts); cl[p]=0; cid=1
    nodes={i:np.mean([q for q,c in cl.items() if c==i],axis=0) for i in range(cid)}
    edges=[]; seen=set()
    for p,c in cl.items():
        for r in nb(p):
            if r in cl: continue
            if (p,r) in seen: continue
            chain=[p,r]; prev=p; cur=r
            while cur not in cl:
                n=[q for q in nb(cur) if q!=prev and q not in chain[-3:]]
                if not n: break
                nxt=min(n,key=lambda q:(q in cl)==False)  # prefer reaching a node
                prev, cur = cur, n[0] if len(n)==1 else nxt
                chain.append(cur)
            if cur not in cl: continue
            seen.add((chain[-1],chain[-2])); seen.add((p,r))
            edges.append((c,cl[cur],chain))
    # dedupe edges (same pixels reversed)
    uniq=[]; sig=set()
    for a,b,ch in edges:
        k=frozenset(ch[len(ch)//4:3*len(ch)//4+1]) if len(ch)>8 else (min(a,b),max(a,b),len(ch))
        k=(frozenset((a,b)), len(ch)//3)
        if k in sig: continue
        sig.add(k); uniq.append((a,b,ch))
    # skeleton noise: tiny closed loops at a stroke's tip or at a joint (3-20 px; the loops of the letters are hundreds) are dropped,
    # else the tip of a stroke is no longer an end (К's arm started in its middle)
    uniq = [(a, b, ch) for a, b, ch in uniq if not (a == b and len(ch) < 20)]
    # and a stub left where such a loop sat (a few px from a joint to nowhere) is noise too, not the end of a stroke
    while True:
        deg = {}
        for a, b, _ in uniq: deg[a] = deg.get(a, 0) + 1; deg[b] = deg.get(b, 0) + 1
        stub = [k for k, (a, b, ch) in enumerate(uniq) if len(ch) < 14 and a != b and min(deg[a], deg[b]) == 1 and max(deg[a], deg[b]) >= 3]
        if not stub: break
        uniq = [e for k, e in enumerate(uniq) if k != stub[0]]
    return nodes, uniq

def tangent(chain, at_start, k=10):
    c=np.array(chain[:k] if at_start else chain[-k:][::-1], float)
    d=c[-1]-c[0]
    d=np.array([d[1],-d[0]])  # (row,col) -> (x right, y up)
    n=np.hypot(*d); return d/n if n else d

def walk(nodes, edges, start_node, end_node, turn_w=60.0, k=1):
    """Cheapest walk from start to end using every edge at least once: retrace costs its length, turns cost turn_w*(1-cos)."""
    E=len(edges)
    L=[len(ch) for _,_,ch in edges]
    best=[None,math.inf]; found=[]
    # state: (cost, node, usedmask, incoming dir, path)
    cnt=itertools.count()
    h=[(0.0,next(cnt),start_node,0,None,())]
    seen={}
    pops=0
    while h:
        pops+=1
        if pops>MAX_POPS: break  # a letter with many crossings: take the best walks found so far
        cost,_,node,used,din,path=heapq.heappop(h)
        if found and cost>best[1]*1.8+40: break
        if used==(1<<E)-1 and node==end_node:
            found.append((cost,path))
            if cost<best[1]: best=[path,cost]
            if len(found)>=k: break
            continue
        key=(node,used,None if din is None else (round(din[0],1),round(din[1],1)))
        if seen.get(key,0)>=k: continue
        seen[key]=seen.get(key,0)+1
        for i,(a,b,ch) in enumerate(edges):
            for fwd,(u,v) in ((True,(a,b)),(False,(b,a))):
                if u!=node: continue
                c2=ch if fwd else ch[::-1]
                dout=tangent(c2,True); dend=tangent(c2,False)
                t=0.0 if din is None else turn_w*(1-float(np.dot(din,dout)))
                r=L[i] if used>>i&1 else 0.0
                if len(path)>3*E: continue
                heapq.heappush(h,(cost+t+r,next(cnt),v,used|1<<i,-dend,path+((i,fwd),)))
                # a closed loop (о) can be gone round either way: both are tried
    return [p for _,p in sorted(found)] if k>1 else best[0]


class Flat(BasePen):
    def __init__(s, gs): super().__init__(gs); s.polys = []; s.cur = []
    def _moveTo(s, p): s.cur = [p]
    def _lineTo(s, p): s.cur.append(p)
    def _curveToOne(s, a, b, c):
        p0 = np.array(s.cur[-1]); a, b, c = map(np.array, (a, b, c))
        for t in np.linspace(0, 1, 12)[1:]: s.cur.append(tuple((1-t)**3*p0 + 3*(1-t)**2*t*a + 3*(1-t)*t**2*b + t**3*c))
    def _qCurveToOne(s, a, b):
        p0 = np.array(s.cur[-1]); a, b = map(np.array, (a, b))
        for t in np.linspace(0, 1, 10)[1:]: s.cur.append(tuple((1-t)**2*p0 + 2*(1-t)*t*a + t**2*b))
    def _closePath(s): s.polys.append(s.cur); s.cur = []
    _endPath = _closePath


def to_bank(x, y):
    t_font, t_bank = math.tan(math.radians(90 - SLANT_FONT)), math.tan(math.radians(25))
    xu = x - y * t_font
    yu = XH + (y - XH) / UPPER if y > XH else (y / LOWER if y < 0 else y)
    yd = yu * K
    return np.array([xu * K / STRETCH + yd * t_bank, 62.0 - yd])


def resample_n(p, n=80):
    p = np.asarray(p, float)
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    u = np.linspace(0, s[-1], n)
    return np.stack([np.interp(u, s, p[:, 0]), np.interp(u, s, p[:, 1])], axis=1)


def dtw(a, b):
    """Mean distance along the best monotone pairing of two pen paths (bank units): how far apart they run, in order."""
    n, m = len(a), len(b)
    d = np.hypot(a[:, None, 0] - b[None, :, 0], a[:, None, 1] - b[None, :, 1])
    D = np.full((n + 1, m + 1), np.inf); D[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = d[i - 1, j - 1] + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return float(D[n, m] / (n + m))


def reference_path(ref):
    """Our bank letter's pen path (all its strokes in order, bank units, unstretched as stored)."""
    if not ref or not ref.get("strokes"): return None  # ш of the bank is built from parts (no strokes of its own): no guide
    pts = [q for st in ref["strokes"] for q in parse_path(st["d"])]
    return np.array(pts) if len(pts) > 1 else None


def pen_path(gs, cm, ch, ref=None):
    pen = Flat(gs); gs[cm[ord(ch)]].draw(pen)
    xs = [p[0] for poly in pen.polys for p in poly]; ys = [p[1] for poly in pen.polys for p in poly]
    x0, y1 = min(xs) - 20, max(ys) + 20
    W, H = int((max(xs) - x0 + 20) * SC) + 2, int((y1 - min(ys) + 20) * SC) + 2
    # non-zero winding (the font's own rule): strokes drawn as separate overlapping contours stay joined where they overlap (К's
    # arms on its stem); counters run the other way and stay open. (Even-odd cut every overlap out: the arms of К hung free.)
    wind = np.zeros((H, W), int)
    for poly in pen.polys:
        m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([((x - x0) * SC, (y1 - y) * SC) for x, y in poly], fill=1)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))
        wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
    acc = wind != 0
    nodes_all, edges_all = build(skeletonize(acc))
    # separate parts of the letter (the breve of й): one walk each; the biggest is the letter, the others come after it, left to right
    parent = {i: i for i in nodes_all}
    def root(i):
        while parent[i] != i: i = parent[i]
        return i
    for a, b, _ in edges_all: parent[root(a)] = root(b)
    parts = {}
    for e in edges_all: parts.setdefault(root(e[0]), []).append(e)
    parts = sorted(parts.values(), key=lambda es: -sum(len(c) for _, _, c in es))
    to_b = lambda px: np.array([to_bank(c / SC + x0, y1 - r / SC) for r, c in px])
    out = []
    for k, es in enumerate(parts):
        ns = {i: nodes_all[i] for i in {x for a, b, _ in es for x in (a, b)}}
        # a later stroke of a capital (К's arms) starts at its top end, as the school writes it
        out.append(walk_part(ch, ns, es, to_b, ref if (k == 0 and len(parts) == 1) else None, x0, y1, top=k > 0))
    if len(parts) == 1 or ref is None:
        marks = [school_direction(m[0]) for m in sorted(out[1:], key=lambda r: r[0][:, 0].min())]
        return [out[0][0]] + marks, out[0][1]
    return order_parts([o[0] for o in out], ref)


def school_direction(p):
    """A stroke after the first, as the school writes it: a stem or an arm from the top down, a bar or a breve from left to right."""
    d = p[-1] - p[0]
    return p[::-1] if (abs(d[1]) >= abs(d[0]) and d[1] < 0) or (abs(d[1]) < abs(d[0]) and d[0] < 0) else p


def order_parts(paths, ref):
    """Strokes of a letter with pen lifts (capitals П Т К…): in the order, and each in the direction, our letter writes its parts.
    Every part is placed where it runs along our letter's path (the index of the nearest point of our path for its first and last
    point); a part that runs against our path is reversed. Returns the strokes and the distance of the whole from our path."""
    allp = np.concatenate(paths)
    shift = (ref[:, 0].min() + ref[:, 0].max()) / 2 - (allp[:, 0].min() + allp[:, 0].max()) / 2
    R = resample_n(ref, 160)
    idx = lambda q: int(np.argmin(np.hypot(R[:, 0] - q[0] - shift, R[:, 1] - q[1])))
    placed = []
    for p in paths:
        a, b = idx(p[0]), idx(p[-1])
        if b < a: p, (a, b) = p[::-1], (b, a)
        placed.append((a, p))
    placed.sort(key=lambda t: t[0])
    strokes = [p for _, p in placed]
    # the strokes after the first, as the school writes them: a stem or an arm from the top down, a bar from left to right
    # (our letters' own direction was not reliable for them: К's arms and Т's middle stem came out drawn upwards)
    strokes[1:] = [school_direction(p) for p in strokes[1:]]
    return strokes, dtw(resample_n(np.concatenate(strokes) + [shift, 0]), resample_n(ref))


def walk_part(ch, nodes, edges, to_b, ref, x0, y1, top=False):
    """One connected part of a letter: the pen path (bank units) and its distance from our letter's path (None without a guide)."""
    deg = {i: 0 for i in nodes}
    for a, b, _ in edges: deg[a] += 1; deg[b] += 1
    ends = [i for i in nodes if deg[i] == 1]
    left = (min(ends, key=lambda i: nodes[i][0]) if (ch in START_TOP or top) else min(ends, key=lambda i: nodes[i][1])) if ends else 0
    rest = [i for i in ends if i != left]
    right = max(rest, key=lambda i: nodes[i][1]) if rest else left
    hint = END_HINT.get(ch)
    if hint == "low" and rest: right = max([i for i in ends if i != left], key=lambda i: nodes[i][0])
    if hint == "oval":
        joints = [i for i in nodes if deg[i] > 2]
        if joints: right = max(joints, key=lambda i: nodes[i][1])
    def walked(path):
        px = []
        for i, fwd in path:
            c = edges[i][2] if fwd else edges[i][2][::-1]
            px.extend(c if not px else c[1:])
        return to_b(px)
    def plain():
        path = walk(nodes, edges, left, right)
        if not path:  # nothing found within the cap: the lines one after another, as the skeleton lists them
            path = [(i, True) for i in range(len(edges))]
        return walked(path), None
    if ref is None:
        return plain()
    # our letter's pen path as the guide: the ends nearest to its start / end are candidates too, and of the cheapest few walks
    # the one that runs closest to it, in order, is taken (the letter placed over ours by the centre of its box)
    node_b = {i: to_bank(nodes[i][1] / SC + x0, y1 - nodes[i][0] / SC) for i in nodes}
    rx = (ref[:, 0].min() + ref[:, 0].max()) / 2
    allb = to_b([tuple(nodes[i]) for i in nodes])
    shift = rx - (allb[:, 0].min() + allb[:, 0].max()) / 2
    near = lambda q: min(ends, key=lambda i: np.hypot(node_b[i][0] + shift - q[0], node_b[i][1] - q[1])) if ends else 0
    # a letter never starts at its exit (the rightmost end): our letters have no lead-in, so the end nearest to our start can be it (я)
    starts = {left} | ({near(ref[0])} - ({right} if len(ends) > 1 else set())) if ch not in START_TOP else {left}
    finishes = {right} if ch in END_HINT else {right, near(ref[-1])}
    if len(ends) == 1 and nodes[ends[0]][1] < np.mean([nodes[i][1] for i in nodes]):
        starts, finishes = {ends[0]}, set(nodes) - {ends[0]}  # the one free end is on the left: it is the start (в), the pen ends inside
    elif len(ends) < 2:  # the pen starts inside the letter (б: where its bowl closes): the point nearest to where ours starts
        starts |= {min(nodes, key=lambda i: np.hypot(node_b[i][0] + shift - ref[0][0], node_b[i][1] - ref[0][1]))}
    best = (math.inf, None)
    R = resample_n(ref)
    for a in starts:
        for b in finishes:
            if a == b and len(ends) > 1 and len(starts) == 1: continue
            for path in walk(nodes, edges, a, b, k=8):
                p = walked(path); score = dtw(resample_n(p + [shift, 0]), R)
                if score < best[0]: best = (score, p)
    return (best[1], best[0]) if best[1] is not None else plain()


def smooth_cmds(raw):
    p = dg.resample(raw, dg.SPACING)
    keep, dg.CORNER_DEG = dg.CORNER_DEG, CORNER_DEG_FONT
    cuts = [0] + dg.corners(p, dg.SPACING) + [len(p) - 1]
    dg.CORNER_DEG = keep
    cmds = []
    for a, b in zip(cuts, cuts[1:]):
        piece = p[a:b + 1]
        if len(piece) < 2: continue
        if not cmds: cmds.append(("M", [piece[0]]))
        if np.hypot(*(piece[-1] - piece[0])) > 4 and dg.straight(piece): cmds.append(("L", [piece[-1]])); continue
        for c1, c2, e in dg.beziers(dg.smooth(piece, dg.SPACING), dg.SPACING): cmds.append(("C", [c1, c2, e]))
    return cmds


def glyph(gs, cm, ch, old):
    raws, score = pen_path(gs, cm, ch, reference_path(old.get(ch)))
    if ch in ATTACH and len(raws) > 1:
        main = raws[0]
        def gap(part):
            # the smallest horizontal distance from a point of the part to the first stroke on its left at the same height
            # (the vertex of К's arms; not the part's leftmost point: on the slant that is the foot of its leg)
            best = np.inf
            for q in part[::4]:
                near = main[(np.abs(main[:, 1] - q[1]) < 1.0) & (main[:, 0] < q[0])]
                if len(near): best = min(best, q[0] - near[:, 0].max())
            return best if np.isfinite(best) else 0.0
        raws = [main] + [r - [max(gap(r) - 0.6, 0.0), 0] for r in raws[1:]]
    strokes = [{"d": dg.fmt(smooth_cmds(r))} for r in raws if len(r) > 2]
    p = dg.resample(raws[0], dg.SPACING)
    base = old.get(ch, {})
    g = {"label": ch, "kind": "letter", "strokes": strokes, "stretch": STRETCH, "noOverrides": True,
         "repeatCells": base.get("repeatCells", 4), "sourceLabel": f"{ch} (Boyan Maga: средняя линия контура, порядок пера по графу)"}
    for k in ("joinLeft", "descender", "ascender", "noNormalize"):
        if base.get(k): g[k] = base[k]
    if ch.isupper(): g["ascender"] = True; g["noNormalize"] = True
    if p[-1, 0] < (p[:, 0].min() + p[:, 0].max()) / 2: g["noExit"] = True
    if score is not None: g["refDistance"] = round(score, 2)  # how far the pen runs from our letter's (bank units; review the large ones)
    return g


def one(font, ch, old):
    import time
    t = time.time()
    f = TTFont(font); gs = f.getGlyphSet(); cm = f.getBestCmap()
    try:
        g = glyph(gs, cm, ch, old)
    except Exception as e:  # one letter must not stop the others
        print(f"{ch}: FAILED {e!r}", flush=True)
        return {"label": ch, "failed": repr(e)}
    print(f"{ch}: {time.time() - t:.0f}s, distance {g.get('refDistance')}", flush=True)
    return g


def main():
    font, letters, out = sys.argv[1], sys.argv[2], sys.argv[3]
    f = TTFont(font); gs = f.getGlyphSet(); cm = f.getBestCmap()
    old = {}
    for g in json.loads((ROOT / "tools/propis/wide.json").read_text())["glyphs"]:
        old[g["label"]] = g
        for a in g.get("aliases", []): old.setdefault(a, g)
    for g in json.loads((ROOT / "tools/propis2/variants/bg/variant.json").read_text()).get("glyphs", []): old[g["label"]] = g
    from multiprocessing import Pool
    with Pool() as pool:
        glyphs = pool.starmap(one, [(font, ch, old) for ch in letters])
    failed = [g["label"] for g in glyphs if g.get("failed")]
    glyphs = [g for g in glyphs if not g.get("failed")]
    if failed: print("FAILED:", "".join(failed))
    Path(out).write_text(json.dumps(glyphs, ensure_ascii=False, indent=1))
    print(f"{len(glyphs)} glyphs -> {out}")


if __name__ == "__main__":
    main()
