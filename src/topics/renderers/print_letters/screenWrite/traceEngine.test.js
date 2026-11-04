import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import {
  TRACE_TUNING, parsePath, samplePath, strokeGeometry, halfWidth, canStart, createTracer, matchFreeStroke, polyD,
} from "./traceEngine";

const letter = (id) => topic.cards.find((c) => c.id === id);
const T = halfWidth("wide");

// a finger that wobbles a little across the path (but stays well inside the track)
function wobble(pts, amp) {
  return pts.map((p, i) => ({ x: p.x + Math.sin(i * 0.7) * amp, y: p.y + Math.cos(i * 0.9) * amp }));
}
function run(geo, finger, t = T, lift = true) {
  if (!canStart(geo, finger[0], t)) return "no-start";
  const tr = createTracer(geo, t);
  let s = tr.state;
  for (const p of finger.slice(1)) { s = tr.push(p); if (s !== "move") return s; }
  return lift ? tr.lift() : s;
}

describe("traceEngine — path sampling", () => {
  it("parses the M/L/C paths of topic.json", () => {
    expect(parsePath("M 0,0 L 0,100")).toHaveLength(1);
    const p = parsePath("M 0,0 L 22,0 C 37.464,0 50,11.192 50,25 C 50,38.808 37.464,50 22,50 L 0,50");
    expect(p.map((s) => s.type)).toEqual(["L", "C", "C", "L"]);
  });

  it("samples a path evenly from its start to its end", () => {
    const { pts, length } = samplePath("M 0,0 L 0,100");
    expect(length).toBeCloseTo(100);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts.at(-1).y).toBeCloseTo(100);
    expect(pts).toHaveLength(101);
    const o = samplePath(letter("О").strokes[0].d);
    expect(o.pts[0].x).toBeCloseTo(25); expect(o.pts.at(-1).x).toBeCloseTo(25); // О is closed
    expect(o.length).toBeGreaterThan(230);
  });

  it("only uses commands it understands", () => {
    for (const c of topic.cards) for (const s of c.strokes) expect(s.d.replace(/[\d.,\s-]/g, "")).toMatch(/^[MLC]+$/);
  });

  it("treats the dots of Ё as dots", () => {
    const g = strokeGeometry(letter("Ё"));
    expect(g.map((s) => s.isDot)).toEqual([false, false, false, false, true, true]);
  });

  it("writes a single point as a visible dot", () => {
    expect(polyD([{ x: 1, y: 2 }])).toBe("M 1 2 l 0.01 0");
  });
});

describe("traceEngine — «Обвожу» on every letter", () => {
  for (const card of topic.cards) {
    it(`${card.id}: each stroke along its path counts, and burns otherwise`, () => {
      strokeGeometry(card).forEach((g, i) => {
        const tag = `${card.id} stroke ${i + 1}`;
        if (g.isDot) {
          expect(run(g, [g.pts[0]]), tag).toBe("done");
          return;
        }
        // along the path, wobbling inside the track → done
        expect(run(g, wobble(g.pts, T * 0.5)), tag).toBe("done");
        // on every track width
        for (const w of ["mid", "narrow"]) expect(run(g, wobble(g.pts, halfWidth(w) * 0.5), halfWidth(w)), `${tag} ${w}`).toBe("done");
        // lifted at half the stroke → burns («слишком рано»)
        expect(run(g, g.pts.slice(0, Math.round(g.pts.length / 2))), tag).toBe("burn");
        // lifted just short of the end, within the slack → done
        const slack = Math.max(TRACE_TUNING.endSlackMin, Math.round(g.length * TRACE_TUNING.endSlack));
        expect(run(g, g.pts.slice(0, g.pts.length - slack + 1)), tag).toBe("done");
        // the wrong way round: either it cannot start there, or it burns at once
        const rev = [...g.pts].reverse();
        expect(["no-start", "burn"], tag).toContain(run(g, rev));
        // leaving the track sideways → burns
        const m = Math.round(g.pts.length / 2), mid = g.pts[m], nb = g.pts[Math.min(m + 1, g.pts.length - 1)];
        const dl = Math.hypot(nb.x - mid.x, nb.y - mid.y) || 1, nx = -(nb.y - mid.y) / dl, ny = (nb.x - mid.x) / dl; // across the path
        const off = g.pts.slice(0, m).concat([1, 2, 3].map((f) => ({ x: mid.x + nx * f * T, y: mid.y + ny * f * T })));
        expect(run(g, off, T, false), tag).toBe("burn");
      });
    });
  }

  it("does not let a finger jump ahead along a stroke", () => {
    const [g] = strokeGeometry(letter("Г")); // палочка 0,0 → 0,100
    expect(run(g, [{ x: 0, y: 0 }, { x: 0, y: 60 }, { x: 0, y: 100 }])).toBe("burn");
  });

  it("О: counter-clockwise from the top counts, clockwise burns", () => {
    const [g] = strokeGeometry(letter("О"));
    const circle = (dir) => Array.from({ length: 81 }, (_, i) => {
      const a = -Math.PI / 2 + dir * (i / 80) * 2 * Math.PI;
      return { x: 25 + 25 * Math.cos(a), y: 50 + 50 * Math.sin(a) };
    });
    expect(run(g, circle(-1))).toBe("done");
    expect(run(g, circle(1))).toBe("burn");
  });

  it("only a touch near the start dot begins a stroke", () => {
    const [g] = strokeGeometry(letter("Н"));
    expect(canStart(g, { x: 0, y: 0 }, T)).toBe(true);
    expect(canStart(g, { x: 0, y: 100 }, T)).toBe(false);
  });
});

describe("traceEngine — «Сам» on every letter", () => {
  for (const card of topic.cards) {
    it(`${card.id}: a whole stroke in its direction counts, half or reversed does not`, () => {
      strokeGeometry(card).forEach((g, i) => {
        const tag = `${card.id} stroke ${i + 1}`;
        if (g.isDot) { expect(matchFreeStroke([g.pts[0]], g, T), tag).toBe(true); return; }
        expect(matchFreeStroke(wobble(g.pts, 3), g, T), tag).toBe(true);
        expect(matchFreeStroke(g.pts.slice(0, Math.round(g.pts.length / 2)), g, T), tag).toBe(false);
        expect(matchFreeStroke([...g.pts].reverse(), g, T), tag).toBe(false);
      });
    });
  }

  it("О: checks the direction along the way, though it starts and ends at the same point", () => {
    const [g] = strokeGeometry(letter("О"));
    const circle = (dir) => Array.from({ length: 81 }, (_, i) => {
      const a = -Math.PI / 2 + dir * (i / 80) * 2 * Math.PI;
      return { x: 25 + 25 * Math.cos(a), y: 50 + 50 * Math.sin(a) };
    });
    expect(matchFreeStroke(circle(-1), g, T)).toBe(true);
    expect(matchFreeStroke(circle(1), g, T)).toBe(false);
  });

  it("does not accept another stroke of the letter in place of this one", () => {
    const [stick, bar] = strokeGeometry(letter("Г"));
    expect(matchFreeStroke(bar.pts, stick, T)).toBe(false);
  });
});
