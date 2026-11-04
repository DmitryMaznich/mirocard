import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { screenGlyph } from "../screenWrite/traceEngine";
import {
  MAGNETS, breakLetter, glyphWidthOf, grabRole, isSolved, letterParts, letterTargets, looseParts, matchDistance, moved,
  partEnds, snapTarget, vlen,
} from "./breakLetter";

// a repeatable random source
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const letters = topic.cards.filter((c) => Array.isArray(c.strokes) && c.strokes.length).map(screenGlyph);
const glyph = (id) => screenGlyph(topic.cards.find((c) => c.id === id));

describe("«Почини букву»: breaking a letter", () => {
  it("breaks exactly the asked number of draggable parts, on every letter and setting", () => {
    for (const card of letters) {
      const targets = letterTargets(card);
      const draggable = targets.filter((t) => t.len >= 20).length;
      expect(isSolved(letterParts(card), targets)).toBe(true);
      for (const broken of [1, 2, "all"]) {
        for (let seed = 1; seed <= 25; seed++) {
          const parts = breakLetter(card, { broken, tilt: true, mirror: true, magnet: "strong" }, seeded(seed));
          const want = broken === "all" ? draggable : Math.min(draggable, broken);
          // counted by shape: a part that landed on a twin's place would not count as broken
          expect(looseParts(parts, targets).length, `${card.id} broken=${broken} seed=${seed}`).toBe(want);
          expect(isSolved(parts, targets)).toBe(false);
        }
      }
    }
  });

  it("keeps the letter recognisable: moves past the magnet but ≤ ~¼ of the height, outwards, one tilt and one mirror at most", () => {
    for (const card of letters) {
      const W = glyphWidthOf(card), C = { x: W / 2, y: 50 };
      const targets = letterTargets(card);
      for (const magnet of ["strong", "normal"]) {
        for (let seed = 1; seed <= 40; seed++) {
          const parts = breakLetter(card, { broken: "all", tilt: true, mirror: true, magnet }, seeded(seed));
          const broken = parts.filter((p) => p.broke);
          expect(broken.filter((p) => p.broke === "tilt").length).toBeLessThanOrEqual(1);
          expect(broken.filter((p) => p.broke === "mirror").length).toBeLessThanOrEqual(1);
          for (const p of broken) {
            if (p.broke === "mirror") continue;
            const v = p.moved, t = targets[p.i];
            const label = `${card.id} ${p.name} ${magnet} seed=${seed}`;
            expect(vlen(v), label).toBeGreaterThan(MAGNETS[magnet]);
            expect(vlen(v), label).toBeLessThanOrEqual(MAGNETS[magnet] + 6 + 8 + 1.5);
            if (p.broke === "shift" && Math.hypot(t.cx - C.x, t.cy - C.y) > 6) {
              // within 45° of «away from the centre»: never across the letter
              const cos = (v.x * (t.cx - C.x) + v.y * (t.cy - C.y)) / (vlen(v) * Math.hypot(t.cx - C.x, t.cy - C.y));
              expect(cos, label).toBeGreaterThan(0.6); // 45° plus rounding to whole units
            }
          }
        }
      }
    }
  });

  it("only tilts straight strokes and only mirrors half-ovals; neither when they are off", () => {
    for (const card of letters) {
      const targets = letterTargets(card);
      for (let seed = 1; seed <= 20; seed++) {
        for (const p of breakLetter(card, { broken: "all", tilt: true, mirror: true }, seeded(seed))) {
          if (p.broke === "tilt") expect(p.line).toBe(true);
          if (p.broke === "mirror") expect(targets[p.i].half).toBe(true);
        }
      }
      for (const p of breakLetter(card, { broken: "all" }, seeded(7))) expect(["shift", undefined]).toContain(p.broke);
    }
  });
});

describe("«Почини букву»: dragging and snapping parts", () => {
  it("the middle of a straight stroke drags it whole, near an end drags only that end", () => {
    const [stick] = letterParts(glyph("Н")); // left stick 0,0 → 0,100
    expect(grabRole(stick, { x: 1, y: 50 })).toBe("body");
    expect(grabRole(stick, { x: 0, y: 3 })).toBe("a");
    expect(grabRole(stick, { x: 0, y: 96 })).toBe("b");
    expect(partEnds(moved(stick, "a", 10, 0))).toEqual({ a: { x: 10, y: 0 }, b: { x: 0, y: 100 } });
    expect(partEnds(moved(stick, "body", 5, -5))).toEqual({ a: { x: 5, y: -5 }, b: { x: 5, y: 95 } });
  });

  it("checks the SHAPE of the letter: Е's three bars fit any bar's place (owner, 2026-11-04)", () => {
    const Е = glyph("Е"); // 0 stick, 1 top bar, 2 middle bar, 3 bottom bar
    const targets = letterTargets(Е);
    let parts = letterParts(Е);
    // take the top bar and the bottom bar off, then put each into the OTHER one's place
    parts[1] = moved(parts[1], "body", 0, 30);            // top bar now at y=30
    parts[3] = moved(parts[3], "body", 0, -30);           // bottom bar now at y=70
    expect(isSolved(parts, targets)).toBe(false);
    parts[1] = moved(parts[1], "body", 3, 66);            // the old top bar, let go near the bottom (y=96)
    const s1 = snapTarget(parts, 1, targets, "strong");
    expect(s1).not.toBeNull();
    expect(partEnds(s1)).toEqual({ a: { x: 0, y: 100 }, b: { x: 50, y: 100 } });
    parts[1] = s1;
    parts[3] = moved(parts[3], "body", -2, -66);          // the old bottom bar, near the top (y=4)
    parts[3] = snapTarget(parts, 3, targets, "strong");
    expect(isSolved(parts, targets)).toBe(true);
  });

  it("a part never snaps onto a place another part already stands on", () => {
    const Е = glyph("Е");
    const targets = letterTargets(Е);
    const parts = letterParts(Е);
    parts[2] = moved(parts[2], "body", 2, 47);            // the middle bar dragged right onto the bottom bar
    expect(snapTarget(parts, 2, targets, "strong")).toBeNull();
  });

  it("a straight part matches in either direction and whatever its length was (ends can be pulled)", () => {
    const Н = glyph("Н");
    const targets = letterTargets(Н);
    const bar = { i: 2, line: true, pa: { x: 52, y: 47 }, pb: { x: -3, y: 53 }, len: 50 }; // reversed, a bit off
    expect(matchDistance(bar, targets[2])).toBeLessThan(MAGNETS.strong);
    expect(matchDistance(bar, targets[0])).toBeGreaterThan(MAGNETS.strong);
  });

  it("Ш's three sticks are interchangeable too, a whole part moved away is loose until it is back", () => {
    const Ш = glyph("Ш");
    const targets = letterTargets(Ш);
    let parts = letterParts(Ш);
    parts[0] = moved(parts[0], "body", -30, 0);
    expect(looseParts(parts, targets)).toEqual([0]);
    parts[0] = moved(parts[0], "body", 32, 1);
    parts[0] = snapTarget(parts, 0, targets, "strong");
    expect(isSolved(parts, targets)).toBe(true);
  });

  it("a mirrored half-oval does not fit until it is turned back", () => {
    const З = glyph("З");
    const targets = letterTargets(З);
    const parts = letterParts(З);
    parts[0] = { ...parts[0], mirror: true };
    expect(isSolved(parts, targets)).toBe(false);
    expect(snapTarget(parts, 0, targets, "strong")).toBeNull();
    parts[0] = { ...parts[0], mirror: false };
    expect(isSolved(parts, targets)).toBe(true);
  });
});
