import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { screenGlyph } from "../screenWrite/traceEngine";
import {
  MAGNETS, breakLetter, glyphWidthOf, grabRole, isSlanted, isSolved, letterParts, letterTargets, looseParts, matchDistance,
  mirrorLine, moved, partEnds, slantMirrorable, snapTarget, tapMirrors, vlen,
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

  it("only tilts straight strokes and only mirrors half-ovals and И's / Й's diagonal; neither when they are off", () => {
    for (const card of letters) {
      const targets = letterTargets(card);
      for (let seed = 1; seed <= 20; seed++) {
        for (const p of breakLetter(card, { broken: "all", tilt: true, mirror: true }, seeded(seed))) {
          if (p.broke === "tilt") expect(p.line).toBe(true);
          if (p.broke === "mirror") expect(targets[p.i].half || slantMirrorable(targets[p.i], targets), `${card.id} ${p.name}`).toBe(true);
        }
      }
      for (const p of breakLetter(card, { broken: "all" }, seeded(7))) expect(["shift", undefined]).toContain(p.broke);
    }
  });
});

describe("«Почини букву»: a slant the wrong way (owner, 2026-11-06)", () => {
  it("breaks by mirroring a slant only where the flipped stroke still joins the letter at both ends: И and Й", () => {
    const able = letters.filter((card) => { const ts = letterTargets(card); return ts.some((t) => slantMirrorable(t, ts)); });
    expect(able.map((c) => c.id).sort()).toEqual(["И", "Й"]);
  });

  it("И can come with its diagonal the wrong way («N»): loose until a tap mirrors it back", () => {
    const card = glyph("И");
    const targets = letterTargets(card);
    let parts = null;
    for (let seed = 1; seed <= 200 && !parts; seed++) {
      const ps = breakLetter(card, { broken: 1, tilt: false, mirror: true }, seeded(seed));
      if (ps.some((p) => p.broke === "mirror")) parts = ps;
    }
    expect(parts).not.toBeNull();
    const i = parts.findIndex((p) => p.broke === "mirror");
    expect(isSlanted(parts[i])).toBe(true);
    expect(looseParts(parts, targets)).toEqual([i]);
    const fixed = parts.map((p, k) => (k === i ? mirrorLine(p) : p));
    expect(isSolved(fixed, targets)).toBe(true);
  });

  it("a tap mirrors a stroke slanted in the letter, not a stick that was only tilted", () => {
    const card = glyph("Н");
    const targets = letterTargets(card);
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of breakLetter(card, { broken: "all", tilt: true, mirror: true }, seeded(seed))) {
        expect(tapMirrors(p), `${p.name} ${p.broke}`).toBe(false);
      }
    }
    expect(letterParts(glyph("И")).filter(tapMirrors).map((p) => p.name)).toEqual(["наклонная"]);
    expect(targets.length).toBeGreaterThan(0);
  });

  it("a tap mirrors any slanted straight stroke and twice gives it back; sticks and bars are not slanted", () => {
    for (const card of letters) {
      for (const p of letterParts(card).filter((q) => q.line)) {
        const flat = Math.abs(p.pa.x - p.pb.x) <= 1 || Math.abs(p.pa.y - p.pb.y) <= 1;
        expect(isSlanted(p), `${card.id} ${p.name}`).toBe(!flat);
        if (!flat) {
          const back = mirrorLine(mirrorLine(p));
          expect([back.pa, back.pb]).toEqual([p.pa, p.pb]);
        }
      }
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

describe("«Почини букву»: the ovals of О Ю С Э cut in half (owner, 2026-11-04)", () => {
  it("О, Ю, С, Э have a top and a bottom arc instead of one oval; other letters are as in the glyph", () => {
    for (const id of ["О", "Ю", "С", "Э"]) {
      const t = letterTargets(glyph(id)).filter((x) => !x.line);
      expect(t.map((x) => x.name.split(":")[0]), id).toEqual(["верхняя половина", "нижняя половина"]);
      expect(t[0].cy, id).toBeLessThan(50);
      expect(t[1].cy, id).toBeGreaterThan(50);
    }
    expect(letterTargets(glyph("З")).length).toBe(2);           // З already has two half-ovals
    expect(letterTargets(glyph("В")).length).toBe(3);
  });

  it("О's arcs mirror upside down (they look the same from both sides), С's and Э's sideways", () => {
    expect(letterTargets(glyph("О")).map((t) => t.flip)).toEqual(["y", "y"]);
    expect(letterTargets(glyph("С")).map((t) => t.flip)).toEqual(["x", "x"]);
    expect(letterTargets(glyph("Э")).filter((t) => !t.line).map((t) => t.flip)).toEqual(["x", "x"]);
  });

  it("a mirrored arc does not fit until it is turned back; an upside-down top arc of О fits the bottom place", () => {
    const О = glyph("О");
    const targets = letterTargets(О);
    const parts = letterParts(О);
    parts[0] = { ...parts[0], mirror: true };                  // the top arc upside down — a cup at the top
    expect(isSolved(parts, targets)).toBe(false);
    parts[0] = { ...parts[0], mirror: false };
    expect(isSolved(parts, targets)).toBe(true);
    // the shape decides: the top arc turned over is the bottom arc's shape
    const cup = { ...letterParts(О)[0], mirror: true, off: { x: 0, y: 50 } };
    expect(matchDistance(cup, targets[1])).toBeLessThan(2);
  });

  it("С with both halves mirrored would read as Э — at most one half is ever mirrored", () => {
    const С = glyph("С");
    for (let seed = 1; seed <= 60; seed++) {
      const parts = breakLetter(С, { broken: "all", tilt: true, mirror: true }, seeded(seed));
      expect(parts.filter((p) => p.mirror).length).toBeLessThanOrEqual(1);
    }
  });
});
