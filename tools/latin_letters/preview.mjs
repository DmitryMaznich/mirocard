// Review stand for a glyph style: every letter pair on the four-line ruling (with start dots and
// stroke numbers) and a plain sample on the notebook cell grid.
// Run: node tools/latin_letters/preview.mjs [style]  → docs/mockups/latin-letters/<style>-glyphs.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const style = process.argv[2] || "print";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const data = JSON.parse(readFileSync(here(`./glyphs/${style}.json`), "utf8"));
const G = data.glyphs;
const GAP = 22;     // between letters of a pair
const PAIR_GAP = 50;
const INK = "#1f3a8a", START = "#15803d", NUM = "#b91c1c", LINE = "#94a3b8";

const firstPoint = (d) => d.match(/-?\d*\.?\d+/g).slice(0, 2).map(Number);

function glyphSvg(ch, x, { marks }) {
  const g = G[ch];
  let out = "";
  g.strokes.forEach((st, i) => {
    out += st.dot
      ? `<circle cx="${x + firstPoint(st.d)[0]}" cy="${firstPoint(st.d)[1]}" r="4.5" fill="${INK}"/>`
      : `<path d="${st.d}" transform="translate(${x},0)" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  if (marks) g.strokes.forEach((st, i) => {
    const [px, py] = firstPoint(st.d);
    out += `<circle cx="${x + px}" cy="${py}" r="5" fill="${START}"/>`;
    out += `<text x="${x + px - 9}" y="${py - 6}" font-size="13" font-family="sans-serif" font-weight="700" fill="${NUM}">${i + 1}</text>`;
  });
  return out;
}

function row(text, { marks = true, grid = false } = {}) {
  let x = 20, body = "";
  for (const ch of text) {
    if (ch === " ") { x += PAIR_GAP; continue; }
    body += glyphSvg(ch, x, { marks });
    x += G[ch].width + GAP;
  }
  const w = x + 20, H = 185, top = 25;
  let bg = "";
  if (grid) {
    for (let gx = 0; gx <= w; gx += 50) bg += `<line x1="${gx}" y1="${-top}" x2="${gx}" y2="${H}" stroke="#bfd3ea" stroke-width="1"/>`;
    for (let gy = 0; gy <= 150; gy += 50) bg += `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="#bfd3ea" stroke-width="1"/>`;
  } else {
    for (const [y, dash] of [[0, ""], [50, "6 5"], [100, ""], [150, ""]])
      bg += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${y === 100 ? "#475569" : LINE}" stroke-width="${y === 100 ? 2 : 1.2}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
  }
  return `<svg viewBox="0 ${-top} ${w} ${H}" width="${w}" height="${H}">${bg}${body}</svg>`;
}

const pairs = Object.keys(G).filter((c) => G[c].case === "upper").map((c) => c + c.toLowerCase());
const rows = [];
for (let i = 0; i < pairs.length; i += 7) rows.push(pairs.slice(i, i + 7).join(" "));

const html = `<!doctype html><meta charset="utf-8"><title>Латиница — ${data.title.ru}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a;background:#fff}
h1{font-size:20px}h2{font-size:15px;margin:26px 0 6px;color:#334155}svg{display:block;margin:4px 0}
p{font-size:13px;color:#475569;max-width:900px}</style>
<h1>Латиница — стиль «${data.title.ru}», черновик глифов на проверку</h1>
<p>Четырёхлинейка: верхняя линия, пунктир — высота строчных, жирная — основная, нижняя — для хвостов (g j p q y).
Полосы равные, по 1 клетке (5 мм). Зелёная точка — начало штриха, красная цифра — порядок.</p>
<h2>Алфавит на четырёхлинейке</h2>
${rows.map((r) => row(r)).join("\n")}
<h2>Те же буквы на клетке (без пометок)</h2>
${rows.slice(0, 2).map((r) => row(r, { marks: false, grid: true })).join("\n")}
<h2>Слова</h2>
${row("cat dog sun", { marks: false })}
${row("I like my bag", { marks: false })}
`;
const outDir = fileURLToPath(new URL("../../docs/mockups/latin-letters/", import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + `${style}-glyphs.html`, html);
console.log("wrote", outDir + `${style}-glyphs.html`);
