// All words of tools/propis2/sl-words.json as an animated page (▶ plays the trajectory), docs/propis2-sl.md «Передача».
//   node tools/propis2/sl-review/words-html.cjs <work dir with words.json> <out.html>
// words.json comes from dump.test.jsx.txt. Engine coordinates → band units: x / 0.96, (y − 64) / 0.96 + 100. Polylines (trimmed hooks)
// are thinned (rdp) — at 2.3 MB the page did not open in the app's viewer.
const fs = require("fs");
const [S, OUT] = process.argv.slice(2);
const groups = JSON.parse(fs.readFileSync(S + "/words.json", "utf8"));
const rdp = (P, eps) => { if (P.length < 3) return P; let iM = 0, dM = 0; const [a, b] = [P[0], P[P.length - 1]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > dM) { dM = d; iM = i; } }
  return dM > eps ? [...rdp(P.slice(0, iM + 1), eps).slice(0, -1), ...rdp(P.slice(iM), eps)] : [a, b]; };
const tb = (d) => { const t = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(x / 0.96).toFixed(1)},${((y - 64) / 0.96 + 100).toFixed(1)}`);
  if (/C/.test(t)) return t;
  const P = [...t.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  return "M " + rdp(P, 0.12).map((q) => `${q[0]},${q[1]}`).join(" L "); };
const xsOf = (d) => [...d.matchAll(/(-?\d+(?:\.\d+)?),/g)].map((m) => +m[1]);
let body = "";
for (const g of groups) {
  body += `<section><h2>${g.title}</h2><div class="grid">`;
  for (const w of g.words) {
    const strokes = w.strokes.map((s) => ({ d: tb(s.d), join: s.join }));
    const xs = strokes.flatMap((s) => xsOf(s.d));
    const x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10;
    const vb = `${x0.toFixed(1)} -32 ${(x1 - x0).toFixed(1)} 196`;
    const rul = `<rect x="${x0}" y="50" width="${x1 - x0}" height="50" class="band"/>` + [[0, ""], [50, "dash"], [100, ""], [150, "low"]].map(([y, c]) => `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" class="ln ${c}"/>`).join("");
    body += `<figure class="card"><figcaption><b>${w.w}</b><button class="play">▶</button></figcaption><svg viewBox="${vb}" style="width:${((x1 - x0) * 1.15).toFixed(0)}px">${rul}<g class="ghost">${strokes.map((s) => `<path d="${s.d}"/>`).join("")}</g><g class="ink">${strokes.map((s) => `<path d="${s.d}"${s.join ? ' class="j"' : ""}/>`).join("")}</g><circle class="pen" r="4" cx="-999" cy="-999"/></svg></figure>`;
  }
  body += `</div></section>`;
}
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Словенские слова: соединения</title>
<style>
:root{--bg:#fff;--fg:#1f2328;--muted:#667085;--band:#eef6fb;--line:#9cc9e8;--ink:#1f2328;--ghost:#d0d5dd;--card:#fafbfc;--b:#e4e7ec;--join:#d4380d}
@media (prefers-color-scheme:dark){:root{--bg:#111418;--fg:#e6e8eb;--muted:#98a2b3;--band:#16232d;--line:#3d6b8c;--ink:#e6e8eb;--ghost:#3a4250;--card:#171b21;--b:#2a313b;--join:#ff7a45}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--b);padding:10px 16px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
header h1{font-size:17px;margin:0 8px 0 0}label{display:flex;gap:6px;align-items:center;color:var(--muted)}
button{font:inherit;border:1px solid var(--b);background:var(--card);color:var(--fg);border-radius:8px;padding:4px 12px;cursor:pointer}
section{padding:6px 16px}h2{font-size:15px;margin:14px 0 8px;color:var(--muted)}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.card{margin:0;background:var(--card);border:1px solid var(--b);border-radius:12px;padding:6px 10px}
figcaption{display:flex;gap:10px;align-items:center}figcaption b{font-size:17px}
svg{max-width:100%;height:auto;display:block;cursor:pointer}
.band{fill:var(--band)}.ln{stroke:var(--line);stroke-width:.6}.ln.dash{stroke-dasharray:3 2}.ln.low{opacity:.35}
.ghost path{fill:none;stroke:var(--ghost);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.ink path{fill:none;stroke:var(--ink);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
body.showj .ink path.j{stroke:var(--join)}.pen{fill:#d4380d}
.legend{color:var(--muted);font-size:13px}
</style></head><body>
<header><h1>Словенские слова — соединения</h1><label>Скорость <input id="speed" type="range" min="0.25" max="2" step="0.25" value="1"></label>
<label><input id="showj" type="checkbox"> выделить соединения</label>
<span class="legend">Нажмите на слово — оно пишется так, как его рисует приложение. Пауза — отрыв пера (точки, гачеки, черта t, крючок o, выход f).</span></header>
${body}
<script>
const speedEl=document.getElementById("speed");
document.getElementById("showj").onchange=(e)=>document.body.classList.toggle("showj",e.target.checked);
const running=new WeakMap();
function play(card){
  const paths=[...card.querySelectorAll(".ink path")],pen=card.querySelector(".pen");const token={};running.set(card,token);
  paths.forEach((p)=>{const L=p.getTotalLength();p.style.strokeDasharray=L+" "+L;p.style.strokeDashoffset=L;});
  let i=0,prevEnd=null;
  const next=()=>{if(running.get(card)!==token)return;if(i>=paths.length){pen.setAttribute("cx",-999);return;}
    const p=paths[i],L=p.getTotalLength(),v=110*Number(speedEl.value);const s=p.getPointAtLength(0);
    const lift=prevEnd&&Math.hypot(s.x-prevEnd.x,s.y-prevEnd.y)>2;
    setTimeout(()=>{let t0=null;const step=(ts)=>{if(running.get(card)!==token)return;t0??=ts;const d=Math.min(L,(ts-t0)/1000*v);p.style.strokeDashoffset=L-d;const q=p.getPointAtLength(d);pen.setAttribute("cx",q.x);pen.setAttribute("cy",q.y);
      if(d<L)requestAnimationFrame(step);else{prevEnd=p.getPointAtLength(L);i++;next();}};requestAnimationFrame(step);},lift?350/Number(speedEl.value):0);};
  next();
}
document.querySelectorAll(".card").forEach((c)=>{c.querySelector(".play").onclick=()=>play(c);c.querySelector("svg").onclick=()=>play(c);});
</script></body></html>`;
fs.writeFileSync(OUT, html); console.log((html.length / 1024).toFixed(0) + " KB");
