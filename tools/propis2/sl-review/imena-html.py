"""Names from the owner's sheet «IMENA» next to ours (docs/propis2-sl.md, «Передача»): a crop of the sheet / ours / ours laid over it.

  python3 -I tools/propis2/sl-review/imena-html.py <work dir with names.json> <IMENA.pdf>   → <work dir>/imena.html

names.json comes from dump.test.jsx.txt. The sheet is not in the repo, and neither is the page (it carries the sheet's pictures).
Geometry measured 2026-11-13 at 600 dpi: the scan is tilted 44 px per 3420 px (levelled here); baselines BASES, x-height XH.
Engine coordinates → band units: x / 0.96, (y − 64) / 0.96 + 100 (engine baseline 64, x-height 48 units).
"""
import json, re, base64, io, sys, math, subprocess, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
S = sys.argv[1]
tmp = Path(tempfile.mkdtemp())
subprocess.run(["pdftoppm", "-r", "600", "-gray", "-png", sys.argv[2], str(tmp / "p")], check=True)
page = Image.open(next(tmp.glob("p-*.png"))).convert("L")
page = page.rotate(math.degrees(math.atan(44 / 3420)), resample=Image.BICUBIC, fillcolor=255, center=(2400, 3500))
im = np.array(page).astype(float)
BASES = [1223, 1692, 2159, 2626, 3095, 3563, 4030, 4498, 4966, 5434]
XH = 118.5
LINES = [b + k * XH for b in BASES for k in (-2, -1, 0, 1)]
ink = np.clip((200 - im) / 120, 0, 1)
clean = ink.copy()
for y in LINES:
    for r in range(int(y) - 10, int(y) + 11):
        keep = (ink[r - 14] > 0.4) | (ink[r + 14] > 0.4)
        clean[r] = np.where(keep, ink[r], 0)
names = json.load(open(f"{S}/names.json"))
order = ["Izak","Miha","Enea","Lara","Adela","Žan","Mark","Jakob","Bor","Tanja","David","Janina","Ula","Primož","Ažbe","Angelina","Leja","Luka","Julija"]
PXH = 46  # x-height on screen, px
Y0, Y1 = -20, 160  # band range shown
def crop(i):
    col, row = (0, i) if i < 10 else (1, i - 10)
    base = BASES[row]
    xa, xb = (740, 2150) if col == 0 else (2320, 4500)
    ya, yb = int(base + (Y0 - 100) * XH / 50), int(base + (Y1 - 100) * XH / 50)
    rows = [r for c in (base - XH / 2, base - 1.5 * XH) for r in range(int(c - 25), int(c + 25))]
    cols = np.where((ink[rows, xa:xb] > 0.5).any(0))[0]
    x0, x1 = xa + cols[0] - 30, xa + cols[-1] + 30
    g = Image.fromarray(im[ya:yb, x0:x1].astype(np.uint8))
    k = PXH / XH
    g = g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS)
    buf = io.BytesIO(); g.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode(), g.width, g.height
def rdp(P, eps=0.12):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; L = ((b[0]-a[0])**2 + (b[1]-a[1])**2) ** 0.5 or 1
    dm, im_ = 0, 0
    for i in range(1, len(P) - 1):
        d = abs((b[0]-a[0])*(a[1]-P[i][1]) - (a[0]-P[i][0])*(b[1]-a[1])) / L
        if d > dm: dm, im_ = d, i
    return rdp(P[:im_+1], eps)[:-1] + rdp(P[im_:], eps) if dm > eps else [a, b]
def tb(d):
    t = tb0(d)
    if "C" in t: return t
    P = [(float(x), float(y)) for x, y in re.findall(r"(-?[\d.]+),(-?[\d.]+)", t)]
    return "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in rdp(P))
def tb0(d):
    return re.sub(r"(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)", lambda m: f"{float(m.group(1))/0.96:.1f},{(float(m.group(2))-64)/0.96+100:.1f}", d)
cards = ""
for i, w in enumerate(order):
    b64, cw, ch = crop(i)
    st = next(n for n in names if n["w"] == w)["strokes"]
    ds = [tb(s["d"]) for s in st]
    xs = [float(m) for d in ds for m in re.findall(r"(-?\d+\.\d),", d)]
    x0, x1 = min(xs) - 30 * 50 / XH, max(xs) + 30 * 50 / XH
    k = PXH / 50
    sw, sh = (x1 - x0) * k, (Y1 - Y0) * k
    lines = "".join(f'<line x1="{x0:.1f}" x2="{x1:.1f}" y1="{y}" y2="{y}" class="ln{" d" if y == 50 else ""}"/>' for y in (0, 50, 100, 150))
    paths = "".join(f'<path d="{d}"{' class="j"' if s["join"] else ""}/>' for d, s in zip(ds, st))
    svg = f'<svg viewBox="{x0:.1f} {Y0} {x1-x0:.1f} {Y1-Y0}" width="{sw:.0f}" height="{sh:.0f}">{lines}<g class="ink">{paths}</g></svg>'
    cards += f'''<figure class="card"><figcaption>{w}</figcaption>
<div class="pair"><div class="lbl">лист</div><div class="stack"><img src="data:image/png;base64,{b64}" width="{cw}" height="{ch}" alt="{w} — лист"><div class="ov">{svg}</div></div>
<div class="lbl">наше</div><div class="ours">{svg}</div></div></figure>'''
html = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Имена: лист и наше</title><style>
:root{{--bg:#fff;--fg:#1f2328;--muted:#667085;--card:#fafbfc;--b:#e4e7ec;--ink:#1d4ed8;--ln:#9cc9e8;--join:#d4380d}}
@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{--bg:#111418;--fg:#e6e8eb;--muted:#98a2b3;--card:#171b21;--b:#2a313b;--ink:#7aa2ff;--ln:#3d6b8c;--join:#ff7a45}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif}}
header{{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--b);padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}}
h1{{font-size:17px;margin:0}}label{{color:var(--muted);display:flex;gap:6px;align-items:center}}p.note{{margin:0;color:var(--muted);font-size:13px;flex-basis:100%}}
main{{padding:12px 16px;display:flex;flex-wrap:wrap;gap:12px}}
.card{{margin:0;background:var(--card);border:1px solid var(--b);border-radius:12px;padding:8px 12px;max-width:100%;overflow-x:auto}}
figcaption{{font-weight:600;margin-bottom:4px}}
.pair{{display:grid;grid-template-columns:auto auto;gap:2px 10px;align-items:center}}.lbl{{color:var(--muted);font-size:12px}}
.stack{{position:relative;background:#fff;border-radius:6px}}.stack img{{display:block}}
.ov{{position:absolute;left:0;top:0;display:none;opacity:.75}}body.overlay .ov{{display:block}}
svg{{display:block}}.ln{{stroke:var(--ln);stroke-width:.6}}.ln.d{{stroke-dasharray:3 3}}
.ink path{{fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}}
body.joins .ink path.j{{stroke:var(--join)}}.ov .ln{{display:none}}
</style></head><body><header><h1>Имена: лист «IMENA» и наше</h1>
<label><input type="checkbox" id="ov"> наложить наше на лист</label><label><input type="checkbox" id="jn"> выделить соединения</label>
<p class="note">Одинаковый масштаб: высота строчной буквы одна и та же. При наложении наше слово выровнено по основной линии и по левому краю (на 30 точек листа от первой буквы) — сдвиг по ширине показывает разницу в ширине букв.</p></header>
<main>{cards}</main>
<script>document.getElementById('ov').onchange=e=>document.body.classList.toggle('overlay',e.target.checked);document.getElementById('jn').onchange=e=>document.body.classList.toggle('joins',e.target.checked);</script>
</body></html>'''
open(f"{S}/imena.html", "w").write(html)
print(len(html)//1024, "KB")
