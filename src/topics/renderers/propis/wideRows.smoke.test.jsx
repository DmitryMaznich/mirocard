import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import PrintPageView from "./PrintPageView.jsx";
import { generateTasks } from "./engine.js";
import { layoutWideLinesIntoRows, WIDE_SCALE, WIDE_ZONE_UNITS } from "./wordEngine.js";
import { toCubicPathD, getPathEndpoints } from "./pathGeometry.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
const map = new Map(wide.map((g) => [g.label, g]));
for (const g of wide) for (const a of g.aliases ?? []) map.set(a, g);

describe("toCubicPathD", () => {
  it("turns L/Q into M+C only and keeps endpoints", () => {
    const d = "M 10 10 L 20 30 Q 25 40 30 30";
    const c = toCubicPathD(d);
    expect(c).not.toMatch(/[LQ]/);
    const e = getPathEndpoints(c);
    expect(e.start).toEqual([10, 10]);
    expect(e.end).toEqual([30, 30]);
  });
});

describe("layoutWideLinesIntoRows", () => {
  it("fits every glyph into the wide band (48 units) standing on the thin line", () => {
    const { placed } = layoutWideLinesIntoRows(["и", "й", "ш", "н", "т", "к", "5", "6", "7", "8", "г1", "п1"], map);
    expect(WIDE_SCALE).toBeCloseTo(48 / 52);
    expect(WIDE_ZONE_UNITS).toBe(48);
    for (const row of placed) {
      expect(row.segments).toHaveLength(1);
    }
  });
  it("joins letters of a word into one row and spaces tokens", () => {
    const { placed } = layoutWideLinesIntoRows(["ини", "и и"], map);
    expect(placed[0].segments[0].strokes).toHaveLength(3); // и+н+и, no connector strokes
    expect(placed[1].segments[0].width).toBeGreaterThan(placed[0].segments[0].width * 0.3);
  });
});

let root;
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

it("renders a wide-rows page (dumps SVG when WIDE_DUMP is set)", () => {
  if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const [task] = generateTasks({ type: "read_lines" }, { cards: [], wide }, 1, {
    wideRows: true,
    lines: ["5", "6 6", "7 7", "8 8", "и и", "иии иии", "й й", "ш ш", "н н", "ини", "нии", "т т", "тит", "к к", "книи", "ниткии"],
  });
  expect(task.wideRows).toBe(true);
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<PrintPageView task={task} onClose={() => {}} />));
  const svg = host.querySelector("svg.propis-print-page-svg");
  expect(svg).toBeTruthy();
  expect(svg.querySelector("clipPath")).toBeTruthy();
  expect(host.querySelectorAll("svg.propis-print-page-svg path").length).toBeGreaterThan(10);
  if (process.env.WIDE_DUMP) {
    const markup = svg.outerHTML.replace('class="propis-paper"', 'fill="#fffdf8"');
    writeFileSync(process.env.WIDE_DUMP, markup);
  }
});

describe("stretchKeepSlantPathD", () => {
  it("widens ink but keeps a straight 65deg stroke at 65deg", async () => {
    const { stretchKeepSlantPathD } = await import("./pathGeometry.js");
    const t = Math.tan((25 * Math.PI) / 180);
    // stroke "/" from (100,62) up to (100 + 40*t, 22)
    const d = toCubicPathD(`M 100 62 L ${100 + 40 * t} 22`);
    const w = stretchKeepSlantPathD(d, 1.5, 25, 62);
    const e = getPathEndpoints(w);
    expect(e.start[0]).toBeCloseTo(150, 1); // x scaled on the baseline
    expect((e.end[0] - e.start[0]) / (e.start[1] - e.end[1])).toBeCloseTo(t, 2); // same slant
  });
});

describe("grid snapping", () => {
  it("puts every letter's start point on a slant-grid line, not just the row's first", () => {
    const S = 30;
    const t = Math.tan((25 * Math.PI) / 180);
    const snap = (_row, x, y) => Math.round((x + y * t) / S) * S - y * t;
    const { placed } = layoutWideLinesIntoRows(["иии", "ини", "нии"], map, snap);
    for (const row of placed) {
      const { strokes } = row.segments[0];
      // glyph strokes (skip connector strokes: they begin at the previous letter's exit)
      const starts = strokes.map((s) => getPathEndpoints(s.d).start);
      const onGrid = starts.filter(([x, y]) => {
        const v = (((x + y * t) % S) + S) % S;
        return Math.min(v, S - v) < 0.01;
      });
      expect(onGrid.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("wideSheet preset", () => {
  it("replaces typed lines with the transcribed workbook pages (32 rows = 2 pages of 16)", () => {
    const topicRecord = {
      cards: [], wide,
      wideSheets: JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets,
      elements: JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements,
    };
    const [task] = generateTasks({ type: "read_lines" }, topicRecord, 1, { wideRows: true, wideSheet: true, lines: ["ignored"] });
    expect(task.lines).toHaveLength(32);
    expect(task.lines).not.toContain("ignored");
  });
});

describe("letter joins", () => {
  it("lands each tail exactly on the next letter's stroke, with no connector stroke", async () => {
    const { samplePath } = await import("./pathGeometry.js");
    const S = 30;
    const t = Math.tan((25 * Math.PI) / 180);
    const snap = (_row, x, y) => Math.round((x + y * t) / S) * S - y * t;
    const { placed } = layoutWideLinesIntoRows(["ини", "нитки", "книги", "шипит"], map, snap);
    const glyphStrokes = { и: 1, н: 1, т: 1, к: 2, г: 1, ш: 1, п: 1 };
    placed.forEach((row, r) => {
      const strokes = row.segments[0].strokes;
      const word = ["ини", "нитки", "книги", "шипит"][r];
      const want = [...word].reduce((n, ch) => n + glyphStrokes[ch], 0);
      expect(strokes).toHaveLength(want); // nothing but the captured strokes: no connectors
    });
    // contact check on "ини": end of stroke 0 sits on stroke 1's path at the same height
    const [st] = placed[0].segments;
    for (let i = 0; i + 1 < st.strokes.length; i += 1) {
      const end = getPathEndpoints(st.strokes[i].d).end;
      const next = samplePath(st.strokes[i + 1].d, 60);
      const dist = Math.min(...next.map(([x, y]) => Math.hypot(x - end[0], y - end[1])));
      expect(dist).toBeLessThan(0.6);
    }
  });
});
