import { describe, it, expect } from "vitest";
import { FINGER_MAP, getFingerConfig, getRemoveMode } from "./FingerSystem.js";
import { generateFingerTasks, FINGER_CARDS } from "./fingerTasks.js";

describe("FingerSystem", () => {
  it("FINGER_MAP has 11 entries 0..10", () => {
    for (let i = 0; i <= 10; i++) expect(FINGER_MAP[i]).toBeDefined();
  });

  it("right >= left for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right).toBeGreaterThanOrEqual(left);
    }
  });

  it("right hand fills to 5 before the left hand is used (5-structure)", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right).toBe(Math.min(i, 5));
      expect(left).toBe(Math.max(i - 5, 0));
    }
  });

  it("right + left === n for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right + left).toBe(i);
    }
  });

  it("getFingerConfig(7) returns {right:5, left:2}", () => {
    expect(getFingerConfig(7)).toEqual({ right: 5, left: 2 });
  });

  it("getRemoveMode: b matches left → removeMode hand left", () => {
    expect(getRemoveMode(7, 2)).toEqual({ removeMode: "hand", removeHand: "left" });
  });

  it("getRemoveMode: b matches right → removeMode hand right", () => {
    expect(getRemoveMode(7, 5)).toEqual({ removeMode: "hand", removeHand: "right" });
  });

  it("getRemoveMode: b matches neither → fold", () => {
    expect(getRemoveMode(7, 3)).toEqual({ removeMode: "fold" });
  });
});

const CARDS = [
  { id: "fshow_3",      conceptId: "fshow_3",      params: { mode: "fingers_show",  n: 3 } },
  { id: "fshow_7",      conceptId: "fshow_7",      params: { mode: "fingers_show",  n: 7 } },
  { id: "fcount_a_3_4", conceptId: "fcount_a_3_4", params: { mode: "fingers_count", op: "add", a: 3, b: 4 } },
  { id: "fcount_s_7_2", conceptId: "fcount_s_7_2", params: { mode: "fingers_count", op: "sub", a: 7, b: 2 } },
];

describe("generateTasks – fingers_show", () => {
  it("returns tasks of type fingers_show", () => {
    const tasks = generateFingerTasks("fingers_show", 4, {}, CARDS);
    expect(tasks.every(t => t.type === "fingers_show")).toBe(true);
  });

  it("task.n matches card.params.n", () => {
    const tasks = generateFingerTasks("fingers_show", 2, {}, CARDS);
    expect(tasks[0].n).toBeDefined();
  });

});

describe("generateTasks – fingers_count", () => {
  it("returns tasks of type fingers_count", () => {
    const tasks = generateFingerTasks("fingers_count", 4, {}, CARDS);
    expect(tasks.every(t => t.type === "fingers_count")).toBe(true);
  });

  it("add task: result = a + b", () => {
    const tasks = generateFingerTasks("fingers_count", 4, {}, CARDS);
    const addTasks = tasks.filter(t => t.op === "add");
    for (const t of addTasks) expect(t.result).toBe(t.a + t.b);
  });

  it("sub task: has removeMode", () => {
    const tasks = generateFingerTasks("fingers_count", 4, {}, CARDS);
    const subTasks = tasks.filter(t => t.op === "sub");
    for (const t of subTasks) expect(t.removeMode).toMatch(/^hand|fold$/);
  });

  it("sub task 7-2: removeMode hand, removeHand left", () => {
    const tasks = generateFingerTasks("fingers_count", 10, {}, CARDS);
    const t = tasks.find(t => t.op === "sub" && t.a === 7 && t.b === 2);
    expect(t?.removeMode).toBe("hand");
    expect(t?.removeHand).toBe("left");
  });
});

describe("FINGER_CARDS", () => {
  it("covers 0..10 for showing and the former deck's add/sub examples", () => {
    expect(FINGER_CARDS.filter(c => c.params.mode === "fingers_show").map(c => c.params.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const count = FINGER_CARDS.filter(c => c.params.mode === "fingers_count");
    expect(count.length).toBe(82);
    for (const c of count) expect(c.id).toBe(`fcount_${c.params.op === "add" ? "a" : "s"}_${c.params.a}_${c.params.b}`);
  });

  it("default pool honours the op filter", () => {
    const tasks = generateFingerTasks("fingers_count", 20, { op: "sub" });
    expect(tasks.length).toBe(20);
    expect(tasks.every(t => t.op === "sub")).toBe(true);
  });
});
