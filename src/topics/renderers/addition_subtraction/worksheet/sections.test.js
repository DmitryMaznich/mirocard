import { describe, expect, it } from "vitest";
import { allowedChanges, buildWorksheet, defaultConfig, defaultSection, normalizeSection, SECTION_TYPES } from "./sections";

function evaluate(item) {
  // Replace blanks by their answers and check the row is true.
  const toks = item.tokens.map((t) => (t.t === "blank" ? (t.kind === "sign" ? { t: "op", op: item.answers[t.i] } : { t: "num", v: item.answers[t.i] }) : t));
  if (toks.some((t) => t.t === "arrow")) {
    let v = toks[0].v;
    for (let i = 1; i < toks.length; i += 2) {
      v = toks[i].op === "add" ? v + toks[i].d : v - toks[i].d;
      if (toks[i + 1].v !== v) return false;
    }
    return true;
  }
  const eq = toks.findIndex((t) => t.t === "eq");
  const calc = (list) => list.reduce((acc, t, i) => (i === 0 ? t.v : t.t === "num" ? (list[i - 1].op === "add" ? acc + t.v : acc - t.v) : acc), 0);
  return calc(toks.slice(0, eq)) === calc(toks.slice(eq + 1));
}

describe("worksheet sections", () => {
  it.each(SECTION_TYPES)("%s: items are true once filled, numbers stay in range", (type) => {
    for (const maxNumber of [5, 10, 20]) {
      const sheet = buildWorksheet({ title: "t", seed: 7, sections: [{ ...defaultSection(type), maxNumber, changeMax: 99, count: 12 }] });
      const [section] = sheet.sections;
      expect(section.items).toHaveLength(12);
      for (const item of section.items) {
        expect(evaluate(item)).toBe(true);
        for (const t of item.tokens) if (t.t === "num") { expect(t.v).toBeGreaterThanOrEqual(1); expect(t.v).toBeLessThanOrEqual(maxNumber); }
        for (const a of item.answers) if (typeof a === "number") { expect(a).toBeGreaterThanOrEqual(1); expect(a).toBeLessThanOrEqual(maxNumber); }
      }
    }
  });

  it("the same seed gives the same sheet, another seed a different one", () => {
    const a = buildWorksheet(defaultConfig());
    const b = buildWorksheet(defaultConfig());
    expect(b).toEqual(a);
    expect(buildWorksheet({ ...defaultConfig(), seed: 2 })).not.toEqual(a);
  });

  it("several actions and chains have the chosen number of steps", () => {
    const sheet = buildWorksheet({ seed: 3, sections: [{ type: "multi", steps: 4, count: 5 }, { type: "chain", steps: 4, count: 5 }] });
    for (const item of sheet.sections[0].items) expect(item.tokens.filter((t) => t.t === "op")).toHaveLength(4);
    for (const item of sheet.sections[1].items) expect(item.answers).toHaveLength(4);
  });

  it("missing number: left, right or alternating", () => {
    const side = (item) => (item.tokens[0].t === "blank" ? "left" : "right");
    const sheet = buildWorksheet({ seed: 4, sections: [{ type: "missing", unknown: "left", count: 4 }, { type: "missing", unknown: "mixed", count: 4 }] });
    expect(sheet.sections[0].items.map(side)).toEqual(["left", "left", "left", "left"]);
    expect(sheet.sections[1].items.map(side)).toEqual(["right", "left", "right", "left"]);
  });

  it("only-plus sections have only plus", () => {
    const sheet = buildWorksheet({ seed: 5, sections: [{ type: "one", ops: "add", count: 10 }] });
    for (const item of sheet.sections[0].items) expect(item.tokens.find((t) => t.t === "op").op).toBe("add");
  });

  it("change limited by the range, «любое» only up to 20", () => {
    expect(allowedChanges(5)).toEqual([1, 3, 5]);
    expect(allowedChanges(10)).toEqual([1, 3, 5, 10]);
    expect(allowedChanges(20)).toEqual([1, 3, 5, 10, 99]);
    expect(normalizeSection({ type: "one", maxNumber: 5, changeMax: 99 }).changeMax).toBe(5);
    expect(normalizeSection({ type: "one", maxNumber: 5, changeMax: 10 }).changeMax).toBe(5);
  });

  it("includes zero only when asked", () => {
    const sheet = buildWorksheet({ seed: 9, sections: [{ type: "one", includeZero: true, maxNumber: 5, count: 12 }] });
    const all = sheet.sections[0].items.flatMap((i) => [...i.tokens.filter((t) => t.t === "num").map((t) => t.v), ...i.answers]);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(0);
  });
});
