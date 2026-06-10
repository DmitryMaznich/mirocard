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

describe("operation_find_sign", () => {
  it("task has sign as answer field", () => {
    const tasks = generateTasks("operation_find_sign", CARDS, 5, { maxNumber: 10 });
    expect(tasks.every((t) => t.type === "operation_find_sign")).toBe(true);
    expect(tasks.every((t) => ["+", "-"].includes(t.sign))).toBe(true);
  });

  it("passes showHelper param to task", () => {
    const [task] = generateTasks("operation_find_sign", CARDS, 1, { showHelper: true });
    expect(task.showHelper).toBe(true);
  });
});

describe("operation_result params", () => {
  it("passes inputMode and timer to task", () => {
    const [task] = generateTasks("operation_result", CARDS, 1, { inputMode: "pad", timer: 10 });
    expect(task.inputMode).toBe("pad");
    expect(task.timer).toBe(10);
  });

  it("inputMode defaults to choices", () => {
    const [task] = generateTasks("operation_result", CARDS, 1, {});
    expect(task.inputMode).toBe("choices");
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

describe("operation_chain", () => {
  it("generates tasks with operation_chain type", () => {
    const tasks = generateTasks("operation_chain", CARDS, 5, { maxNumber: 10, changeMax: 3 });
    expect(tasks.every((t) => t.type === "operation_chain")).toBe(true);
  });

  it("chain arithmetic is valid: A opAB B opBC C = result", () => {
    const tasks = generateTasks("operation_chain", CARDS, 20, { maxNumber: 10, changeMax: 3 });
    tasks.forEach((t) => {
      const inter = t.opAB === "add" ? t.A + t.B : t.A - t.B;
      const res = t.opBC === "add" ? inter + t.C : inter - t.C;
      expect(res).toBe(t.result);
    });
  });

  it("result is within [1, maxNumber] by default", () => {
    const tasks = generateTasks("operation_chain", CARDS, 20, { maxNumber: 10, changeMax: 3 });
    tasks.forEach((t) => {
      expect(t.result).toBeGreaterThanOrEqual(1);
      expect(t.result).toBeLessThanOrEqual(10);
    });
  });

  it("result is within [0, maxNumber] when includeZero", () => {
    const tasks = generateTasks("operation_chain", CARDS, 20, { maxNumber: 10, changeMax: 3, includeZero: true });
    tasks.forEach((t) => {
      expect(t.result).toBeGreaterThanOrEqual(0);
      expect(t.result).toBeLessThanOrEqual(10);
    });
  });

  it("resultOptions contain the answer", () => {
    const tasks = generateTasks("operation_chain", CARDS, 5, { maxNumber: 10 });
    tasks.forEach((t) => {
      expect(t.resultOptions).toContain(t.result);
    });
  });

  it("task has A, B, C, opAB, signAB, opBC, signBC, intermediate fields", () => {
    const [t] = generateTasks("operation_chain", CARDS, 1, { maxNumber: 10 });
    expect(typeof t.A).toBe("number");
    expect(typeof t.B).toBe("number");
    expect(typeof t.C).toBe("number");
    expect(["add", "subtract"]).toContain(t.opAB);
    expect(["add", "subtract"]).toContain(t.opBC);
    expect(["+", "-"]).toContain(t.signAB);
    expect(["+", "-"]).toContain(t.signBC);
    expect(typeof t.intermediate).toBe("number");
  });
});

describe("operation_missing_term", () => {
  it("generates tasks with operation_missing_term type", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 5, { operation: "add" });
    expect(tasks.every((t) => t.type === "operation_missing_term")).toBe(true);
  });

  it("right+add: A + ? = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "add", unknownPosition: "right", maxNumber: 10, changeMax: 3,
    });
    const rightAdd = tasks.filter((t) => t.missingPosition === "right" && t.operation === "add");
    expect(rightAdd.length).toBeGreaterThan(0);
    rightAdd.forEach((t) => {
      expect(t.A).not.toBeNull();
      expect(t.B).toBeNull();
      expect(t.A + t.answer).toBe(t.C);
      expect(t.C).toBeLessThanOrEqual(10);
      expect(t.answer).toBeGreaterThanOrEqual(1);
    });
  });

  it("left+add: ? + B = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "add", unknownPosition: "left", maxNumber: 10, changeMax: 3,
    });
    tasks.forEach((t) => {
      expect(t.A).toBeNull();
      expect(t.B).not.toBeNull();
      expect(t.answer + t.B).toBe(t.C);
      expect(t.C).toBeLessThanOrEqual(10);
      expect(t.answer).toBeGreaterThanOrEqual(1);
    });
  });

  it("right+subtract: A - ? = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "subtract", unknownPosition: "right", maxNumber: 10, changeMax: 3,
    });
    tasks.forEach((t) => {
      expect(t.A).not.toBeNull();
      expect(t.B).toBeNull();
      expect(t.A - t.answer).toBe(t.C);
      expect(t.C).toBeGreaterThanOrEqual(1);
      expect(t.answer).toBeGreaterThanOrEqual(1);
    });
  });

  it("left+subtract: ? - B = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "subtract", unknownPosition: "left", maxNumber: 10, changeMax: 3,
    });
    tasks.forEach((t) => {
      expect(t.A).toBeNull();
      expect(t.B).not.toBeNull();
      expect(t.answer - t.B).toBe(t.C);
      expect(t.answer).toBeLessThanOrEqual(10);
      expect(t.C).toBeGreaterThanOrEqual(1);
    });
  });

  it("both: alternates left and right positions", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "add", unknownPosition: "both", maxNumber: 10,
    });
    const positions = tasks.map((t) => t.missingPosition);
    expect(positions).toContain("left");
    expect(positions).toContain("right");
  });

  it("mixed operation: produces both add and subtract tasks", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "mixed", unknownPosition: "right", maxNumber: 10,
    });
    const ops = tasks.map((t) => t.operation);
    expect(ops).toContain("add");
    expect(ops).toContain("subtract");
  });

  it("resultOptions contain the answer", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 5, { operation: "add", maxNumber: 10 });
    tasks.forEach((t) => {
      expect(t.resultOptions).toContain(t.answer);
      expect(new Set(t.resultOptions).size).toBe(t.resultOptions.length);
    });
  });

  it("passes inputMode and showHelper to task", () => {
    const [t] = generateTasks("operation_missing_term", CARDS, 1, {
      operation: "add", inputMode: "pad", showHelper: true,
    });
    expect(t.inputMode).toBe("pad");
    expect(t.showHelper).toBe(true);
  });

  it("generates requested count", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 8, { operation: "mixed", maxNumber: 10 });
    expect(tasks).toHaveLength(8);
  });
});
