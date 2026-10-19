#!/usr/bin/env python3
"""Review sheet without the font file: the capitals as they are in variant.json (what the deck draws) over the font's centre line
(boyan_glyphs.draft.json through build_glyphs.font_stencil, thick grey), one colour per stroke, its number and a dot where it
starts, an arrow where it ends. For sessions that have no Boyan_Maga-Regular.ttf (compare_font.py needs it for the outline).

  python3 tools/propis2/variants/bg/review_sheet.py <out.png> [letters]     # default: every capital
"""
import sys, json, re
from pathlib import Path
import numpy as np
V = Path(__file__).resolve().parent; sys.path.insert(0, str(V))
import tidy_trace as tt, build_glyphs as bg
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; letters = sys.argv[2] if len(sys.argv) > 2 else "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЮЯ"
variant = json.load(open(V / 'variant.json')); tt.use_script(variant['meta']['script'])
G = {g['label']: g for g in variant['glyphs']}
S, CW, CH, per = 5, 150*5, 200*5, min(4, len(letters))
rows = (len(letters)+per-1)//per
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
    st = bg.font_stencil(ch, like=np.vstack(body))
    x0 = min(min(p[:,0].min() for p in strokes), min(p[:,0].min() for p in st)) - 8
    ox, oy = (n%per)*CW, (n//per)*CH
    Q = lambda p: (ox+(p[0]-x0)*S, oy+(p[1]+70)*S)
    for y in (tt.BASE, tt.X_TOP, tt.CAP_TOP, tt.BASE+48*tt.SCRIPT.get('lower',1.0)): dd.line([Q((x0,y)),Q((x0+148,y))], fill=(150,180,220), width=2)
    for gx in np.arange(x0-40, x0+190, 15): dd.line([Q((gx,tt.BASE)),Q((gx+(tt.BASE-tt.CAP_TOP)*tt.SLANT_T,tt.CAP_TOP))], fill=(235,205,205), width=1)
    for p in st: dd.line([Q(q) for q in p], fill=(170,170,170), width=14)
    for k,p in enumerate(strokes):
        c=cols[k%4]; dd.line([Q(q) for q in p], fill=c, width=4)
        x,y=Q(p[0]); dd.ellipse([x-8,y-8,x+8,y+8], fill=c); dd.text((x+10,y-30), str(k), fill=c, font=sm)
        # arrow at the end
        a,b=np.array(Q(p[-min(6,len(p))])),np.array(Q(p[-1])); u=(b-a)/max(np.hypot(*(b-a)),1e-6); nrm=np.array([-u[1],u[0]])
        dd.polygon([tuple(b),tuple(b-14*u+7*nrm),tuple(b-14*u-7*nrm)], fill=c)
    dd.text((ox+12,oy+8), ch, fill=(0,0,0), font=font)
    dd.rectangle([ox,oy,ox+CW-1,oy+CH-1], outline=(225,225,225))
img.save(out)
