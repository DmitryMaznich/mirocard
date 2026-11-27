import { describe, expect, it } from "vitest";
import {
  LEVELS, equalExercise, makeEqualExercise, minMoves, nextLevel, recordOrder, seededRng,
  skipChoices, skipCountExercise, sumExercise,
} from "./mechanics.js";

const runs = (fn, times = 300) => Array.from({ length: times }, (_, i) => fn(seededRng(i + 1)));

describe("«Поровну?» exercises", () => {
  it("are equal when asked, and differ by the level's amount otherwise", () => {
    for (const level of LEVELS.equal_check) {
      for (const ex of runs((rng) => equalExercise(level, true, rng))) expect(ex.counts[0]).toBe(ex.counts[1]);
      for (const ex of runs((rng) => equalExercise(level, false, rng))) {
        const diff = Math.abs(ex.counts[0] - ex.counts[1]);
        if (level === "A") expect(diff).toBeGreaterThanOrEqual(2);
        else expect(diff).toBe(1);
        expect(ex.scatter).toBe(level === "D");
      }
    }
  });
});

describe("«Сделай поровну» exercises", () => {
  it("always have exactly one solution reachable in the declared number of moves", () => {
    for (const level of LEVELS.make_equal) {
      for (const ex of runs((rng) => makeEqualExercise(level, rng))) {
        const total = ex.counts.reduce((a, b) => a + b, 0);
        expect(total).toBe(ex.target * ex.counts.length);
        expect(ex.counts.some((c) => c !== ex.target)).toBe(true);
        expect(minMoves(ex.counts, ex.target)).toBe(ex.min);
        expect(ex.counts.length).toBe({ R: 2, A: 2, B: 2, C: 3 }[level] ?? ex.counts.length);
        if (level === "R" || level === "A") expect(ex.min).toBe(1);
        if (level === "B") expect(ex.min).toBe(2);
      }
    }
  });
});

describe("«Считаем группами»", () => {
  it("starts with 2s and 5s on plates with apples, varies groups from level B", () => {
    for (const ex of runs((rng) => skipCountExercise("R", rng))) { expect([2, 5]).toContain(ex.size); expect(ex.kind).toBe("apple"); }
    const kinds = new Set(runs((rng) => skipCountExercise("C", rng)).map((ex) => ex.kind));
    expect(kinds).toEqual(new Set(["apple", "banana", "egg"]));
    for (const ex of runs((rng) => skipCountExercise("D", rng))) if (ex.kind === "banana") expect(ex.size).toBeLessThanOrEqual(3);
  });
  it("offers the right total among typical mistakes", () => {
    for (const level of ["A", "B", "C"]) for (const rng of runs((r) => r, 50)) {
      const choices = skipChoices(level, 3, 2, rng);
      expect(choices).toContain(9);
      expect(choices).toContain(7); // прибавил одно вместо группы
      expect(choices.length).toBe(level === "A" ? 2 : 3);
    }
  });
});

describe("«Сложение → умножение»", () => {
  it("never uses a × a, keeps products up to 20, gives three distinct choices on C", () => {
    for (const level of LEVELS.sum_to_product) for (const ex of runs((rng) => sumExercise(level, rng))) {
      expect(ex.size).not.toBe(ex.groups);
      expect(ex.size * ex.groups).toBeLessThanOrEqual(20);
      if (level === "C") { expect(new Set(ex.choices).size).toBe(3); expect(ex.choices).toContain(ex.hide === "size" ? ex.size : ex.groups); }
      if (level === "A" || level === "B") expect([...ex.asks].sort()).toEqual(["groups", "size"]);
    }
  });
  it("writes the record in the order of the lesson language's school", () => {
    expect(recordOrder("size-first", 3, 4).map((p) => p.value)).toEqual([3, 4]);
    expect(recordOrder("groups-first", 3, 4).map((p) => p.value)).toEqual([4, 3]);
  });
});

describe("level within a lesson", () => {
  const start = (modeId, level) => ({ level, history: [], strike: 0, rowsAlways: true, modeId });
  it("goes up after 8 clean of the last 10", () => {
    let s = start("skip_count", "R");
    for (let i = 0; i < 10; i++) s = nextLevel("skip_count", s, { clean: i % 5 !== 0, down: false });
    expect(s.level).toBe("A");
  });
  it("goes down after two bad tasks in a row, and «Поровну?» after any mistake", () => {
    let s = start("skip_count", "B");
    s = nextLevel("skip_count", s, { clean: false, down: true });
    expect(s.level).toBe("B");
    s = nextLevel("skip_count", s, { clean: false, down: true });
    expect(s.level).toBe("A");
    expect(nextLevel("equal_check", start("equal_check", "B"), { clean: false, down: true }).level).toBe("A");
  });
  it("«Поровну?» starts at A (no level R since 2026-11-27) and moves up to B", () => {
    expect(LEVELS.equal_check[0]).toBe("A");
    let s = start("equal_check", "A");
    for (let i = 0; i < 10; i++) s = nextLevel("equal_check", s, { clean: true, down: false });
    expect(s.level).toBe("B");
  });
});
