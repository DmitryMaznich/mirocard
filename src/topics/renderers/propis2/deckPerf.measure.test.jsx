// A measurement, not a test: how heavy a `propis2` deck is to draw (glyph bank size, SVG size and time of a page). Skipped unless
// P2_MEASURE is set. Compare decks side by side, or one deck before / after a change by pointing P2_ZIP at the other ZIP:
//   P2_MEASURE=1 npx vitest run src/topics/renderers/propis2/deckPerf.measure.test.jsx
//   P2_MEASURE=1 P2_ZIP=propis2_bg=/tmp/new.zip npx vitest run src/topics/renderers/propis2/deckPerf.measure.test.jsx
// Times are of Node + jsdom on this machine: compare them with each other, not with a phone.
import { it } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { renderToStaticMarkup } from "react-dom/server";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildPageTask } from "./pageTask.js";

const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const override = Object.fromEntries((process.env.P2_ZIP ?? "").split(",").filter(Boolean).map((s) => s.split("=")));

async function install(id) {
  const file = override[id] ?? `public/decks/${catalog.decks.find((d) => d.id === id).url.replace("./decks/", "")}`;
  const db = await openDb(`p2-measure-${id}-${Date.now()}`);
  await importTopic(db, await readFile(file), "999.0.0");
  return { rec: await getTopicRecord(db, id), file };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function timeIt(fn, runs = 15) {
  for (let i = 0; i < 2; i++) fn();
  const ts = [];
  for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); ts.push(performance.now() - s); }
  return Math.round(median(ts));
}
const NUM = /-?\d*\.?\d+/g;
const pathNumbers = (html) => [...html.matchAll(/ d="([^"]*)"/g)].reduce((n, m) => n + (m[1].match(NUM)?.length ?? 0), 0);

const SAMPLES = {
  propis2: ["мама мыла раму", "у Шуры шары", "Лена и Нина", "на море волна", "кошка спит"],
  propis2_bg: ["мама мие", "Ана и Нина", "лале на маса", "щъркел и цвете", "Боян пише"],
};

it.skipIf(!process.env.P2_MEASURE)("propis2 deck drawing cost", async () => {
  const ids = (process.env.P2_DECKS ?? "propis2,propis2_bg").split(",");
  const out = [];
  for (const id of ids) {
    const { rec, file } = await install(id);
    const glyphNums = rec.wide.reduce((n, g) => n + (g.strokes ?? []).reduce((k, s) => k + (s.d?.match(NUM)?.length ?? 0), 0), 0);
    out.push(`\n${id}  (${file})\n  glyphs: ${rec.wide.length}, numbers in their paths: ${glyphNums}`);
    const words = SAMPLES[id] ?? SAMPLES.propis2;
    const lines = Array.from({ length: 10 }, (_, i) => words[i % words.length]);
    const lower = rec.meta.alphabet?.lower ?? "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
    const alphabetLines = [lower.slice(0, 11), lower.slice(11, 22), lower.slice(22), lower.toUpperCase().slice(0, 11), lower.toUpperCase().slice(11, 22), lower.toUpperCase().slice(22)];
    for (const grid of [...(rec.meta.papers?.slice(0, 1) ?? []), "square", "ruled"].filter((g, i, a) => a.indexOf(g) === i)) {
      const task = buildPageTask({ topicRecord: rec, lines, grid });
      const html = renderToStaticMarkup(<PrintPageView task={task} bare />);
      const page = timeIt(() => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines, grid })} bare />));
      let k = 0;
      const typed = timeIt(() => { const l = [...lines]; l[4] += " " + words[k++ % words.length]; renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines: l, grid })} bare />); });
      const abc = timeIt(() => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines: alphabetLines, grid })} bare />));
      out.push(`  ${grid.padEnd(8)} page ${String(page).padStart(4)} ms | typing ${String(typed).padStart(4)} ms | alphabet page ${String(abc).padStart(4)} ms | SVG ${Math.round(html.length / 1024)} KB, ${pathNumbers(html)} numbers`);
    }
  }
  process.stderr.write(out.join("\n") + "\n");
}, 600000);
