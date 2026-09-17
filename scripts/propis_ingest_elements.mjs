// One-off ingestion script for pre-letter handwriting elements (палочки, крючки, петли,
// овалы...) captured via tools/letter_capture/handwriting_capture.html with Тип = "Элемент".
//
// Usage:
//   node scripts/propis_ingest_elements.mjs <capture-export.json>
//
// The capture tool's "Экспорт набора" button downloads ONE JSON file containing everything
// in the artist's collection (letters + elements + connectors mixed, distinguished by their
// own `type` field) — this script only picks out `type === "element"` entries, ignores the
// rest, and merges them into tools/propis/elements.json by `id`.
//
// Source reference for the elements below: Н.С. Жукова, «Пропись 1» (из комплекта
// «Прописи», 3 части), стр. 5–11 — see the reference sheet cut from that PDF this session.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { samplePath, transformPathD } from "../src/topics/renderers/propis/pathGeometry.js";

const VB_H = 150; // matches handwriting_capture.html's VB_H / propis's shared row height
const PAD = 4; // horizontal breathing room so stroke-width doesn't clip at the viewBox edge

// The element inventory, in the order they're introduced in the source book. `category`
// ("02" originally bundled three distinct drills -- long diagonal, short diagonal, and a
// vertical stroke -- under one slug/crop; split into 02a/02b/02c 2026-09-17 per user report.)
// is a loose grouping for future UI/filtering — not load-bearing anywhere yet.
//
// The `_uzkaya` (narrow-ruling) entries below are NOT in the source book -- the book only
// ever shows one height per drill for these (confirmed by direct pixel measurement of the
// scan, 2026-09-17: 01/03/04/05's two printed rows are identical height, just practice
// repeats). The user captured a second, deliberately half-height trace of 03/04/05/06 anyway
// (own initiative, via the now-free-text element field) for use in the app at a narrower
// ruling than the book itself uses -- confirmed these really are ~half the height of their
// full-size sibling (measured, not assumed) before adding the slugs, so they're a real
// distinct capture, not a duplicate.
const REGISTRY = {
  "01_pryamaya_liniya":          { labelRu: "Прямая линия",              category: "base_stroke", sourcePage: 5 },
  "02a_naklonnaya_dlinnaya":     { labelRu: "Наклонная длинная",         category: "base_stroke", sourcePage: 5 },
  "02b_naklonnaya_korotkaya":    { labelRu: "Наклонная короткая",        category: "base_stroke", sourcePage: 5 },
  "02c_vertikalnaya":            { labelRu: "Вертикальная",              category: "base_stroke", sourcePage: 5 },
  "03_zaborchik_ploskie":        { labelRu: "Заборчик плоские",          category: "base_stroke", sourcePage: 5 },
  "03_zaborchik_ploskie_uzkaya": { labelRu: "Заборчик плоские (узкая)",  category: "base_stroke", sourcePage: 5 },
  "04_zaborchik_ostrye":         { labelRu: "Заборчик острые",           category: "base_stroke", sourcePage: 6 },
  "04_zaborchik_ostrye_uzkaya":  { labelRu: "Заборчик острые (узкая)",   category: "base_stroke", sourcePage: 6 },
  "05_kryuchok_vlevo":           { labelRu: "Крючок влево",              category: "base_stroke", sourcePage: 6 },
  "05_kryuchok_vlevo_uzkaya":    { labelRu: "Крючок влево (узкая)",      category: "base_stroke", sourcePage: 6 },
  "06_kryuchok_vpravo":          { labelRu: "Крючок вправо",             category: "base_stroke", sourcePage: 6 },
  "06_kryuchok_vpravo_uzkaya":   { labelRu: "Крючок вправо (узкая)",     category: "base_stroke", sourcePage: 6 },
  "07a_soedinenie_kryuchkov_1":  { labelRu: "Соединение крючков (1)",    category: "connector_drill", sourcePage: 7 },
  "07b_soedinenie_kryuchkov_2":  { labelRu: "Соединение крючков (2)",    category: "connector_drill", sourcePage: 7 },
  "08_chervyachok":              { labelRu: "Червячок",                  category: "wave", sourcePage: 7 },
  "09_zmeyka":                   { labelRu: "Змейка",                    category: "wave", sourcePage: 8 },
  "10_oval_s_hvostikom":         { labelRu: "Овал с хвостиком",          category: "oval", sourcePage: 8 },
  "11_tsepochka_ovalov":         { labelRu: "Цепочка овалов",            category: "oval", sourcePage: 8 },
  "12_petelka_vnizu":            { labelRu: "Петелька внизу",            category: "loop", sourcePage: 9 },
  "13_petelka_vverhu":           { labelRu: "Петелька вверху",           category: "loop", sourcePage: 9 },
  "14_petelka_s_kruzhochkom":    { labelRu: "Петелька с кружочком",      category: "loop", sourcePage: 9 },
  "15_kryuchok_vverh":           { labelRu: "Крючок вверх",              category: "base_stroke", sourcePage: 10 },
  "16_poluoval_vpravo":          { labelRu: "Полуовал вправо",           category: "half_oval", sourcePage: 10 },
  "17_poluoval_vlevo":           { labelRu: "Полуовал влево",            category: "half_oval", sourcePage: 10 },
  "18_poluovaly_spinkami":       { labelRu: "Полуовалы спинками",        category: "half_oval", sourcePage: 11 },
  "19_petelka_s_nosikom":        { labelRu: "Петелька с носиком",        category: "loop", sourcePage: 11 },
  "20_kryuchok_s_petelkoy":      { labelRu: "Крючок с петелькой",        category: "loop", sourcePage: 11 },
};

const ELEMENTS_PATH = "tools/propis/elements.json";
const SOURCE_LABEL = "Н.С. Жукова, «Пропись 1» (комплект из 3 частей), стр. 5–11";

function bboxOf(strokes) {
  let minX = Infinity, maxX = -Infinity;
  for (const s of strokes) {
    for (const [x] of samplePath(s.d)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  return { minX, maxX };
}

function normalize(strokes) {
  const { minX, maxX } = bboxOf(strokes);
  const translateX = -minX + PAD;
  const width = Math.ceil(maxX - minX) + PAD * 2;
  const normalizedStrokes = strokes.map((s) => ({
    d: transformPathD(s.d, { translateX }),
  }));
  return { strokes: normalizedStrokes, viewBox: `0 0 ${width} ${VB_H}` };
}

function loadElementsFile() {
  if (!existsSync(ELEMENTS_PATH)) {
    return { meta: { source: SOURCE_LABEL }, elements: [] };
  }
  return JSON.parse(readFileSync(ELEMENTS_PATH, "utf-8"));
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node scripts/propis_ingest_elements.mjs <capture-export.json>");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
  const captured = raw.filter((item) => item.type === "element");
  if (captured.length === 0) {
    console.log("No type===\"element\" entries found in this export — nothing to do.");
    return;
  }

  const file = loadElementsFile();
  const byId = new Map(file.elements.map((el) => [el.id, el]));

  let added = 0, updated = 0, skipped = 0;
  for (const item of captured) {
    const id = item.label?.trim();
    const known = REGISTRY[id];
    if (!known) {
      console.warn(`⚠ Skipping unknown element id "${id}" — not in REGISTRY. Typo? Add it to the script first.`);
      skipped += 1;
      continue;
    }
    const { strokes, viewBox } = normalize(item.strokes);
    const record = {
      id,
      labelRu: known.labelRu,
      category: known.category,
      sourcePage: known.sourcePage,
      viewBox,
      strokes,
      meta: item.meta ?? {},
    };
    if (byId.has(id)) updated += 1; else added += 1;
    byId.set(id, record);
  }

  file.elements = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  file.meta = { source: SOURCE_LABEL, updatedAt: new Date().toISOString() };
  writeFileSync(ELEMENTS_PATH, JSON.stringify(file, null, 2) + "\n");

  const total = Object.keys(REGISTRY).length;
  const have = file.elements.length;
  console.log(`✓ ${ELEMENTS_PATH}: +${added} new, ~${updated} updated, ${skipped} skipped.`);
  console.log(`  Progress: ${have}/${total} elements captured.`);
  if (have < total) {
    const missing = Object.keys(REGISTRY).filter((id) => !byId.has(id));
    console.log(`  Still missing: ${missing.join(", ")}`);
  }
}

main();
