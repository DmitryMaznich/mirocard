import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTiles } from "./Propis2Carousel.jsx";
import { layoutWideLinesIntoRows } from "@/topics/renderers/propis/wordEngine.js";
import { NARROW_CELL, snapXFor } from "@/topics/renderers/propis/PrintPageView.jsx";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { ROW_BASE } from "@/topics/renderers/propis2/glyphReach.js";

const json = (p) => JSON.parse(readFileSync(p, "utf-8"));
const numbersFile = json("tools/propis2/element_numbers.json");
const numbers = numbersFile.numbers;

// the deck's element list as build-propis2-deck.mjs makes it
function deckRecord() {
  const topic = json("tools/propis2/topic.json");
  const dropped = new Set(json("tools/propis2/dropped_elements.json").ids);
  const wide = json("tools/propis/wide.json");
  const parts = json("tools/propis2/parts_elements.json");
  return { ...topic, wide: [...wide.glyphs, ...parts.glyphs], elements: json("tools/propis/elements.json").elements.filter((e) => !dropped.has(e.id)), elementNumbers: numbers, elementGroups: numbersFile.groups, elementRetired: numbersFile.retired };
}

describe("stable element numbers", () => {
  it("every element of the deck has a number, numbers are unique whole numbers", () => {
    const tiles = buildTiles(deckRecord()).elements;
    expect(tiles.length).toBeGreaterThan(25);
    for (const t of tiles) expect(numbers[t.text], t.text).toBeGreaterThan(0);
    const nos = Object.values(numbers);
    expect(new Set(nos).size).toBe(nos.length);
    expect(nos.every(Number.isInteger)).toBe(true);
  });

  it("the tile shows the number of the file, the list goes in number order", () => {
    const tiles = buildTiles(deckRecord()).elements;
    expect(tiles.map((t) => t.no)).toEqual([...tiles.map((t) => t.no)].sort((a, b) => a - b));
    expect(tiles.find((t) => t.text === "П-лев").no).toBe(numbers["П-лев"]);
  });

  it("the list is grouped in the file's order and a group's elements go by number; retired numbers are never handed out again", () => {
    const tiles = buildTiles(deckRecord()).elements;
    const titles = [...new Set(tiles.map((t) => t.group))];
    expect(titles).toEqual(numbersFile.groups.map((g) => g.title));
    for (const g of numbersFile.groups) {
      const nos = tiles.filter((t) => t.group === g.title).map((t) => t.no);
      expect(nos).toEqual([...nos].sort((a, b) => a - b));
    }
    const taken = new Set(Object.values(numbers));
    for (const [id, no] of Object.entries(numbersFile.retired)) expect(taken.has(no), `${id} ${no}`).toBe(false);
  });

  it("a new element gets the next number after the largest and the old ones keep theirs", () => {
    const rec = deckRecord();
    const before = buildTiles(rec).elements.map((t) => [t.text, t.no]);
    rec.wide = [...rec.wide, { label: "новый-элемент", kind: "element", strokes: [{ d: "M 10 10 L 20 60" }] }];
    const after = buildTiles(rec).elements;
    const max = Math.max(...Object.values(numbers), ...Object.values(numbersFile.retired));
    expect(after.at(-1)).toMatchObject({ text: "новый-элемент", no: max + 1, group: "Другие" });
    for (const [id, no] of before) expect(after.find((t) => t.text === id).no).toBe(no);
  });
});

describe("elements on the slant grid", () => {
  const rec = deckRecord();
  const map = buildGlyphMap(rec);
  const startOf = (strokes) => strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);

  it("on the page every element starts on a line of the slant grid (narrow and wide ruling, dense grid)", () => {
    for (const [narrow, scale] of [[true, 0.5], [false, 1]]) {
      const snap = snapXFor({ narrowRows: narrow, simpleGrid: "dense", margin: "off", format: "a5", narrow17: narrow });
      for (const t of buildTiles(rec).elements) {
        const { placed } = layoutWideLinesIntoRows([t.text], map, snap, false, scale);
        const [x, y] = startOf(placed[0].segments[0].trajectory.strokes);
        expect(Math.abs(snap(0, x, y) - x), `${t.no} ${t.text} (${narrow ? "narrow" : "wide"})`).toBeLessThan(0.01);
      }
    }
  });

  it("a tile shows the element alone: one stroke per stroke of its glyph, no chain of copies, a closed ear stays closed", () => {
    const glyphs = new Map(rec.wide.map((g) => [g.label, g]));
    for (const t of buildTiles(rec).elements) {
      const g = glyphs.get(t.text);
      if (g) expect(t.strokes.length, `${t.no} ${t.text}`).toBe(g.strokes.length);
    }
    const ear = buildTiles(rec).elements.find((t) => t.text === "Ф-ухо");
    const n = ear.strokes[0].match(/-?\d*\.?\d+/g).map(Number);
    expect([n.at(-2), n.at(-1)]).toEqual([n[0], n[1]].map((v) => expect.closeTo(v, 2)));
  });

  it("the tile draws the slant through the element's start: its start is on a drawn line", () => {
    const tan = 0.46631;
    for (const t of buildTiles(rec).elements) {
      const [x, y] = startOf([{ d: t.strokes[0] }]);
      const k = (x - t.slantX - (ROW_BASE - y) * tan) / NARROW_CELL;
      expect(Math.abs(k - Math.round(k)), `${t.no} ${t.text}`).toBeLessThan(0.01);
    }
  });
});
