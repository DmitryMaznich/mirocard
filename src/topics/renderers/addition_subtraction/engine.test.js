import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  {
    id: "operation_plus",
    conceptId: "plus",
    primary: true,
    label: "Плюс",
    renderer: "addition_subtraction",
    params: { operation: "add" },
  },
  {
    id: "operation_minus",
    conceptId: "minus",
    primary: true,
    label: "Минус",
    renderer: "addition_subtraction",
    params: { operation: "subtract" },
  },
];

describe("addition_subtraction engine", () => {
  it("generates requested task count", () => {
    const tasks = generateTasks("operation_result", CARDS, 12, {});
    expect(tasks).toHaveLength(12);
  });

  it("keeps addition tasks arithmetically valid", () => {
    const tasks = generateTasks("operation_result", [CARDS[0]], 10, { maxNumber: 10, changeMax: 2 });
    expect(tasks.every((task) => task.operation === "add")).toBe(true);
    expect(tasks.every((task) => task.start + task.delta === task.result)).toBe(true);
    expect(tasks.every((task) => task.result <= 10)).toBe(true);
  });

  it("keeps subtraction tasks arithmetically valid", () => {
    const tasks = generateTasks("operation_result", [CARDS[1]], 10, { maxNumber: 10, changeMax: 2 });
    expect(tasks.every((task) => task.operation === "subtract")).toBe(true);
    expect(tasks.every((task) => task.start - task.delta === task.result)).toBe(true);
    expect(tasks.every((task) => task.result >= 1)).toBe(true);
  });

  it("can include zero when requested", () => {
    const tasks = generateTasks("operation_result", [CARDS[1]], 20, { maxNumber: 3, changeMax: 3, includeZero: true });
    expect(tasks.every((task) => task.result >= 0)).toBe(true);
  });

  it("provides result options containing the answer", () => {
    const [task] = generateTasks("operation_result", CARDS, 1, {});
    expect(task.resultOptions).toContain(task.result);
    expect(new Set(task.resultOptions).size).toBe(task.resultOptions.length);
  });

  it("accepts a mode object from the session engine", () => {
    const [task] = generateTasks({ id: "operation_missing_sign", type: "operation_missing_sign" }, CARDS, 1, {});
    expect(task.type).toBe("operation_missing_sign");
  });

  it("marks first drill tasks with a sign-action direction", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 12, {});
    expect(tasks.every((task) => ["sign_to_action", "action_to_sign"].includes(task.associationDirection))).toBe(true);
  });
});

describe("operation_action_from_sign direction param", () => {
  it("alternating: both directions present", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 10, { direction: "alternating" });
    const dirs = tasks.map((t) => t.associationDirection);
    expect(dirs.every((d) => ["sign_to_action", "action_to_sign"].includes(d))).toBe(true);
    expect(dirs.filter((d) => d === "sign_to_action").length).toBeGreaterThan(0);
    expect(dirs.filter((d) => d === "action_to_sign").length).toBeGreaterThan(0);
  });

  it("sign_to_action: all tasks have sign_to_action direction", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 8, { direction: "sign_to_action" });
    expect(tasks.every((t) => t.associationDirection === "sign_to_action")).toBe(true);
  });

  it("action_to_sign: all tasks have action_to_sign direction", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 8, { direction: "action_to_sign" });
    expect(tasks.every((t) => t.associationDirection === "action_to_sign")).toBe(true);
  });

  it("default direction is alternating (both values present)", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 10, {});
    const dirs = tasks.map((t) => t.associationDirection);
    expect(dirs.filter((d) => d === "sign_to_action").length).toBeGreaterThan(0);
    expect(dirs.filter((d) => d === "action_to_sign").length).toBeGreaterThan(0);
  });
});
