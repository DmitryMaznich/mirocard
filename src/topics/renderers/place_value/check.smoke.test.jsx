import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import PlaceValueRenderer, { CHECK_MISTAKE_MS } from "./index.jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { checkResultRows, checkTaskText, generateCheckTasks, generateTasks } from "./engine.js";
import PlaceValueCheckResult from "@/features/session/PlaceValueCheckResult.jsx";
import { handleInstantCorrect, handleInstantIncorrect } from "@/features/session/sessionEngine.js";
import { coinHarness } from "./coinTestHelpers.jsx";

const cards = ["identify_number", "build_number", "place_parts", "exchange_ten", "number_names"].map((id) => ({ id, conceptId: id, renderer: "place_value", params: { mode: id } }));

describe("«Проверка» — tasks", () => {
  it("nothing switched on — no tasks", () => {
    expect(generateCheckTasks(cards, { part: "to100" })).toEqual([]);
  });

  it("the switched-on skills share the tasks; pictures take turns; no hints", () => {
    const tasks = generateCheckTasks(cards, { part: "to100", s100_identify: true, s100_build: true, p100_coins: true, p100_table: true, count: 10 });
    expect(tasks).toHaveLength(10);
    const by = (k) => tasks.filter((t) => t.checkSkill === k).length;
    expect(by("s100_identify")).toBe(5);
    expect(by("s100_build")).toBe(5);
    expect(new Set(tasks.map((t) => t.checkView))).toEqual(new Set(["coins", "table"]));
    expect(tasks.every((t) => t.check && t.singleResponse && t.supportMode === "independent" && t.number < 100)).toBe(true);
    expect(tasks.every((t) => t.targetConceptId === `${t.checkSkill}:${t.checkView}`)).toBe(true);
    // Mixed: the same skill twice in a row at most once (the shuffle's tail).
    expect(tasks.filter((t, i) => i && t.checkSkill === tasks[i - 1].checkSkill).length).toBeLessThanOrEqual(1);
  });

  it("plus and minus never on coins; skills without pictures need none", () => {
    const tasks = generateCheckTasks(cards, { part: "to100", s100_exchange: true, s100_parts: true, p100_coins: true, count: 15 });
    expect(tasks).toHaveLength(15);
    expect(tasks.filter((t) => t.checkSkill === "s100_exchange").every((t) => t.view === "scheme")).toBe(true);
    expect(tasks.filter((t) => t.checkSkill === "s100_parts").every((t) => t.checkView === null)).toBe(true);
  });

  it("the hundreds check: three-digit numbers, «what comes next / before»", () => {
    const tasks = generateCheckTasks(cards, { part: "to1000", s1000_identify: true, s1000_count: true, p1000_scheme: true });
    expect(tasks.filter((t) => t.checkSkill === "s1000_identify").every((t) => t.number >= 100)).toBe(true);
    expect(tasks.filter((t) => t.checkSkill === "s1000_count").every((t) => ["next", "prev"].includes(t.task))).toBe(true);
  });

  it("through the mode: the part comes from the mode, hints stay on in the other modes", () => {
    const check = { id: "pv_test_100", type: "pv_test", params: {}, preset: { part: "to100" } };
    expect(generateTasks(check, cards, 500, { s100_names: true })).toHaveLength(10);
    const identify = generateTasks({ id: "identify_number", type: "identify_number", params: {} }, cards, 5, { supportMode: "independent" });
    expect(identify.every((t) => t.supportMode === "learning")).toBe(true);
  });
});

describe("«Проверка» — one answer each, then the session ends", () => {
  const state = (index, count = 3) => ({ mode: { evaluation: "instant", finite: true }, tasks: Array.from({ length: count }, (_, i) => ({ type: "identify_number", singleResponse: true, targetConceptId: `s:${i}` })),
    taskIndex: index, correctCount: 0, incorrectCount: 0, mistakes: [], strictStars: true, startedAt: new Date().toISOString() });
  it("a wrong answer moves on; the last answer ends the session", () => {
    expect(handleInstantIncorrect(state(0), "c", "k")).toMatchObject({ taskIndex: 1, status: "task_active", incorrectCount: 1 });
    expect(handleInstantCorrect(state(2)).status).toBe("completed");
    expect(handleInstantIncorrect(state(2), "c", "k").status).toBe("completed");
    // The child's answer is kept with the statistics; none given — nothing kept.
    const stats = { firstTotal: 0, firstCorrect: 0, corrected: 0, assisted: 0, advancedTasks: 0, concepts: {}, quality: {}, current: null };
    const answer = { skill: "s100_parts", view: null, task: "47 = …", field: "Десятки", given: "4", expected: "40" };
    expect(handleInstantIncorrect({ ...state(0), statistics: stats }, "c", "k", answer).statistics.wrongAnswers).toEqual([answer]);
    expect(handleInstantIncorrect({ ...state(0), statistics: stats }, "c", "k").statistics.wrongAnswers).toBeUndefined();
    // An ordinary instant mode still goes round.
    expect(handleInstantCorrect({ ...state(2), mode: { evaluation: "instant" } }).status).toBe("task_active");
  });
});

describe("«Проверка» — a task on screen", () => {
  const h = coinHarness();
  it("a mistake: no hint shown, the answer stays red a moment, then the next task; taps wait", () => {
    const [task] = generateCheckTasks(cards, { part: "to100", s100_identify: true, p100_table: true, count: 10 });
    const onIncorrect = vi.fn(), onCorrect = vi.fn();
    const container = h.mount((props) => <PlaceValueRenderer {...props} onIncorrect={onIncorrect} sessionParams={{}} />, task, { onCorrect });
    const wrong = task.number === 11 ? 12 : 11;
    for (const d of String(wrong)) h.click(d);
    h.click("Проверить");
    expect(container.querySelector(".pv-check-freeze")).not.toBeNull();
    expect(onIncorrect).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CHECK_MISTAKE_MS));
    expect(onIncorrect).toHaveBeenCalledTimes(1);
    // What the child answered goes with the mistake, for the result.
    expect(onIncorrect.mock.calls[0][2]).toEqual({ skill: "s100_identify", view: "table", task: "Какое это число?", field: null, given: String(wrong), expected: String(task.number) });
    expect(onCorrect).not.toHaveBeenCalled();
  });
});

describe("«Проверка» — result", () => {
  it("the task in words, without its answer", () => {
    expect(checkTaskText({ type: "place_parts", direction: "split", prompt: "digits", number: 47 })).toBe("47 = …");
    expect(checkTaskText({ type: "place_parts", direction: "join", number: 305 })).toBe("300 + 5 = …");
    expect(checkTaskText({ type: "number_names", task: "write", number: 47 })).toBe("Послушай и напиши: «сорок семь»");
    expect(checkTaskText({ type: "count_tens", task: "next", number: 190 })).toBe("Какое число после 190?");
    expect(checkTaskText({ type: "exchange_ten", op: "give", number: 52, k: 7 })).toBe("52 − 7 = …");
  });

  it("lists each mistake: the task, the child's answer, the right one", () => {
    const html = renderToStaticMarkup(<PlaceValueCheckResult session={{ modeId: "pv_test_100", statistics: {
      concepts: { "s100_parts:none": { total: 2, correct: 1 } },
      wrongAnswers: [{ skill: "s100_parts", view: null, task: "47 = …", field: "Десятки", given: "4", expected: "40" }],
    } }} modes={[]} />);
    expect(html).toContain("Ошибки");
    expect(html).toContain("47 = …");
    expect(html).toContain("Десятки: 4");
    expect(html).toContain("верно: 40");
  });

  it("adds up by skill and by picture", () => {
    const { skills, views } = checkResultRows({
      "s100_identify:coins": { total: 2, correct: 2 }, "s100_identify:table": { total: 2, correct: 1 },
      "s100_parts:none": { total: 3, correct: 1 },
    });
    expect(skills.get("s100_identify")).toEqual({ total: 4, correct: 3 });
    expect(skills.get("s100_parts")).toEqual({ total: 3, correct: 1 });
    expect(views.get("table")).toEqual({ total: 2, correct: 1 });
    expect(views.has("none")).toBe(false);
  });
});
