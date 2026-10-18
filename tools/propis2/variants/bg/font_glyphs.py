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

SC = 0.5            # px per font unit for the raster the centre line is taken from
XH = 529.0          # x-height of Boyan Maga, font units
K = 52.0 / XH       # font units -> bank units (the bank's x-height is 52)
SLANT_FONT = 78.0
UPPER, LOWER = 1.06, 1.13
STRETCH = 1.806
START_TOP = set("Ф")
N8=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

def build(sk, spur=18):
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
                if math.dist(r,p)<6: cl[r]=cid; st.append(r)
        cid+=1
    loops_only = cid==0
    if loops_only:  # a closed loop (о): make one node
        p=next(iter(pts)); cl[p]=0; cid=1
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
    return nodes, uniq

def tangent(chain, at_start, k=10):
    c=np.array(chain[:k] if at_start else chain[-k:][::-1], float)
    d=c[-1]-c[0]
    d=np.array([d[1],-d[0]])  # (row,col) -> (x right, y up)
    n=np.hypot(*d); return d/n if n else d

def walk(nodes, edges, start_node, end_node, turn_w=60.0):
    """Cheapest walk from start to end using every edge at least once: retrace costs its length, turns cost turn_w*(1-cos)."""
    E=len(edges)
    L=[len(ch) for _,_,ch in edges]
    best=[None,math.inf]
    # state: (cost, node, usedmask, incoming dir, path)
    cnt=itertools.count()
    h=[(0.0,next(cnt),start_node,0,None,())]
    seen={}
    while h:
        cost,_,node,used,din,path=heapq.heappop(h)
        if cost>=best[1]: continue
        if used==(1<<E)-1 and node==end_node:
            best=[path,cost]; continue
        key=(node,used,None if din is None else (round(din[0],1),round(din[1],1)))
        if key in seen and seen[key]<=cost: continue
        seen[key]=cost
        for i,(a,b,ch) in enumerate(edges):
            for fwd,(u,v) in ((True,(a,b)),(False,(b,a))):
                if u!=node: continue
                c2=ch if fwd else ch[::-1]
                dout=tangent(c2,True); dend=tangent(c2,False)
                t=0.0 if din is None else turn_w*(1-float(np.dot(din,dout)))
                r=L[i] if used>>i&1 else 0.0
                if len(path)>3*E: continue
                heapq.heappush(h,(cost+t+r,next(cnt),v,used|1<<i,-dend,path+((i,fwd),)))
                if a==b: break
    return best[0]


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


def pen_path(gs, cm, ch):
    pen = Flat(gs); gs[cm[ord(ch)]].draw(pen)
    xs = [p[0] for poly in pen.polys for p in poly]; ys = [p[1] for poly in pen.polys for p in poly]
    x0, y1 = min(xs) - 20, max(ys) + 20
    W, H = int((max(xs) - x0 + 20) * SC) + 2, int((y1 - min(ys) + 20) * SC) + 2
    acc = np.zeros((H, W), bool)
    for poly in pen.polys:
        m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([((x - x0) * SC, (y1 - y) * SC) for x, y in poly], fill=1)
        acc ^= np.array(m)
    nodes, edges = build(skeletonize(acc))
    deg = {i: 0 for i in nodes}
    for a, b, _ in edges: deg[a] += 1; deg[b] += 1
    ends = [i for i in nodes if deg[i] == 1]
    start = (min(ends, key=lambda i: nodes[i][0]) if ch in START_TOP else min(ends, key=lambda i: nodes[i][1])) if ends else 0
    rest = [i for i in ends if i != start]
    end = max(rest, key=lambda i: nodes[i][1]) if rest else start
    px = []
    for i, fwd in walk(nodes, edges, start, end):
        c = edges[i][2] if fwd else edges[i][2][::-1]
        px.extend(c if not px else c[1:])
    return np.array([to_bank(c / SC + x0, y1 - r / SC) for r, c in px])


def glyph(gs, cm, ch, old):
    p = dg.resample(pen_path(gs, cm, ch), dg.SPACING)
    cuts = [0] + dg.corners(p, dg.SPACING) + [len(p) - 1]
    cmds = []
    for a, b in zip(cuts, cuts[1:]):
        piece = p[a:b + 1]
        if len(piece) < 2: continue
        if not cmds: cmds.append(("M", [piece[0]]))
        if np.hypot(*(piece[-1] - piece[0])) > 4 and dg.straight(piece): cmds.append(("L", [piece[-1]])); continue
        for c1, c2, e in dg.beziers(dg.smooth(piece, dg.SPACING), dg.SPACING): cmds.append(("C", [c1, c2, e]))
    base = old.get(ch, {})
    g = {"label": ch, "kind": "letter", "strokes": [{"d": dg.fmt(cmds)}], "stretch": STRETCH, "noOverrides": True,
         "repeatCells": base.get("repeatCells", 4), "sourceLabel": f"{ch} (Boyan Maga: средняя линия контура, порядок пера по графу)"}
    for k in ("joinLeft", "descender", "ascender", "noNormalize"):
        if base.get(k): g[k] = base[k]
    if ch.isupper(): g["ascender"] = True; g["noNormalize"] = True
    if p[-1, 0] < (p[:, 0].min() + p[:, 0].max()) / 2: g["noExit"] = True
    return g


def main():
    font, letters, out = sys.argv[1], sys.argv[2], sys.argv[3]
    f = TTFont(font); gs = f.getGlyphSet(); cm = f.getBestCmap()
    old = {g["label"]: g for g in json.loads((ROOT / "tools/propis/wide.json").read_text())["glyphs"]}
    glyphs = [glyph(gs, cm, ch, old) for ch in letters]
    Path(out).write_text(json.dumps(glyphs, ensure_ascii=False, indent=1))
    print(f"{len(glyphs)} glyphs -> {out}")


if __name__ == "__main__":
    main()
