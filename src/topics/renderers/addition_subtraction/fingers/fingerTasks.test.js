import { describe, it, expect } from "vitest";
import { FINGER_MAP, getFingerConfig, getRemoveMode } from "./FingerSystem.js";
import fs from "fs";
import { generateFingerTasks, generateFingersShowTasks, fingerSplits, FINGER_CARDS, HAND_POSES, handPoseImage } from "./fingerTasks.js";

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

  it("Обучение: 0..10 in order, one round (the mode loops)", () => {
    const tasks = generateFingersShowTasks({});
    expect(tasks.map(t => t.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(tasks.every(t => t.variant === "learn")).toBe(true);
  });

  it("Цифра → пальцы: shuffled rounds of 0..10, never the same number twice in a row", () => {
    const tasks = generateFingersShowTasks({ task: "show" });
    expect(tasks.length).toBe(110);
    for (let r = 0; r < 10; r++) {
      expect(tasks.slice(r * 11, r * 11 + 11).map(t => t.n).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
    for (let i = 1; i < tasks.length; i++) expect(tasks[i].n).not.toBe(tasks[i - 1].n);
    expect(tasks.every(t => t.variant === "show" && t.conceptId === `fshow_${t.n}`)).toBe(true);
    expect(tasks.slice(0, 11).map(t => t.n)).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("Пальцы → цифра: 1..10, hands add up to n, splits vary", () => {
    const tasks = generateFingersShowTasks({ task: "recognize" });
    expect(tasks.length).toBe(100);
    for (const t of tasks) {
      expect(t.variant).toBe("recognize");
      expect(t.left + t.right).toBe(t.n);
      expect(t.left).toBeLessThanOrEqual(5);
      expect(t.right).toBeLessThanOrEqual(5);
      expect(t.n).toBeGreaterThan(0);
    }
    const fives = new Set(tasks.filter(t => t.n === 5).map(t => `${t.left}+${t.right}`));
    expect(fives.size).toBeGreaterThan(1);
  });

  it("Пальцы → цифра: each hand's fingers match its count, and other fingers than the canonical ones come up", () => {
    const tasks = generateFingersShowTasks({ task: "recognize" });
    for (const t of tasks) {
      expect(t.leftPose.length).toBe(t.left);
      expect(t.rightPose.length).toBe(t.right);
    }
    const poses = new Set(tasks.flatMap(t => [t.leftPose, t.rightPose]));
    expect(poses.has("ti") || poses.has("tp") || poses.has("ip")).toBe(true);
  });

  it("every hand pose has its drawing, the middle finger alone is never one", () => {
    for (const [count, poses] of Object.entries(HAND_POSES)) {
      for (const pose of poses) {
        expect(pose.length).toBe(Number(count));
        expect(fs.existsSync(`public/${handPoseImage(pose)}`)).toBe(true);
      }
    }
    expect(HAND_POSES[1]).not.toContain("m");
  });

  it("fingerSplits lists every way to split n over two hands", () => {
    expect(fingerSplits(5)).toHaveLength(6);
    expect(fingerSplits(10)).toEqual([{ left: 5, right: 5 }]);
    expect(fingerSplits(8).map(s => s.left)).toEqual([3, 4, 5]);
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
