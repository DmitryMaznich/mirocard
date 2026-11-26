import { describe, it, expect } from "vitest";
import { dictationPlan, normalizeDictationNumbers, resolveDictationParams } from "./dictation.js";
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
  it("creates observation tasks with one visible change", () => {
    const tasks = generateTasks("operation_observe", CARDS, 12, { maxNumber: 5 });

    expect(tasks).toHaveLength(12);
    tasks.forEach((task) => {
      expect(task.type).toBe("operation_observe");
      expect(task.delta).toBe(1);
      expect(task.maxNumber).toBe(5);
      expect(task.answer).toBe(task.result > task.start ? "more" : "less");
      expect(Math.abs(task.result - task.start)).toBe(1);
      expect(task.shape).toBe("circle");
    });
  });

  it("creates name-action tasks with a single change by default", () => {
    const tasks = generateTasks("operation_name_action", CARDS, 30, {});

    expect(tasks).toHaveLength(30);
    tasks.forEach((task) => {
      expect(task.type).toBe("operation_name_action");
      expect(task.delta).toBe(1);
      expect(task.maxNumber).toBe(3);
      expect(task.answerMode).toBe("buttons");
      expect(task.countStep).toBe(false);
      expect(task.start).toBeGreaterThanOrEqual(1);
      expect(task.result).toBeGreaterThanOrEqual(1);
      expect(Math.max(task.start, task.result)).toBeLessThanOrEqual(3);
      expect(task.result).toBe(task.operation === "add" ? task.start + 1 : task.start - 1);
    });
  });

  it("never gives three identical actions in a row in name-action", () => {
    for (let run = 0; run < 20; run += 1) {
      const ops = generateTasks("operation_name_action", CARDS, 15, {}).map((task) => task.operation);
      ops.forEach((op, index) => {
        if (index >= 2) expect(op === ops[index - 1] && op === ops[index - 2]).toBe(false);
      });
    }
  });

  it("keeps the counted change within 1-3 and the range when the count step is on", () => {
    const tasks = generateTasks("operation_name_action", CARDS, 60, { countStep: true, maxNumber: 5, answerMode: "voice" });

    tasks.forEach((task) => {
      expect(task.countStep).toBe(true);
      expect(task.answerMode).toBe("voice");
      expect(task.delta).toBeGreaterThanOrEqual(1);
      expect(task.delta).toBeLessThanOrEqual(3);
      expect(task.countOptions).toContain(task.delta);
      expect(Math.min(task.start, task.result)).toBeGreaterThanOrEqual(1);
      expect(Math.max(task.start, task.result)).toBeLessThanOrEqual(5);
    });
  });

  it("keeps observation tasks in the selected range", () => {
    const tasks = generateTasks("operation_observe", CARDS, 20, { maxNumber: 3 });

    tasks.forEach((task) => {
      expect(task.maxNumber).toBe(3);
      expect(task.start).toBeGreaterThanOrEqual(1);
      expect(task.result).toBeGreaterThanOrEqual(1);
      expect(task.start).toBeLessThanOrEqual(3);
      expect(task.result).toBeLessThanOrEqual(3);
    });
  });

  it("alternates observation directions when both operation cards are selected", () => {
    const tasks = generateTasks("operation_observe", CARDS, 12, { maxNumber: 3 });
    const directions = tasks.map((task) => task.answer);

    expect(directions.filter((direction) => direction === "more")).toHaveLength(6);
    expect(directions.filter((direction) => direction === "less")).toHaveLength(6);
    directions.forEach((direction, index) => {
      if (index > 0) expect(direction).not.toBe(directions[index - 1]);
    });
  });

  it("passes the numeral-support setting to observation tasks", () => {
    const [task] = generateTasks("operation_observe", [CARDS[0]], 1, { showNumerals: true });
    expect(task.showNumerals).toBe(true);
  });

  it("changes the visual material by short blocks when enabled", () => {
    const tasks = generateTasks("operation_observe", CARDS, 9, { shapeMode: "blocks" });
    expect(tasks.map((task) => task.shape)).toEqual([
      "circle", "circle", "circle",
      "square", "square", "square",
      "triangle", "triangle", "triangle",
    ]);
  });

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

describe("operation_chain with several actions", () => {
  it.each([2, 3, 4])("builds %i actions computed left to right, every partial inside the range", (steps) => {
    for (const maxNumber of [5, 10, 20]) {
      const tasks = generateTasks("operation_chain", CARDS, 40, { maxNumber, changeMax: 99, steps });
      expect(tasks.length).toBeGreaterThan(0);
      tasks.forEach((t) => {
        expect(t.steps).toBe(steps);
        expect(t.terms).toHaveLength(steps + 1);
        expect(t.ops).toHaveLength(steps);
        let value = t.terms[0];
        t.ops.forEach((op, i) => {
          value = op === "add" ? value + t.terms[i + 1] : value - t.terms[i + 1];
          expect(t.partials[i]).toBe(value);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(maxNumber);
        });
        expect(t.result).toBe(value);
      });
    }
  });

  it("keeps each change within changeMax and never undoes the previous step", () => {
    const tasks = generateTasks("operation_chain", CARDS, 60, { maxNumber: 10, changeMax: 3, steps: 4 });
    tasks.forEach((t) => {
      t.terms.slice(1).forEach((d) => expect(d).toBeLessThanOrEqual(3));
      t.ops.forEach((op, i) => {
        if (i > 0 && op !== t.ops[i - 1]) expect(t.terms[i + 1]).not.toBe(t.terms[i]);
      });
    });
  });

  it("defaults to two actions", () => {
    const [t] = generateTasks("operation_chain", CARDS, 1, { maxNumber: 10 });
    expect(t.steps).toBe(2);
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

describe("operation_audio", () => {
  const one = (tens, units) => ({ tens, units });
  const nums = (top, bottom) => ({ top, bottom });
  const ok = (t) => {
    expect(t.type).toBe("operation_audio");
    expect(t.operation === "add" ? t.start + t.delta : t.start - t.delta).toBe(t.result);
    expect(t.result).toBeGreaterThanOrEqual(1);
    expect(t.result).toBeLessThanOrEqual(99);
  };

  it("defaults to one-digit addition without crossing a ten (состав до 10)", () => {
    const tasks = generateTasks("operation_audio", CARDS, 30, {});
    expect(tasks).toHaveLength(30);
    tasks.forEach((t) => {
      ok(t);
      expect(t.operation).toBe("add");
      expect(t.start).toBeLessThan(10);
      expect(t.delta).toBeLessThan(10);
      expect(t.result).toBeLessThan(10);
    });
  });

  it("«1» in the tens of the first number gives the teens: 13 − 6 through a ten", () => {
    const tasks = generateTasks("operation_audio", CARDS, 40, {
      operation: "subtract", crossTen: "cross", numbers: nums(one(1, "any"), one("none", "any")),
    });
    tasks.forEach((t) => {
      ok(t);
      expect(t.operation).toBe("subtract");
      expect(t.start).toBeGreaterThanOrEqual(11);
      expect(t.start).toBeLessThanOrEqual(19);
      expect(t.start % 10).toBeLessThan(t.delta);
      expect(t.conceptId).toBe("minus");
    });
  });

  it("a fixed digit drills one fact: + 9", () => {
    const tasks = generateTasks("operation_audio", CARDS, 30, {
      operation: "add", crossTen: "mixed", numbers: nums(one("none", "any"), one("none", 9)),
    });
    tasks.forEach((t) => { ok(t); expect(t.delta).toBe(9); });
  });

  it("«any» never draws a 0, a chosen 0 makes round numbers", () => {
    const any = generateTasks("operation_audio", CARDS, 80, { crossTen: "mixed", numbers: nums(one("any", "any"), one("none", "any")) });
    any.forEach((t) => { ok(t); expect(t.start % 10).not.toBe(0); expect(t.delta).not.toBe(0); });
    const round = generateTasks("operation_audio", CARDS, 30, { numbers: nums(one("any", 0), one("any", 0)) });
    round.forEach((t) => { ok(t); expect(t.start % 10).toBe(0); expect(t.delta % 10).toBe(0); });
  });

  it("mixes both operations with «Микс»", () => {
    const tasks = generateTasks("operation_audio", CARDS, 60, { operation: "mixed", crossTen: "mixed", numbers: nums(one("any", "any"), one("none", "any")) });
    tasks.forEach(ok);
    expect(new Set(tasks.map((t) => t.operation))).toEqual(new Set(["add", "subtract"]));
  });

  it("an impossible ten setting gives way to the digits (40 + 30 «через десяток»)", () => {
    const plan = dictationPlan({ operation: "add", crossTen: "with", numbers: nums(one("any", 0), one("any", 0)) });
    expect(plan.relaxed).toEqual({ add: "with" });
    expect(plan.empty).toBe(false);
  });

  it("cells with no example at all fall back to the default instead of an empty lesson", () => {
    const numbers = nums(one("none", 5), one("none", 7));
    expect(dictationPlan({ operation: "subtract", numbers }).empty).toBe(true);
    const tasks = generateTasks("operation_audio", CARDS, 10, { operation: "subtract", numbers });
    expect(tasks).toHaveLength(10);
    tasks.forEach(ok);
  });

  it("all cells fixed is one example, and the plan says so", () => {
    expect(dictationPlan({ numbers: nums(one(1, 6), one("none", 9)), crossTen: "any" }).single).toBe(true);
  });

  it("maps settings saved before 2026-11-25: «до 20» → teens ± one digit, «до 100» → two-digit numbers", () => {
    expect(resolveDictationParams({ maxNumber: 20, changeMax: 99 })).toEqual({
      operation: "add", crossTen: "any", numbers: nums(one(1, "any"), one("none", "any")),
    });
    expect(resolveDictationParams({ maxNumber: 100 }).numbers).toEqual(nums(one("any", "any"), one("any", "any")));
    const tasks = generateTasks("operation_audio", CARDS, 40, { maxNumber: 20, changeMax: 99 });
    tasks.forEach((t) => { ok(t); expect(t.start).toBeGreaterThanOrEqual(11); expect(t.start).toBeLessThanOrEqual(19); });
  });

  it("«Через десяток» applies to whichever sign: «есть» with «любой» — both actions cross; old values map", () => {
    const tasks = generateTasks("operation_audio", CARDS, 80, {
      operation: "mixed", crossTen: "with", numbers: nums(one("any", "any"), one("none", "any")),
    });
    tasks.forEach((t) => {
      ok(t);
      if (t.operation === "add") expect((t.start % 10) + t.delta).toBeGreaterThanOrEqual(10);
      else expect(t.start % 10).toBeLessThan(t.delta);
    });
    expect(resolveDictationParams({ crossTen: "cross" }).crossTen).toBe("with");
    expect(resolveDictationParams({ crossTen: "mixed" }).crossTen).toBe("any");
  });

  it("with «−» the second number is never longer than the first", () => {
    expect(normalizeDictationNumbers(nums(one("none", "any"), one("any", "any")), "subtract").bottom.tens).toBe("none");
    expect(normalizeDictationNumbers(nums(one("none", "any"), one("any", "any")), "add").bottom.tens).toBe("any");
  });
});
