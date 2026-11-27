import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContentContext, loadTopicLanguages } from "../../../../shared/topic-language-contract.mjs";
import { generateTasks } from "./engine.js";
import { equalExercise, recordOrder, seededRng, skipCountExercise, sumExercise } from "./mechanics.js";
import { resetLessonLevels } from "./levelStore.js";
import Multiplication from "./index.jsx";

const base = resolve("tools/multiplication");
const raw = JSON.parse(await readFile(resolve(base, "topic.json"), "utf8"));
const topic = await loadTopicLanguages(raw, (path) => readFile(resolve(base, path), "utf8"));
const LANGUAGES = ["ru", "sl", "en"];
let root, host;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  resetLessonLevels(); localStorage.clear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

function tasksFor(modeId, language, level = "auto", count = 6) {
  const mode = topic.modes.find((m) => m.id === modeId);
  const context = createContentContext(topic, mode, { contentLanguage: language });
  const pack = topic.languageResources.content[language];
  return { mode, tasks: generateTasks(mode, topic.cards, count, { level }, context, pack) };
}
async function show(mode, task, extra = {}) {
  const props = { task, mode, sessionId: `s-${Math.random()}`, student: { id: "kid" }, soundEnabled: false, onCorrect: vi.fn(), onStreakReset: vi.fn(), ...extra };
  await act(async () => root.render(<Multiplication {...props} />));
  return props;
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const sayText = () => host.querySelector("[data-testid=mul-say]").textContent;

describe("topic package", () => {
  it("declares every mode in all three lesson languages", () => {
    for (const language of LANGUAGES) expect(topic.languageContract.packages[language].modeIds).toEqual(topic.modes.map((m) => m.id));
  });
  it("refuses to build a lesson without the pinned package", () => {
    const mode = topic.modes[0];
    expect(() => generateTasks(mode, topic.cards, 3, {}, null, topic.languageResources.content.ru)).toThrow();
  });
  it("makes a finite lesson of 8 tasks that the strip can count", () => {
    const { tasks } = tasksFor("skip_count", "ru");
    expect(tasks.map((t) => [t.index, t.total])).toEqual(Array.from({ length: 8 }, (_, i) => [i, 8]));
    expect(topic.modes.every((m) => m.finite)).toBe(true);
  });
  it("balances «=» and «≠» without three of a kind in a row", () => {
    const tasks = Array.from({ length: 25 }, () => tasksFor("equal_check", "ru").tasks).flat();
    for (let i = 2; i < tasks.length; i++) if (tasks[i].index >= 2) expect(tasks[i].equal === tasks[i - 1].equal && tasks[i].equal === tasks[i - 2].equal).toBe(false);
    const equal = tasks.filter((t) => t.equal).length;
    expect(equal).toBeGreaterThan(60); expect(equal).toBeLessThan(140);
  });
});

for (const language of LANGUAGES) describe(`lesson in ${language}`, () => {
  it("«Поровну?»: a wrong answer shows the rows and keeps the task, the right one finishes it", async () => {
    const { mode, tasks } = tasksFor("equal_check", language, "A");
    const task = tasks[0];
    const ex = equalExercise("A", task.equal, seededRng(task.seed));
    const props = await show(mode, task);
    expect(sayText()).toBe(task.messages["equal.prompt"]);
    const [eq, ne] = host.querySelectorAll(".mul-shelf button");
    expect([eq.textContent, ne.textContent]).toEqual([task.messages["equal.answer.equal"], task.messages["equal.answer.notEqual"]]);
    await click(ex.counts[0] === ex.counts[1] ? ne : eq);
    expect(props.onStreakReset).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[data-testid=mul-rows]")).toBeNull();
    expect(sayText()).toBe(task.messages["equal.look"]);
    await click(ex.counts[0] === ex.counts[1] ? eq : ne);
    expect(host.querySelector("[data-testid=mul-verdict]").textContent).toBe(task.messages[ex.counts[0] === ex.counts[1] ? "equal.answer.equal" : "equal.answer.notEqual"]);
    expect(props.onCorrect).toHaveBeenCalledWith(task.conceptId, task.cardId);
    expect(host.querySelector(".mul-table--good")).not.toBeNull();
    expect(host.querySelectorAll(".mul-strip .on").length).toBe(task.index + 1);
  });

  it("«Сделай поровну»: tapping from the fullest group to the emptiest finishes the task", async () => {
    vi.useFakeTimers();
    const { mode, tasks } = tasksFor("make_equal", language, "A");
    const props = await show(mode, tasks[0]);
    for (let guard = 0; guard < 10 && !props.onCorrect.mock.calls.length; guard++) {
      const groups = [...host.querySelectorAll("[data-group]")];
      const counts = groups.map((g) => g.querySelectorAll("[data-item]").length);
      const target = counts.reduce((a, b) => a + b, 0) / counts.length;
      await click(groups[counts.findIndex((c) => c > target)]);
      await click(groups[counts.findIndex((c) => c < target)]);
    }
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[data-testid=mul-rows]")).not.toBeNull();
  });

  it("«Считаем группами»: a wrong total counts on from the last number, the right ones finish", async () => {
    vi.useFakeTimers();
    const { mode, tasks } = tasksFor("skip_count", language, "B");
    const task = tasks[0];
    const ex = skipCountExercise("B", seededRng(task.seed));
    const props = await show(mode, task);
    const groups = () => [...host.querySelectorAll(".mul-row .mul-group")];
    for (let i = 0; i < ex.groups; i++) {
      await click(groups()[i]);
      const buttons = [...host.querySelectorAll(".mul-shelf button")];
      if (i === 1) {
        await click(buttons.find((b) => Number(b.textContent) !== ex.size * 2));
        expect(props.onStreakReset).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(3000));
        expect(host.querySelectorAll(".mul-count").length).toBeGreaterThan(0);
      }
      await click([...host.querySelectorAll(".mul-shelf button")].find((b) => Number(b.textContent) === ex.size * (i + 1)));
    }
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(sayText()).toContain(String(ex.size * ex.groups));
  });

  it("«Сложение → умножение»: the record follows the school order and sign of the language", async () => {
    vi.useFakeTimers();
    const { mode, tasks } = tasksFor("sum_to_product", language, "A");
    const task = tasks[0];
    const ex = sumExercise("A", seededRng(task.seed));
    const props = await show(mode, task);
    for (let i = 0; i < ex.groups; i++) await click(host.querySelectorAll(".mul-row .mul-group")[i]);
    await act(async () => vi.advanceTimersByTime(700 * (ex.groups + 2) + 500));
    const record = host.querySelector("[data-testid=mul-record]");
    expect(record).not.toBeNull();
    const order = recordOrder(task.notation.order, ex.size, ex.groups).map((p) => String(p.value));
    expect([...record.querySelectorAll("[data-role]")].map((b) => b.textContent)).toEqual(order);
    expect(record.textContent).toContain(language === "sl" ? "·" : "×");
    for (const role of ex.asks) {
      await click(record.querySelector(`[data-role=${role}]`));
      await act(async () => vi.advanceTimersByTime(1400));
    }
    expect(props.onStreakReset).not.toHaveBeenCalled();
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });
});

describe("independent of the interface language", () => {
  it("keeps Slovenian lesson text whatever the UI says", async () => {
    const { mode, tasks } = tasksFor("equal_check", "sl", "A");
    await show(mode, tasks[0], { uiLanguage: "ru" });
    expect(sayText()).toBe("Je na krožnikih enako?");
    expect(host.querySelector(".mul-root").getAttribute("lang")).toBe("sl");
  });
});

describe("a mistake keeps the task where the child is", () => {
  it("reports in-task mistakes without asking the host to remount (onStreakReset, not onMistake)", async () => {
    vi.useFakeTimers();
    const { mode, tasks } = tasksFor("skip_count", "ru", "B");
    const task = tasks[0];
    const ex = skipCountExercise("B", seededRng(task.seed));
    const props = await show(mode, task, { onMistake: vi.fn() });
    await click(host.querySelectorAll(".mul-row .mul-group")[0]);
    await click([...host.querySelectorAll(".mul-shelf button")].find((b) => Number(b.textContent) === ex.size));
    await click(host.querySelectorAll(".mul-row .mul-group")[1]);
    await click([...host.querySelectorAll(".mul-shelf button")].find((b) => Number(b.textContent) !== ex.size * 2));
    expect(props.onMistake).not.toHaveBeenCalled();
    expect(props.onStreakReset).toHaveBeenCalledTimes(1);
  });
});

describe("an older app (engine without index/total) still shows the lesson", () => {
  it("renders without the lesson strip instead of failing", async () => {
    const { mode, tasks } = tasksFor("equal_check", "ru", "A");
    const { index, total, ...oldTask } = tasks[0];
    expect([index, total]).toEqual([0, 8]);
    await show(mode, oldTask);
    expect(host.querySelector("[data-testid=mul-say]").textContent).toBe(oldTask.messages["equal.prompt"]);
    expect(host.querySelector("[data-testid=mul-strip]")).toBeNull();
    expect(host.querySelectorAll(".mul-shelf button").length).toBe(2);
  });
});
