import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import PrintPageView from "./PrintPageView.jsx";
import { generateTasks } from "./engine.js";
import { layoutWideLinesIntoRows, WIDE_SCALE, WIDE_ZONE_UNITS } from "./wordEngine.js";
import { toCubicPathD, getPathEndpoints, samplePath } from "./pathGeometry.js";

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
    const { placed } = layoutWideLinesIntoRows(["ини", "и и"], map, undefined, false);
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
  expect(svg.querySelector("g[data-wide-band]")).toBeTruthy();
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
    const { placed } = layoutWideLinesIntoRows(["иии", "ини", "нии"], map, snap, false);
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
    const { placed } = layoutWideLinesIntoRows(["ини", "нитки", "книги", "шипит"], map, snap, false);
    const glyphStrokes = { и: 1, н: 1, т: 1, к: 2, г: 1, ш: 3, п: 1 };
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

describe("pen animation", () => {
  it("adds a continuous transition (contact -> next start) before every joined letter's stroke", () => {
    const { placed } = layoutWideLinesIntoRows(["ш", "ин", "и и"], map, undefined, false);
    const w = placed[0].segments[0];
    // ш = three hooks: hook, transition, hook, transition, hook
    expect(w.strokes).toHaveLength(3);
    expect(w.trajectory.strokes).toHaveLength(5);
    expect(w.trajectory.strokes.map((s) => !!s.continuous)).toEqual([false, true, true, true, true]);
    const [h1, tr, h2] = w.trajectory.strokes;
    expect(getPathEndpoints(tr.d).start[0]).toBeCloseTo(getPathEndpoints(h1.d).end[0], 2);
    expect(getPathEndpoints(tr.d).end[0]).toBeCloseTo(getPathEndpoints(h2.d).start[0], 2);
    // separate tokens ("и и"): the pen lifts, no transition between them
    expect(placed[2].segments[0].trajectory.strokes.every((s) => !s.continuous)).toBe(true);
  });
});

it("tap on a wide row plays the pen animation", () => {
  // jsdom has no SVG path measuring -- stubs are enough, only the DOM structure is asserted.
  SVGElement.prototype.getTotalLength ??= () => 100;
  SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const [task] = generateTasks({ type: "read_lines" }, { cards: [], wide }, 1, { wideRows: true, lines: ["ш"] });
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<PrintPageView task={task} onClose={() => {}} />));
  expect(host.querySelector("[data-pr-anim]")).toBeNull();
  act(() => host.querySelector(".propis-text-word-hit").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(host.querySelectorAll("[data-pr-anim]").length).toBeGreaterThanOrEqual(5);
});

describe("repeat pitch (cells between the starts of copies, from the workbook photos)", () => {
  const S = 30;
  const t = Math.tan((25 * Math.PI) / 180);
  const snap = (_row, x, y) => Math.round((x + y * t) / S) * S - y * t;
  const startsOf = (word) => {
    const { placed } = layoutWideLinesIntoRows([word], map, snap, false);
    return placed[0].segments[0].strokes.map((s) => getPathEndpoints(s.d).start[0]);
  };
  const table = { "5 5": 2, "6 6": 2, "8 8": 2, "| |": 1, "г1 г1": 3, "п1 п1": 3, "и и": 3, "й й": 3, "н н": 3, "к к": 3, "ш ш": 4, "т т": 4 };
  for (const [word, cells] of Object.entries(table)) {
    it(`"${word}" copies start ${cells} cell(s) apart`, () => {
      const starts = startsOf(word); // both copies have the same strokes, so the 2nd copy starts at the middle
      const half = starts.length / 2;
      expect(Number.isInteger(half)).toBe(true);
      expect((starts[half] - starts[0]) / S).toBeCloseTo(cells, 3);
    });
  }
});

describe("per-band slant grid", () => {
  it("first slant meets each band's bottom/top line at the same x in every row; glyph starts sit on those slants", () => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const [task] = generateTasks({ type: "read_lines" }, { cards: [], wide }, 1, { wideRows: true, lines: ["5 5", "6 6", "ш ш", "н н", "и и", "ини", "к к", "т т"] });
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<PrintPageView task={task} onClose={() => {}} />));
    const svg = host.querySelector("svg.propis-print-page-svg");
    const bands = [...svg.querySelectorAll("g[data-wide-band]")];
    expect(bands.length).toBe(16);
    const firstX = (band, attr) => Math.min(...[...band.querySelectorAll("line")].map((l) => +l.getAttribute(attr)).filter((x) => x >= 0));
    const bottoms = bands.map((b) => firstX(b, "x2"));
    const tops = bands.map((b) => firstX(b, "x1"));
    for (const x of bottoms) expect(x).toBeCloseTo(bottoms[0], 3);
    for (const x of tops) expect(x).toBeCloseTo(tops[0], 3);
    expect(bottoms[0]).toBeLessThan(30); // within one cell of the left edge
    // every row's first stroke starts on a slant of ITS band
    const S = 30;
    const tan = Math.tan((25 * Math.PI) / 180);
    const rows = [...svg.querySelectorAll(":scope > g[transform^='translate']")];
    expect(rows.length).toBe(8);
    for (const g of rows) {
      const [, tx, ty] = g.getAttribute("transform").match(/translate\(([\d.-]+) ([\d.-]+)\)/).map(Number);
      const d = g.querySelector("path").getAttribute("d");
      const [x, y] = d.match(/-?\d+\.?\d*/g).map(Number);
      const rel = (tx + x - bottoms[0] - (64 - y) * tan) / S; // slants run at bottoms[0] + k*S + (64 - y)*tan (row-local y)
      expect(Math.abs(rel - Math.round(rel))).toBeLessThan(0.02);
    }
  });
});

it("the second copy of a token on a row is dashed, the first stays solid", () => {
  const { placed } = layoutWideLinesIntoRows(["и и", "6 8 6 8", "ши"], map, undefined, false);
  const flags = (r) => placed[r].segments[0].strokes.map((s) => !!s.dashed);
  expect(flags(0)).toEqual([false, true]);
  expect(flags(1)).toEqual([false, false, true, true]);
  expect(flags(2).some(Boolean)).toBe(false);
});

it("a row of one repeated token is multiplied across the row; every copy start is marked, copies after the first are dashed", () => {
  const { placed } = layoutWideLinesIntoRows(["и и", "ини", "7 | 7 |"], map);
  const seg = placed[0].segments[0];
  expect(seg.strokes.length).toBeGreaterThan(4);
  expect(seg.width).toBeLessThanOrEqual(831);
  expect(seg.startPoints).toHaveLength(seg.strokes.length);
  expect(placed[1].segments[0].startPoints.length).toBeGreaterThan(1); // page-1 word is multiplied too
  expect(placed[1].segments[0].startPoints.length).toBeGreaterThan(1); // page-1 word is multiplied too
  expect(placed[2].segments[0].strokes.length).toBeGreaterThan(4); // alternating unit "7 |" is multiplied
});

it("copies after the first are all dashed at one constant intensity, single words are multiplied", () => {
  const { placed } = layoutWideLinesIntoRows(["и и", "ини", "7"], map);
  const ops = placed[0].segments[0].strokes.slice(1).map((s) => s.opacity);
  expect(new Set(ops).size).toBe(1);
  expect(ops[0]).toBeGreaterThan(0.3);
  const w = placed[1].segments[0];
  expect(w.startPoints.length).toBeGreaterThan(2);
  expect(w.strokes.filter((s) => s.dashed).length).toBe(w.strokes.length - 3);
  expect(placed[2].segments[0].strokes).toHaveLength(1);
});

it("direction arrows are switched off on every wide row (start dots only)", () => {
  const { placed } = layoutWideLinesIntoRows(["и и", "ш ш", "ини", "инш", "5 5"], map, undefined, false);
  for (const row of placed) expect(row.segments[0].directionArrows).toHaveLength(0);
  for (const row of placed) expect(row.segments[0].startPoints.length).toBeGreaterThan(0);
});

it("page-1 fence rows are copied end to start to the row's end with no gaps", () => {
  const { placed } = layoutWideLinesIntoRows(["заборчик"], map);
  const seg = placed[0].segments[0];
  expect(seg.strokes.length).toBeGreaterThan(3);
  for (let i = 1; i < seg.strokes.length; i++) {
    const prevEnd = getPathEndpoints(seg.strokes[i - 1].d).end;
    const start = getPathEndpoints(seg.strokes[i].d).start;
    expect(start[0]).toBeCloseTo(prevEnd[0], 1);
    expect(start[1]).toBeCloseTo(prevEnd[1], 1);
  }
  expect(seg.strokes.map((s) => !!s.dashed)).toEqual(seg.strokes.map((_, i) => i > 0));
  expect(seg.startPoints).toHaveLength(seg.strokes.length);
});

describe("narrow rows (half-size glyphs)", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const cell = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / cell) * cell - y * T;
  it("draws glyphs at half height on the same baseline; р's stem drops one band below it", () => {
    const wide = layoutWideLinesIntoRows(["п"], map, undefined, false).placed[0].segments[0];
    const narrow = layoutWideLinesIntoRows(["п"], map, undefined, false, 0.5).placed[0].segments[0];
    const ys = (seg) => seg.strokes.flatMap((s) => samplePath(s.d).map((p) => p[1]));
    const wideH = 64 - Math.min(...ys(wide));
    const narrowH = 64 - Math.min(...ys(narrow));
    expect(narrowH).toBeCloseTo(wideH / 2, 0);
    expect(Math.max(...ys(narrow))).toBeLessThanOrEqual(64.5);
    const r = layoutWideLinesIntoRows(["р"], map, undefined, false, 0.5).placed[0].segments[0];
    expect(Math.max(...ys(r))).toBeCloseTo(64 + 24, 0);
  });
  it("starts of every copy land on the half-size slant grid", () => {
    const { placed } = layoutWideLinesIntoRows(["р р", "ри"], map, snap, true, 0.5);
    for (const row of placed) {
      for (const [x, y] of row.segments[0].startPoints) {
        const n = (x + y * T) / cell;
        expect(Math.abs(n - Math.round(n))).toBeLessThan(0.02);
      }
    }
  });
});

describe("captured letters л, м, я", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  it("exist, lie in the wide band, and start on the slant grid", () => {
    for (const label of ["л", "м", "я"]) {
      const { placed } = layoutWideLinesIntoRows([label], map, snap, false);
      const seg = placed[0].segments[0];
      const ys = seg.strokes.flatMap((s) => samplePath(s.d).map((p) => p[1]));
      expect(Math.min(...ys)).toBeGreaterThan(14);
      expect(Math.max(...ys)).toBeLessThan(66);
      expect(ys.every(Number.isFinite)).toBe(true);
      const [x, y] = seg.startPoints[0];
      const n = (x + y * T) / S;
      expect(Math.abs(n - Math.round(n))).toBeLessThan(0.02);
    }
  });
  it("the ready sheet for л, м, я is 16 rows and every token resolves", () => {
    const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page3;
    expect(raw).toHaveLength(16);
    const { placed } = layoutWideLinesIntoRows(raw, map, snap);
    for (const row of placed) expect(row.segments.length).toBe(1);
  });
});

it("letter exit rises end above the dashed middle line", () => {
  for (const [label, scale] of [["л", 1], ["м", 1], ["и", 1], ["л", 0.5]]) {
    const seg = layoutWideLinesIntoRows([label], map, undefined, false, scale).placed[0].segments[0];
    const end = seg.strokes.map((s) => getPathEndpoints(s.d).end).sort((a, b) => b[0] - a[0])[0];
    const dashY = 64 - 24 * scale;
    expect(end[1]).toBeLessThan(dashY - 1 * scale);
  }
});

it("a free exit tail ends exactly on a slant line; a tail into a lower-starting letter is cut by that letter's slant", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const free = layoutWideLinesIntoRows(["л"], map, snap, false).placed[0].segments[0];
  const [ex, ey] = getPathEndpoints(free.strokes[0].d).end;
  const n = (ex + ey * T) / S;
  expect(Math.abs(n - Math.round(n))).toBeLessThan(0.02);
  const joined = layoutWideLinesIntoRows(["ил"], map, snap, false).placed[0].segments[0];
  const tailEnd = getPathEndpoints(joined.strokes[0].d).end;
  const nextStart = getPathEndpoints(joined.strokes[1].d).start;
  expect(tailEnd[1]).toBeLessThan(nextStart[1]);
  const slantOffset = (tailEnd[0] + tailEnd[1] * T) - (nextStart[0] + nextStart[1] * T);
  expect(Math.abs(slantOffset)).toBeLessThan(0.3);
});

it("a letter's exit tail and the rise of a following г are one straight line", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  for (const w of ["иг", "нг", "лг", "мг", "яг", "пг"]) {
    const seg = layoutWideLinesIntoRows([w], map, snap, false).placed[0].segments[0];
    const tail = seg.strokes[0];
    const next = seg.strokes[1];
    const [sx, sy] = getPathEndpoints(next.d).start;
    const np = samplePath(next.d, 60);
    const rp = np.find((q) => Math.hypot(q[0] - sx, q[1] - sy) > 12);
    const ux = rp[0] - sx, uy = rp[1] - sy, ul = Math.hypot(ux, uy);
    const all = samplePath(tail.d, 80);
    const te = getPathEndpoints(tail.d).end;
    // the last ~12 units of the tail (by distance, so a long multi-segment stroke does not drag its whole body in)
    const tp = all.filter((q) => Math.hypot(q[0] - te[0], q[1] - te[1]) < 12 && q[1] < 54);
    expect(tp.length).toBeGreaterThan(3);
    for (const q of tp) {
      const dist = Math.abs((q[0] - sx) * (uy / ul) - (q[1] - sy) * (ux / ul));
      expect(dist).toBeLessThan(0.6);
    }
  }
});

it("letters touch the band's top and bottom lines (sheet y 16 and 64); р keeps its descender", () => {
  for (const label of ["и", "й", "ш0", "н", "г", "п", "т", "к", "л", "м", "я"]) {
    const seg = layoutWideLinesIntoRows([label], map, undefined, false).placed[0].segments[0];
    const body = seg.strokes.map((s) => samplePath(s.d, 80).map((p) => p[1])).filter((ys) => Math.min(...ys) > 12);
    expect(Math.min(...body.map((ys) => Math.min(...ys)))).toBeCloseTo(16, 0);
    expect(Math.max(...body.map((ys) => Math.max(...ys)))).toBeGreaterThan(63.6);
    expect(Math.max(...body.map((ys) => Math.max(...ys)))).toBeLessThan(64.5);
  }
  const r = layoutWideLinesIntoRows(["р"], map, undefined, false).placed[0].segments[0];
  expect(Math.max(...r.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1])))).toBeGreaterThan(100);
});

it("о exists, fills the band, starts on the slant grid; the ready sheet for о has 16 rows that all resolve", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const seg = layoutWideLinesIntoRows(["о"], map, snap, false).placed[0].segments[0];
  const ys = seg.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
  expect(Math.min(...ys)).toBeCloseTo(16, 0);
  expect(Math.max(...ys)).toBeCloseTo(64, 0);
  const [x, y] = seg.startPoints[0];
  const n = (x + y * T) / S;
  expect(Math.abs(n - Math.round(n))).toBeLessThan(0.02);
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page4;
  expect(raw).toHaveLength(16);
  for (const row of layoutWideLinesIntoRows(raw, map, snap).placed) expect(row.segments.length).toBe(1);
});

it("а, ю, с exist; а and с are entered from their left side (no overlap with the previous letter); page-5 rows all resolve", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  for (const w of ["а", "ю", "с"]) {
    const seg = layoutWideLinesIntoRows([w], map, snap, false).placed[0].segments[0];
    const ys = seg.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
    expect(Math.min(...ys)).toBeGreaterThan(14);
    expect(Math.max(...ys)).toBeLessThan(66);
  }
  // the next letter's body must not cross back over the previous letter's start: its leftmost x is right of н's start
  const na = layoutWideLinesIntoRows(["на"], map, snap, false).placed[0].segments[0];
  const nStart = getPathEndpoints(na.strokes[0].d).start[0];
  const aMinX = Math.min(...samplePath(na.strokes[1].d, 80).map((p) => p[0]));
  expect(aMinX).toBeGreaterThan(nStart + 20);
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page5;
  expect(raw).toHaveLength(15);
  for (const row of layoutWideLinesIntoRows(raw, map, snap).placed) expect(row.segments.length).toBe(1);
});

it("a joined а / с is entered from the left of its oval: the pen runs clockwise round the oval to the start before writing", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  for (const w of ["на", "ас"]) {
    const seg = layoutWideLinesIntoRows([w], map, snap, false).placed[0].segments[0];
    const anim = seg.trajectory.strokes;
    const t = anim.find((s, i) => i > 0 && s.continuous && anim[i + 1]?.continuous && s !== anim[anim.length - 1]);
    expect(t).toBeTruthy();
    expect((t.d.match(/C/g) ?? []).length).toBeGreaterThan(10);   // a curve round the oval, not a straight hop
    // it ends at the start of the next letter's own stroke
    const next = anim[anim.indexOf(t) + 1];
    const endT = getPathEndpoints(t.d).end;
    const stN = getPathEndpoints(next.d).start;
    expect(Math.hypot(endT[0] - stN[0], endT[1] - stN[1])).toBeLessThan(0.6);
  }
});

it("sheet 6 (э, х, ж) resolves: every row is one segment and the synthesized letters stay inside the band", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page6;
  expect(raw).toHaveLength(15);
  for (const row of layoutWideLinesIntoRows(raw, map, snap).placed) expect(row.segments.length).toBe(1);
  for (const w of ["э", "х", "ж", "е"]) {
    const seg = layoutWideLinesIntoRows([w], map, snap, false).placed[0].segments[0];
    const ys = seg.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
    expect(Math.min(...ys)).toBeGreaterThan(14);
    expect(Math.max(...ys)).toBeLessThan(66);
  }
});

it("a letter that starts high (э, х, ж) is reached by bending the previous tail: it ends exactly at that start, with no hop", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  for (const w of ["оэ", "нх", "кж", "аж"]) {
    const seg = layoutWideLinesIntoRows([w], map, snap, false).placed[0].segments[0];
    const anim = seg.trajectory.strokes;
    const t = anim.find((s, i) => i > 0 && s.continuous);
    expect(t).toBeTruthy();
    const [a, b] = [getPathEndpoints(t.d).start, getPathEndpoints(t.d).end];
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.6); // the transition from the tail to the next start is zero-length
  }
  // letters that start on the top line keep their straight joins
  const seg = layoutWideLinesIntoRows(["ни"], map, snap, false).placed[0].segments[0];
  expect(seg.strokes).toHaveLength(2);
});

it("sheet 7 (ч, ь, ы, ъ) resolves: one segment per row, ы is ь + a stem", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 30;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page7;
  expect(raw).toHaveLength(15);
  for (const row of layoutWideLinesIntoRows(raw, map, snap).placed) expect(row.segments.length).toBe(1);
  const seg = layoutWideLinesIntoRows(["ы"], map, snap, false).placed[0].segments[0];
  expect(seg.strokes).toHaveLength(2);
  for (const w of ["ч", "ь", "ъ"]) {
    const s1 = layoutWideLinesIntoRows([w], map, snap, false).placed[0].segments[0];
    const ys = s1.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
    expect(Math.min(...ys)).toBeGreaterThan(14);
    expect(Math.max(...ys)).toBeLessThan(66);
  }
});

it("sheet 8 (б, narrow rows) resolves: one segment per row, б reaches the ascender line", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page8;
  expect(raw).toHaveLength(8);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
  const seg = layoutWideLinesIntoRows(["б"], map, snap, false, 0.5).placed[0].segments[0];
  const ys = seg.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
  expect(Math.min(...ys)).toBeLessThan(18);   // up at the ascender dashed line (one band over the band top)
});

it("sheet 9 (ф, narrow rows) resolves: one segment per row, ф reaches the descender line", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page9;
  expect(raw).toHaveLength(8);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
  const seg = layoutWideLinesIntoRows(["ф"], map, snap, false, 0.5).placed[0].segments[0];
  expect(seg.strokes).toHaveLength(1);   // one stroke: left oval, stem down and up, mirrored right oval, exit
  const ys = seg.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
  expect(Math.max(...ys)).toBeGreaterThan(80);   // the stem goes down to the descender dashed line
});

it("sheet 10 (у, narrow rows) resolves and у descends below the baseline", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page10;
  expect(raw).toHaveLength(7);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
  const seg = layoutWideLinesIntoRows(["у"], map, snap, false, 0.5).placed[0].segments[0];
  const ys = seg.strokes.flatMap((s) => samplePath(s.d, 80).map((p) => p[1]));
  expect(Math.max(...ys)).toBeGreaterThan(70);
});

it("sheet 11 (д, з, narrow rows) resolves, one segment per row", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page11;
  expect(raw).toHaveLength(7);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
});

it("sheet 12 (в, narrow rows) resolves, one segment per row", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page12;
  expect(raw).toHaveLength(8);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
});

it("sheet 13 (ц, щ, narrow rows) resolves, one segment per row", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page13;
  expect(raw).toHaveLength(8);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
});

it("sheet 14 (capitals И Ш Ц Щ У Ч, narrow rows) resolves, one segment per row", () => {
  const T = Math.tan((25 * Math.PI) / 180);
  const S = 15;
  const snap = (_r, x, y) => Math.round((x + y * T) / S) * S - y * T;
  const raw = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).sheets.page14;
  expect(raw).toHaveLength(12);
  for (const row of layoutWideLinesIntoRows(raw, map, snap, true, 0.5).placed) expect(row.segments.length).toBe(1);
});

