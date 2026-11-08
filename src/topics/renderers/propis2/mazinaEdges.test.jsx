import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import PrintPageView from "@/handwriting/PrintPageView";
import { buildPageTask } from "./pageTask.js";

// The ruling runs to every edge of the sheet (owner, 2026-11-05: on an A4 PDF the grid had a white strip at the top / the bottom): the cycle
// goes on above the first row and below the last one, the slants cover the whole sheet. A printer leaves out what it cannot reach by itself.
const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const rec = { ...topic, wide: wide.glyphs, wideSheets: wide.sheets, elements: [], wideElementRepeat: wide.elementRepeat };
const MM = 6; // native units per mm

const svgOf = (grid, format) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines: ["мама#1"], grid, narrowRows: true, format })} bare />);
const attr = (tag, name) => Number(new RegExp(`${name}="(-?[\\d.]+)"`).exec(tag)?.[1]);

describe("the printed ruling reaches the edges of the sheet", () => {
  for (const grid of ["m1", "m2", "bg", "ruled"]) {
    for (const format of ["a4", "a5"]) {
      it(`${grid} on ${format}: a horizontal line within 8 mm of the top and of the bottom`, () => {
        const html = svgOf(grid, format);
        const h = format === "a4" ? 297 * MM : 210 * MM;
        const ys = [...html.matchAll(/<line [^>]*>/g)].map((m) => m[0]).filter((t) => attr(t, "x1") === 0 && attr(t, "y1") === attr(t, "y2")).map((t) => attr(t, "y1"));
        expect(ys.length).toBeGreaterThan(10);
        expect(Math.min(...ys)).toBeLessThan(8 * MM);
        expect(h - Math.max(...ys)).toBeLessThan(8 * MM);
      });
    }
  }
  it("the slants of the Mazina steps run from the top edge to the bottom edge", () => {
    for (const grid of ["m1", "m2"]) {
      const html = svgOf(grid, "a4");
      const slants = [...html.matchAll(/<line [^>]*>/g)].map((m) => m[0]).filter((t) => attr(t, "y1") !== attr(t, "y2"));
      expect(slants.length).toBeGreaterThan(20);
      expect(Math.min(...slants.map((t) => Math.min(attr(t, "y1"), attr(t, "y2"))))).toBeCloseTo(0, 3);
      expect(Math.max(...slants.map((t) => Math.max(attr(t, "y1"), attr(t, "y2"))))).toBeCloseTo(297 * MM, 3);
    }
  });
});
