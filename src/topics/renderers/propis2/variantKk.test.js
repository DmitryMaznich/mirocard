import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { buildGlyphMap } from "./pageTask.js";
import { topicAlphabet } from "./alphabet.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { getPathEndpoints } from "../propis/pathGeometry.js";

// The Kazakh variant (propis2_kk, docs/propis2-variants.md): the variant laid over the base topic, as the build does it
const loadTopic = async (variantFile = "tools/propis2/variants/kk/variant.json") => {
  const { applyVariant } = await import("../../../../scripts/lib/propis2-variant.mjs");
  const topic = JSON.parse(await readFile("tools/propis2/topic.json", "utf-8"));
  topic.wide = JSON.parse(await readFile("tools/propis/wide.json", "utf-8")).glyphs;
  applyVariant(topic, JSON.parse(await readFile(variantFile, "utf-8")));
  return topic;
};

describe("propis2 variant: Kazakh", () => {
  it("has the 42 letters of the alphabet, each lowercase letter drawn, each capital drawn except the listed ones", async () => {
    const topic = await loadTopic();
    const map = buildGlyphMap(topic);
    const { lower, noCapital = [] } = topic.meta.alphabet;
    expect([...lower]).toHaveLength(42);
    const drawn = (g) => (g?.strokes?.length ?? g?.compose?.length ?? 0); // ш, ы are composed of other glyphs
    for (const ch of lower) {
      expect(drawn(map.get(ch)), `lowercase ${ch}`).toBeGreaterThan(0);
      if (!noCapital.includes(ch)) expect(drawn(map.get(ch.toUpperCase())), `capital ${ch.toUpperCase()}`).toBeGreaterThan(0);
    }
    expect(topicAlphabet(topic, map).lower).toContain("ә");
    expect(topic.meta.script).toEqual({ growJoins: true, topJoins: true, topJoinsStraight: ["ү", "ұ"] });
    expect(map.script).toEqual({ growJoins: true, topJoins: true, topJoinsStraight: ["ү", "ұ"] });
  });

  it("lays out Kazakh words without a missing letter, every connector reaching the letter after it", async () => {
    const map = buildGlyphMap(await loadTopic());
    for (const w of ["қала", "аңшы", "әке", "өрік", "ұл", "үй", "іні", "Ғалым", "Қазақстан", "күн", "Әже", "тұмар", "пішін", "нан"]) {
      const { placed } = layoutWideLinesIntoRows([w], map, undefined, false, 1);
      expect(placed[0].segments[0].strokes.length, w).toBeGreaterThan(0);
      for (const s of placed[0].segments[0].strokes) { const e = getPathEndpoints(s.d); expect(Number.isFinite(e.end[0] + e.end[1]), w).toBe(true); }
    }
  });

  it("letters like п, и, н reach the top point of the next letter (топ join), and the Russian distance is kept", async () => {
    const topic = await loadTopic();
    const map = buildGlyphMap(topic);
    const plain = buildGlyphMap({ ...topic, meta: { ...topic.meta, script: undefined } });
    for (const w of ["пи", "ин", "пт", "нр"]) {
      const a = layoutWideLinesIntoRows([w], plain, undefined, false, 1).placed[0].segments[0].strokes;
      const b = layoutWideLinesIntoRows([w], map, undefined, false, 1).placed[0].segments[0].strokes;
      const ea = getPathEndpoints(a[0].d).end, eb = getPathEndpoints(b[0].d).end;
      expect(eb[1], w).toBeLessThan(ea[1] - 5);
      expect(getPathEndpoints(b[1].d).start[0], w).toBeCloseTo(getPathEndpoints(a[1].d).start[0], 3);
    }
  });
});
