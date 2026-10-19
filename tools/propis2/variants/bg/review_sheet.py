#!/usr/bin/env python3
"""Review sheet without the font file: the capitals as they are in variant.json (what the deck draws) over the real Boyan Maga
letter, one colour per stroke, its number and a dot where it starts, an arrow where it ends. For sessions that have no
Boyan_Maga-Regular.ttf (compare_font.py needs it).

The letter under them is the font's own outline, not a reconstruction: the underlay PNG make_underlays.py rendered from the TTF
(underlays/up_<letter>.png, its grey; the pen-path hint drawn over it is painted out), warped onto the deck's paper exactly where
build_glyphs.stencil_map puts the font (the same stencil the letters are fitted to): paper -> stencil -> bank -> the underlay's
tool geometry (make_underlays.bank_to_tool, its place on the canvas from underlay_dx.json) -> pixel.

  python3 tools/propis2/variants/bg/review_sheet.py <out.png> [letters] [--centre] [--font <Boyan_Maga-Regular.ttf>]
  --font: the outline straight from the TTF instead of the underlay (the same place; the two agree to a pixel's width)
  Next to each letter: the same strokes, plain, as thick as the deck draws them on the Bulgarian paper (INK_W; owner, 2026-10-19:
  «рядом с поправленной буквой эту же букву ... с толщиной линии, которая у нас будет реально использоваться»). --no-ink: without.
  --centre: also the font's centre line (boyan_glyphs.draft.json, what font_letter builds from) as a thin dark line
"""
import sys, json, re
from pathlib import Path
import numpy as np
V = Path(__file__).resolve().parent; sys.path.insert(0, str(V))
import tidy_trace as tt, build_glyphs as bg, make_underlays as mu
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from skimage.morphology import remove_small_holes
TTF = sys.argv[sys.argv.index("--font") + 1] if "--font" in sys.argv else None
args = [a for a in sys.argv[1:] if not a.startswith("--") and a != TTF]
out = args[0]; letters = args[1] if len(args) > 1 else "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЮЯ"
CENTRE = "--centre" in sys.argv
UDX = json.load(open(V / 'underlay_dx.json'))['dx']
INK = "--no-ink" not in sys.argv
AT = json.load(open(V / 'stencil_at.json'))['at'] if (V / 'stencil_at.json').exists() else {}
# the deck's pen on this sheet's paper: PrintPageView draws every stroke 2 page units wide (propisRuling.STROKE_W); on the Bulgarian
# ruling the lowercase is 4.26 mm (PrintPageView BG_X_MM) = 4.26 * 150 / 25 page units, our paper's lowercase 48 units
INK_W = 2 * 48 / (4.26 * 150 / 25)


def font_ink(ch):
    """The underlay's letter as a mask (tool geometry, mu.PX pixels per unit): its grey, and the hint line and start dots drawn
    over it where they lie inside the letter (next to its grey on both sides, or holes in it)."""
    a = np.array(Image.open(V / 'underlays' / f"up_{ch.lower()}.png").convert('RGBA'))
    grey = (a[..., 0] == 90) & (a[..., 1] == 90) & (a[..., 2] == 90) & (a[..., 3] == 255)
    m = grey | ((a[..., 3] > 0) & ndimage.binary_dilation(grey, iterations=6))
    return remove_small_holes(m, max_size=3000)


def font_outline(ch, like, x0, S, CW, CH):
    """--font: the TTF's outline through build_glyphs.stencil_map, filled by the non-zero rule (counters stay open)."""
    import font_glyphs as fg
    from fontTools.ttLib import TTFont
    f = TTFont(TTF); gs = f.getGlyphSet(); pen = fg.Flat(gs); gs[f.getBestCmap()[ord(ch)]].draw(pen)
    fn = bg.stencil_map(ch, like=like)
    wind = np.zeros((CH, CW), int)
    for poly in pen.polys:
        pts = fn(np.array([fg.to_bank(x, y) for x, y in poly]))
        m = Image.new('1', (CW, CH), 0); ImageDraw.Draw(m).polygon([((x - x0) * S, (y + 70) * S) for x, y in pts], fill=1)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, list(poly[1:]) + [poly[0]]))
        wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
    return wind != 0


def font_under(ch, like, x0, S, CW, CH):
    """The real letter on this cell's pixels, set by build_glyphs.stencil_map (an even scale and shift across the slant)."""
    if TTF: return font_outline(ch, like, x0, S, CW, CH)
    fn = bg.stencil_map(ch, like=like)
    b = np.array([[0.0, 0.0], [60.0, 10.0], [20.0, 60.0], [90.0, -40.0]])
    q, u = tt.upright(tt.to_paper(b)), tt.upright(fn(b))
    (sx, dx), (sy, dy) = np.polyfit(q[:, 0], u[:, 0], 1), np.polyfit(q[:, 1], u[:, 1], 1)
    ys, xs = np.mgrid[0:CH, 0:CW]
    p = np.c_[xs.ravel() / S + x0, ys.ravel() / S - 70]
    pu = tt.upright(p)
    bank = tt.to_bank(tt.from_upright(np.c_[(pu[:, 0] - dx) / sx, (pu[:, 1] - dy) / sy]))
    h = (62.0 - bank[:, 1]) / mu.S
    tx, ty = bank[:, 0] - mu.SLANT * (mu.S - 1) * h, 88.0 - h
    ink = font_ink(ch)
    px = np.round((tx + UDX[ch] - 100) * mu.PX).astype(int); py = np.round(ty * mu.PX).astype(int)
    ok = (px >= 0) & (px < ink.shape[1]) & (py >= 0) & (py < ink.shape[0])
    m = np.zeros(len(p), bool); m[ok] = ink[py[ok], px[ok]]
    return m.reshape(CH, CW)
variant = json.load(open(V / 'variant.json')); tt.use_script(variant['meta']['script'])
G = {g['label']: g for g in variant['glyphs']}
S, CW, CH, per = 5, 150*5, 200*5, (min(2, len(letters)) * 2 if INK else min(4, len(letters)))
cells = 2 if INK else 1
rows = (len(letters)*cells+per-1)//per
img = Image.new('RGB', (per*CW, rows*CH), 'white'); dd = ImageDraw.Draw(img)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
sm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
cols = [(200,20,20),(20,80,200),(10,140,50),(170,90,0)]
def cmds_of(d):
    nums = [float(v) for v in re.findall(r'-?\d*\.?\d+(?:[eE][+-]?\d+)?', d)]; out=[]; i=0
    for t in re.findall(r'[MLC]', d):
        k = 1 if t in 'ML' else 3
        out.append((t, [tt.to_paper(np.array([[nums[i+2*j], nums[i+2*j+1]]]))[0] for j in range(k)])); i += 2*k
    return out
def fine(cmds):
    o=[np.asarray(cmds[0][1][0],float)]
    for c,ps in cmds[1:]:
        if c=='L': o.append(ps[0]); continue
        p0=o[-1]
        for t in np.linspace(0,1,41)[1:]: o.append((1-t)**3*p0+3*(1-t)**2*t*ps[0]+3*(1-t)*t**2*ps[1]+t**3*ps[2])
    return np.array(o)
for n,ch in enumerate(letters):
    g = G[ch]; strokes=[fine(cmds_of(s['d'])) for s in g['strokes']]
    body=[p for k,p in enumerate(strokes) if k!=g.get('tailStroke')]
    like = np.vstack(body)
    if ch in AT:  # a snapped letter: the stencil where the build set it (on the letter before the move)
        like = tt.from_upright(np.array([[AT[ch][0], tt.BASE], [AT[ch][1], tt.BASE]]))
    st = bg.font_stencil(ch, like=like)
    x0 = min(min(p[:,0].min() for p in strokes), min(p[:,0].min() for p in st)) - 8
    ox, oy = ((n*cells)%per)*CW, ((n*cells)//per)*CH
    Q = lambda p: (ox+(p[0]-x0)*S, oy+(p[1]+70)*S)
    for y in (tt.BASE, tt.X_TOP, tt.CAP_TOP, tt.BASE+48*tt.SCRIPT.get('lower',1.0)): dd.line([Q((x0,y)),Q((x0+148,y))], fill=(150,180,220), width=2)
    for gx in np.arange(x0-40, x0+190, 15): dd.line([Q((gx,tt.BASE)),Q((gx+(tt.BASE-tt.CAP_TOP)*tt.SLANT_T,tt.CAP_TOP))], fill=(235,205,205), width=1)
    cell = np.array(img.crop((ox, oy, ox + CW, oy + CH))); cell[font_under(ch, like, x0, S, CW, CH)] = (200, 200, 200)
    img.paste(Image.fromarray(cell), (ox, oy)); dd = ImageDraw.Draw(img)
    if CENTRE:
        for p in st: dd.line([Q(q) for q in p], fill=(90, 90, 90), width=2)
    for k,p in enumerate(strokes):
        c=cols[k%4]; dd.line([Q(q) for q in p], fill=c, width=4)
        x,y=Q(p[0]); dd.ellipse([x-8,y-8,x+8,y+8], fill=c); dd.text((x+10,y-30), str(k), fill=c, font=sm)
        # arrow at the end
        a,b=np.array(Q(p[-min(6,len(p))])),np.array(Q(p[-1])); u=(b-a)/max(np.hypot(*(b-a)),1e-6); nrm=np.array([-u[1],u[0]])
        dd.polygon([tuple(b),tuple(b-14*u+7*nrm),tuple(b-14*u-7*nrm)], fill=c)
    dd.text((ox+12,oy+8), ch, fill=(0,0,0), font=font)
    dd.rectangle([ox,oy,ox+CW-1,oy+CH-1], outline=(225,225,225))
    if INK:
        # the same letter as the deck writes it: its pen, round ends and joins, on the ruling only
        ox2 = ox + CW
        R = lambda p: (ox2+(p[0]-x0)*S, oy+(p[1]+70)*S)
        for y in (tt.BASE, tt.X_TOP, tt.CAP_TOP, tt.BASE+48*tt.SCRIPT.get('lower',1.0)): dd.line([R((x0,y)),R((x0+148,y))], fill=(150,180,220), width=2)
        for gx in np.arange(x0-40, x0+190, 15): dd.line([R((gx,tt.BASE)),R((gx+(tt.BASE-tt.CAP_TOP)*tt.SLANT_T,tt.CAP_TOP))], fill=(235,205,205), width=1)
        w = INK_W * S
        for p in strokes:
            pts = [R(q) for q in p]
            dd.line(pts, fill=(40,40,60), width=int(round(w)))
            for x, y in pts: dd.ellipse([x-w/2, y-w/2, x+w/2, y+w/2], fill=(40,40,60))
        dd.text((ox2+12,oy+8), ch, fill=(0,0,0), font=font)
        dd.rectangle([ox2,oy,ox2+CW-1,oy+CH-1], outline=(225,225,225))
img.save(out)
