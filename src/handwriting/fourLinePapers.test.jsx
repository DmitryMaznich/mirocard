import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrintPageView, { ownRowsPerPage } from "./PrintPageView.jsx";
import { FOUR_LINE_PAPERS, fourLinePitchMm, isFourLinePaper } from "./fourLinePapers.js";
import { mmToNativeUnits } from "./propisRuling.js";
import { buildPageTask } from "../topics/renderers/propis2/pageTask.js";
import { SLANT_PAPERS, bandFillPaper, deckPapers, ownRowGrid, pageMidDash } from "../topics/renderers/propis2/model.js";

// The four-line papers (docs/latin-letters.md, step 3.2). The Bulgarian one is checked byte for byte by the Bulgarian tests
// (languages.test.jsx, variant.test.jsx); here: the English ones are drawn from the table and offered to nobody yet.
const lineYs = (html, kind) => {
  const g = html.match(new RegExp(`<g data-simple-grid="${kind}">([\\s\\S]*)`))[1];
  return [...g.matchAll(/<line x1="0" y1="([\d.-]+)"[^>]*>/g)].map((m) => ({ y: Number(m[1]), dash: m[0].includes("stroke-dasharray") }));
};
const page = (grid) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: { wide: [] }, lines: [""], grid })} bare />);

describe("four-line papers", () => {
  it("the English ones are four-line papers with rows of their own", () => {
    for (const id of ["bg", "en_gb", "en_us"]) {
      expect(isFourLinePaper(id)).toBe(true);
      expect(ownRowGrid(id)).toBe(true);
    }
    expect(isFourLinePaper("propis")).toBe(false);
    expect(isFourLinePaper("toString")).toBe(false);
  });

  it("rows: as many as fit the page at the paper's pitch", () => {
    for (const [id, p] of Object.entries(FOUR_LINE_PAPERS)) {
      const usable = 210 - p.firstMm - p.upMm - p.xMm - p.downMm - p.footMm; // A5 height after the first row and the foot
      expect(ownRowsPerPage("a5", id)).toBe(Math.floor(usable / fourLinePitchMm(p) + 1e-9) + 1);
    }
  });

  it("British: four lines a row — solid, dashed, dashed, solid — 3.7 / 5 / 3.6 mm, 6 mm between rows; no slant", () => {
    const html = page("en_gb");
    const ys = lineYs(html, "en_gb");
    const rows = ownRowsPerPage("a5", "en_gb");
    expect(ys.length).toBe(4 * rows);
    const mm = (u) => u / mmToNativeUnits(1);
    const [t, x, b, d, t2] = ys;
    expect([t.dash, x.dash, b.dash, d.dash]).toEqual([false, true, true, false]);
    expect(mm(x.y - t.y)).toBeCloseTo(3.7, 5);
    expect(mm(b.y - x.y)).toBeCloseTo(5, 5);
    expect(mm(d.y - b.y)).toBeCloseTo(3.6, 5);
    expect(mm(t2.y - d.y)).toBeCloseTo(6, 5);
  });

  it("American: three equal 5 mm bands, solid top, dashed midline, bold baseline; the next row's top line closes the descenders", () => {
    // the ruling runs edge to edge: the first line drawn may be the tail of a row above the page — sort and walk the lines
    const ys = lineYs(page("en_us"), "en_us").sort((a, b) => a.y - b.y);
    const mm = (u) => u / mmToNativeUnits(1);
    for (let i = 1; i < ys.length; i++) expect(mm(ys[i].y - ys[i - 1].y)).toBeCloseTo(5, 5);
    const dashes = ys.map((l) => (l.dash ? "-" : "|")).join("");
    // every third line is the dashed midline, the two between are solid (top line, baseline)
    for (let i = 0; i + 3 <= dashes.length; i++) expect(dashes.slice(i, i + 3).split("-").length - 1, `${i}: ${dashes}`).toBe(1);
  });

  it("the English papers have no slant, no dash option, and no deck offers them yet", () => {
    expect(SLANT_PAPERS.has("en_gb")).toBe(false);
    expect(SLANT_PAPERS.has("en_us")).toBe(false);
    expect(SLANT_PAPERS.has("bg")).toBe(true);
    expect(pageMidDash({ gridKind: "en_gb" })).toBe(false); // the British midline is a drawn dash already, no extra one
    expect(bandFillPaper({ gridKind: "en_us" })).toBe(true); // «Подсветка» of the x band works on them
    // the Russian deck (no meta.papers) and the Bulgarian one keep their lists
    expect(deckPapers({ meta: {} }).map((p) => p.id)).toEqual(["propis", "m1", "m2", "square", "ruled"]);
    expect(deckPapers({ meta: { papers: ["bg", "square", "ruled"] } }).map((p) => p.id)).toEqual(["bg", "square", "ruled"]);
    expect(deckPapers({ meta: { papers: ["en_gb"] } }).map((p) => p.label)).toEqual(["Английская строка (британская)"]);
  });
});
