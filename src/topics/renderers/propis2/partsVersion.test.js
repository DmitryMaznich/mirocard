import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { rowPartsOf, pageToLines, PARTS_VERSION } from "./model.js";
import { buildGlyphMap } from "./pageTask.js";
import { letterPieces } from "../../../handwriting/letterParts.js";

// The parts of a copybook letter became its elements (2026-11-20): a row's pick made before counted the letter's strokes. It must not name
// other parts now (б: part 1 was its join to the next letter, it is the stick with the flag now) — the row writes the letter whole; a pick
// made since (v: 2) stands; an old pick stands where the parts are still the strokes (х: its two arcs).
const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs;
const marks = JSON.parse(readFileSync("tools/handwriting/cyrillic/letter_elements.json", "utf-8")).letters;
for (const [ch, m] of Object.entries(marks)) {
  if (!m.strokes || m.composed) continue;
  const g = wide.find((x) => x.label === ch) ?? wide.find((x) => x.aliases?.includes(ch));
  if (g && !g.compose) g.trajectory = { strokes: m.strokes }; // as scripts/build-propis2-deck.mjs does
}
const map = buildGlyphMap({ wide });
const row = (text, parts) => ({ id: "r", kind: "text", text, parts });

describe("row.parts and the elements of the copybook letters", () => {
  it("the marked letters have their elements as parts", () => {
    expect(letterPieces(map.get("п")).length).toBe(2);
    expect(letterPieces(map.get("ж")).length).toBe(3);
    expect(letterPieces(map.get("б")).length).toBe(2);
  });
  it("an old pick (no version) of б is not used: its numbers counted the strokes", () => {
    expect(rowPartsOf(row("б", { of: "б", keep: [1] }), map.get("б"))).toBe(null);
  });
  it("a pick made since (v: 2) is used", () => {
    expect(rowPartsOf(row("б", { of: "б", keep: [1], v: PARTS_VERSION }), map.get("б"))).toEqual([1]);
  });
  it("an old pick stands where the parts are still the strokes (х)", () => {
    expect(rowPartsOf(row("х", { of: "х", keep: [1] }), map.get("х"))).toEqual([1]);
  });
  it("the page line gets the parts mark only for a pick that stands", () => {
    const page = (parts, text = "б") => ({ rows: [row(text, parts)] });
    expect(pageToLines(page({ of: "б", keep: [1] }), map)[0]).not.toMatch(/#p/);
    expect(pageToLines(page({ of: "б", keep: [1], v: PARTS_VERSION }), map)[0]).toMatch(/#p1/);
  });
});
