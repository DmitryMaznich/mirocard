import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import PrintPageView, { snapXFor } from "@/handwriting/PrintPageView";
import { layoutWideLinesIntoRows } from "@/handwriting/wordEngine";
import { samplePath } from "@/handwriting/pathGeometry";
import { mmToNativeUnits } from "@/handwriting/propisRuling";
import { PRINT_PAPERS } from "@/handwriting/printPapers";
import { buildPageTask, glyphMapOf } from "./pageTask.js";
import { languageView, langStyles } from "./languages.js";
import { deckPapers } from "./model.js";

// The Russian print style «Печатные» (deck 0.7.0, docs/propis2-languages.md «Печатные»): Ilyukhina's capitals from «Печатные буквы» on
// the three papers of that topic — a letter 1 cm tall, every letter starting on a line of the paper's cells, two cells clear between words.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const entry = catalog.decks.find((d) => d.id === "propis2");
const db = await openDb(`test-p2print-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
const deck = await getTopicRecord(db, "propis2");
const view = languageView(deck, "ru", "print");
const map = glyphMapOf(view);

// the letters of a row, each its ink box (row-local): the strokes of the word split by the strokes each letter has
function letterBoxes(line, paper) {
  const snap = snapXFor({ narrowRows: true, simpleGrid: paper, margin: "off", format: "a5", narrow17: true });
  const { placed } = layoutWideLinesIntoRows([`${line}#1`], map, snap, false);
  const out = [];
  const words = line.split(" ");
  placed[0].segments.forEach((seg, wi) => {
    let at = 0;
    for (const ch of words[wi].toUpperCase()) {
      const n = map.get(ch).strokes.length;
      const pts = seg.strokes.slice(at, at + n).flatMap((s) => samplePath(s.d, 60));
      at += n;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      out.push({ ch, word: wi, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
    }
  });
  return { boxes: out, cell: snap.cell };
}

describe("propis2: the Russian print style «Печатные»", () => {
  it("Russian has two styles, the copybook hand first; the print one writes capitals only, on its own three papers", () => {
    expect(langStyles(deck.languages.find((l) => l.id === "ru")).map((st) => [st.id, st.title])).toEqual([["cursive", "Прописные"], ["print", "Печатные"]]);
    expect(deckPapers(view).map((g) => g.id)).toEqual(["print_cell", "print_bigcell", "print_line"]);
    expect(deckPapers(languageView(deck, "ru", "cursive")).map((g) => g.id)).toEqual(["propis", "m1", "m2", "square", "ruled"]);
    expect(map.script).toMatchObject({ joins: false, caps: true });
    // all 33 letters of the alphabet have a print shape
    for (const ch of "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ") expect(map.get(ch)?.sourceLabel).toBe(`print_letters-${ch}`);
  });

  for (const paper of Object.keys(PRINT_PAPERS)) {
    it(`${paper}: every letter 1 cm tall and starting on a line, a letter-cell apart in a word, two cells clear between words`, () => {
      const { boxes, cell } = letterBoxes("мама мыла раму жук", paper);
      const S = cell.size;
      const o = cell.origin(0);
      const H = mmToNativeUnits(10);
      const onLine = (x) => Math.abs(((x - o) / S) - Math.round((x - o) / S)) < 0.02;
      for (const b of boxes) {
        expect([b.ch, onLine(b.minX)]).toEqual([b.ch, true]);
        // the tall strokes (not Ж's, nor Д Щ Ц with their feet: none here) span exactly the letter's height
        expect(b.maxY - b.minY).toBeCloseTo(H, 0);
      }
      for (let i = 1; i < boxes.length; i += 1) {
        const [a, b] = [boxes[i - 1], boxes[i]];
        if (a.word === b.word) expect(b.minX - a.minX).toBeCloseTo(Math.max(H, Math.ceil((a.maxX - a.minX) / S) * S), 0); // one letter-cell
        else expect(b.minX - a.maxX).toBeGreaterThanOrEqual(H - 0.5); // two 5 mm cells clear at least
      }
    });
  }

  it("draws each paper: the 5 mm grid, the 1 cm grid, the ruled rows with the letter's height dashed", () => {
    const svg = (paper) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: view, lines: ["мама"], grid: paper })} bare />);
    expect(svg("print_cell")).toContain('data-simple-grid="print_cell"');
    expect(svg("print_bigcell")).toContain('data-simple-grid="print_bigcell"');
    expect(svg("print_line")).toContain("data-print-row=");
  });
});

describe("propis2: a row writes only some strokes of its letter (row.parts → #p, owner 2026-11-16)", () => {
  const snap = snapXFor({ narrowRows: true, simpleGrid: "print_cell", margin: "off", format: "a5", narrow17: true });
  const row = (line) => layoutWideLinesIntoRows([line], map, snap, true).placed[0];
  const ds = (r) => r.segments.flatMap((sg) => sg.strokes.map((st) => st.d));
  it("the strokes left out are not drawn and get no start dot; the ones written stand exactly where they stand in the whole letter", () => {
    const whole = row("А#r");
    const part = row("А#r#p0.1"); // А: left slant, right slant, bar → no bar
    const n = ds(whole).length / 3; // copies of А in the row
    expect(ds(part).length).toBe(n * 2);
    const keep = ds(whole).filter((_, i) => i % 3 !== 2);
    expect(ds(part)).toEqual(keep);
    const dots = (r) => r.segments.flatMap((sg) => sg.startPoints ?? []).length;
    expect(dots(part)).toBeLessThan(dots(whole));
  });
  it("a row's parts reach the line only while its text is the letter they were picked for", async () => {
    const { pageToLines, newRow } = await import("./model.js");
    const page = { rows: [newRow({ text: "А", parts: { of: "А", keep: [2] } }), newRow({ text: "Б", parts: { of: "А", keep: [2] } })], gridKind: "print_cell" };
    const [a, b] = pageToLines(page, map);
    expect(a).toMatch(/#p2$/);
    expect(b).not.toMatch(/#p/);
  });
});

describe("propis2: the copybook hand has no parts in the app yet (owner, 2026-11-16: the automatic cut needs polishing first)", () => {
  it("и а п are one part each: «Что пишем» offers nothing, the row writes the letter whole", async () => {
    const { letterPieces } = await import("@/handwriting/letterParts.js");
    const cursive = glyphMapOf(languageView(deck, "ru", "cursive"));
    expect([..."иап"].map((ch) => letterPieces(cursive.get(ch)).length)).toEqual([1, 1, 1]);
    // the print letters keep theirs: every stroke a part
    expect(letterPieces(map.get("А")).length).toBe(3);
  });
});

describe("propis2: the parts of a copybook letter (letterParts.js: cut where an element of the method begins; turned on for the review sheet)", () => {
  beforeAll(async () => { (await import("@/handwriting/letterParts.js")).setAutoCuts(true); });
  afterAll(async () => { (await import("@/handwriting/letterParts.js")).setAutoCuts(false); });
  it("и: two sticks rounded at the bottom; а д: the oval, then the stick; п р: the stick, then the arch / hook; т: three; о е с: one", async () => {
    const { letterPieces } = await import("@/handwriting/letterParts.js");
    const cursive = glyphMapOf(languageView(deck, "ru", "cursive"));
    const n = (ch) => letterPieces(cursive.get(ch)).length;
    expect(Object.fromEntries([..."иадпртоесул"].map((ch) => [ch, n(ch)]))).toEqual({ и: 2, а: 2, д: 2, п: 2, р: 2, т: 3, о: 1, е: 1, с: 1, у: 2, л: 2 });
  });
  it("a row of one part of и writes only that stick, in its place", () => {
    const cursive = glyphMapOf(languageView(deck, "ru", "cursive"));
    const snap = snapXFor({ narrowRows: true, simpleGrid: "regular", margin: "off", format: "a5", narrow17: true });
    const lay = (line) => layoutWideLinesIntoRows([line], cursive, snap, false).placed[0].segments.flatMap((sg) => sg.strokes);
    const whole = lay("и#1"), first = lay("и#1#p0"), second = lay("и#1#p1");
    const xs = (strokes) => strokes.flatMap((st) => samplePath(st.d, 2)).map((q) => q[0]);
    expect(first.length).toBe(1);
    expect(second.length).toBe(1);
    // the first stick is the left part of the letter, the second its right part
    expect(Math.max(...xs(first))).toBeLessThan(Math.max(...xs(whole)));
    expect(Math.min(...xs(second))).toBeGreaterThan(Math.min(...xs(whole)));
  });
});
