import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import PrintPageView from "../propis/PrintPageView";
import { buildPageTask } from "./pageTask.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const topicRecord = { ...topic, wide: wide.glyphs, wideSheets: wide.sheets, elements, wideElementRepeat: wide.elementRepeat };

// the first stroke of a word written on the copybook paper (a drawn slant grid), as the app prints it: the numbers of its path
const firstStroke = (word) => {
  const html = renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord, lines: [word], grid: "regular" })} bare />);
  return /\sd="(M[^"]+)"/.exec(html)[1].match(/-?\d*\.?\d+/g).map(Number);
};

describe("the loop of у д з survives a following е ё (2026-10-29)", () => {
  it("the tail of a descender leaves its loop the same way before е and ё as before а", () => {
    // before е ё the connector was rebuilt from the bottom of the loop, which swallowed it: the launch of the last curve (its first control point) changed
    for (const [a, b] of [["зе", "за"], ["зё", "за"], ["уе", "уа"], ["де", "да"]]) {
      const x = firstStroke(a), y = firstStroke(b);
      expect(x.length, `${a} vs ${b}`).toBe(y.length);
      const k = x.length - 6; // the first control point of the last cubic
      expect(Math.hypot(x[k] - y[k], x[k + 1] - y[k + 1]), `${a} vs ${b}`).toBeLessThan(1);
    }
  });
});
