import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTiles } from "./Propis2Carousel.jsx";

const json = (p) => JSON.parse(readFileSync(p, "utf-8"));
const numbers = json("tools/propis2/element_numbers.json").numbers;

// the deck's element list as build-propis2-deck.mjs makes it
function deckRecord() {
  const topic = json("tools/propis2/topic.json");
  const dropped = new Set(json("tools/propis2/dropped_elements.json").ids);
  const wide = json("tools/propis/wide.json");
  const parts = json("tools/propis2/parts_elements.json");
  return { ...topic, wide: [...wide.glyphs, ...parts.glyphs], elements: json("tools/propis/elements.json").elements.filter((e) => !dropped.has(e.id)), elementNumbers: numbers };
}

describe("stable element numbers", () => {
  it("every element of the deck has a number, numbers are unique whole numbers", () => {
    const tiles = buildTiles(deckRecord()).elements;
    expect(tiles.length).toBeGreaterThan(30);
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

  it("a new element gets the next number after the largest and the old ones keep theirs", () => {
    const rec = deckRecord();
    const before = buildTiles(rec).elements.map((t) => [t.text, t.no]);
    rec.wide = [...rec.wide, { label: "новый-элемент", kind: "element", strokes: [{ d: "M 10 10 L 20 60" }] }];
    const after = buildTiles(rec).elements;
    const max = Math.max(...Object.values(numbers));
    expect(after.at(-1)).toMatchObject({ text: "новый-элемент", no: max + 1 });
    for (const [id, no] of before) expect(after.find((t) => t.text === id).no).toBe(no);
  });
});
