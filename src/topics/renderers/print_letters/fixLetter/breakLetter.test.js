import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { screenGlyph } from "../screenWrite/traceEngine";
import { MAGNETS, breakLetter, glyphWidthOf, grabRole, isFixed, letterParts, moved, partEnds, snapKeys, vlen } from "./breakLetter";

// a repeatable random source
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const letters = topic.cards.filter((c) => Array.isArray(c.strokes) && c.strokes.length).map(screenGlyph);
const offsetOf = (p) => (p.line ? (vlen(p.ea) >= vlen(p.eb) ? p.ea : p.eb) : p.off);

describe("«Почини букву»: breaking a letter", () => {
  it("breaks exactly the asked number of draggable parts, on every letter and setting", () => {
    for (const card of letters) {
      const draggable = letterParts(card).filter((p) => p.len >= 20).length;
      for (const broken of [1, 2, "all"]) {
        for (let seed = 1; seed <= 25; seed++) {
          const parts = breakLetter(card, { broken, tilt: true, mirror: true, magnet: "strong" }, seeded(seed));
          const n = parts.filter((p) => !isFixed(p)).length;
          const want = broken === "all" ? draggable : Math.min(draggable, broken);
          expect(n, `${card.id} broken=${broken} seed=${seed}`).toBe(want);
        }
      }
    }
  });

  it("keeps the letter recognisable: moves past the magnet but ≤ ~¼ of the height, outwards, one tilt and one mirror at most", () => {
    for (const card of letters) {
      const W = glyphWidthOf(card), C = { x: W / 2, y: 50 };
      for (const magnet of ["strong", "normal"]) {
        for (let seed = 1; seed <= 40; seed++) {
          const parts = breakLetter(card, { broken: "all", tilt: true, mirror: true, magnet }, seeded(seed));
          const broken = parts.filter((p) => !isFixed(p));
          expect(broken.filter((p) => p.broke === "tilt").length).toBeLessThanOrEqual(1);
          expect(broken.filter((p) => p.broke === "mirror").length).toBeLessThanOrEqual(1);
          for (const p of broken) {
            if (p.broke === "mirror") continue;
            const v = offsetOf(p);
            const label = `${card.id} ${p.name} ${magnet} seed=${seed}`;
            expect(vlen(v), label).toBeGreaterThan(MAGNETS[magnet]);
            expect(vlen(v), label).toBeLessThanOrEqual(MAGNETS[magnet] + 6 + 8 + 1.5);
            if (p.broke === "shift" && Math.hypot(p.cx - C.x, p.cy - C.y) > 6) {
              // within 45° of «away from the centre»: never across the letter
              const cos = (v.x * (p.cx - C.x) + v.y * (p.cy - C.y)) / (vlen(v) * Math.hypot(p.cx - C.x, p.cy - C.y));
              expect(cos, label).toBeGreaterThan(0.6); // 45° plus rounding to whole units
            }
          }
        }
      }
    }
  });

  it("only tilts straight strokes and only mirrors half-ovals", () => {
    for (const card of letters) {
      for (let seed = 1; seed <= 20; seed++) {
        for (const p of breakLetter(card, { broken: "all", tilt: true, mirror: true }, seeded(seed))) {
          if (p.broke === "tilt") expect(p.line).not.toBeNull();
          if (p.broke === "mirror") expect(p.half).toBe(true);
        }
      }
    }
  });

  it("never tilts or mirrors when those are off", () => {
    for (const card of letters) {
      for (const p of breakLetter(card, { broken: "all" }, seeded(7))) expect(["shift", undefined]).toContain(p.broke);
    }
  });
});

describe("«Почини букву»: dragging parts", () => {
  const Н = screenGlyph(topic.cards.find((c) => c.id === "Н"));

  it("the middle of a straight stroke drags it whole, near an end drags only that end", () => {
    const [stick] = letterParts(Н); // left stick 0,0 → 0,100
    expect(grabRole(stick, { x: 1, y: 50 })).toBe("body");
    expect(grabRole(stick, { x: 0, y: 3 })).toBe("a");
    expect(grabRole(stick, { x: 0, y: 96 })).toBe("b");
    const end = moved(stick, "a", 10, 0);
    expect(partEnds(end)).toEqual({ a: { x: 10, y: 0 }, b: { x: 0, y: 100 } });
    const whole = moved(stick, "body", 5, -5);
    expect(partEnds(whole)).toEqual({ a: { x: 5, y: -5 }, b: { x: 5, y: 95 } });
  });

  it("a whole part moved away is broken until it is back; the magnet snaps each end on its own", () => {
    const [stick] = letterParts(Н);
    const away = moved(stick, "body", 30, 0);
    expect(isFixed(away)).toBe(false);
    expect(snapKeys(away, "strong")).toEqual([]);
    const near = moved(stick, "a", 8, 4);
    expect(snapKeys(near, "strong")).toEqual(["ea"]);
    expect(isFixed({ ...near, ea: { x: 0, y: 0 } })).toBe(true);
  });
});
