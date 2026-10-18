import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import CountTensTask from "./CountTensTask.jsx";
import { countTensOptions, generateTasks } from "./engine.js";
import { PHRASE_AUDIO } from "./numberAudio.js";
import { coinHarness } from "./coinTestHelpers.jsx";
import { existsSync } from "node:fs";

const wait = (ms = 5000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("«Считаем десятками» — «Смотри и считай»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const task = (extra = {}) => ({ type: "count_tens", cardId: "c", conceptId: "c", task: "count", number: 70, start: 70, end: 120, supportMode: "independent", ...extra });

  it("«Как показываем»: coins — stacks and a plate; scheme — sticks and a square", async () => {
    h.mount(CountTensTask, task({ number: 170, start: 170, end: 220 }));
    await wait();
    expect(count(".ct-ten .cb-ten-stack")).toBe(7);
    expect(count(".ct-squares > .cb-plate")).toBe(1);
    h.mount(CountTensTask, task({ number: 170, start: 170, end: 220, view: "scheme" }));
    await wait();
    expect(count(".ct-ten .cb-stick")).toBe(7);
    expect(count(".ct-squares .cb-square")).toBe(1);
    expect(count(".cb-ten-stack")).toBe(0);
  });

  it("counts by tens; the tenth ten has to be folded into a hundred by the child", async () => {
    const onCorrect = vi.fn();
    h.mount(CountTensTask, task(), { onCorrect });
    await wait();
    expect(text(".ct-number")).toBe("70");
    expect(count(".ct-ten")).toBe(7);
    h.click("+1 десяток"); await wait();
    await wait();
    expect(text(".ct-number")).toBe("80");
    expect(text(".ct-caption")).toBe("восемьдесят · 8 десятков");
    h.click("+1 десяток"); await wait();
    await wait();
    h.click("+1 десяток"); await wait();
    await wait();
    // Ten sticks, no number, no «+1 десяток» — only «Сложи сотню».
    expect(count(".ct-ten")).toBe(10);
    expect(count(".ct-squares > .cb-plate")).toBe(0);
    expect(text(".ct-number")).toBe("?");
    expect(h.button("+1 десяток")).toBeUndefined();
    h.click("Сложи сотню"); await wait();
    await wait();
    expect(count(".ct-squares > .cb-plate")).toBe(1);
    expect(count(".ct-ten")).toBe(0);
    expect(text(".ct-number")).toBe("100");
    expect(text(".ct-fold-say")).toBe("10 десятков = 1 сотня");
    expect(text(".ct-caption")).toBe("сто · 1 сотня");
    h.click("+1 десяток"); await wait();
    await wait();
    expect(text(".ct-caption")).toBe("сто десять · 1 сотня и 1 десяток");
    h.click("+1 десяток"); await wait();
    await wait();
    expect(text(".ct-number")).toBe("120");
    expect(text(".sg-status-say")).toBe("70 · 80 · 90 · 100 · 110 · 120");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
  });

  it("«Обучение»: the number waits so the child can say it first", async () => {
    h.mount(CountTensTask, task({ supportMode: "learning" }));
    await wait();
    h.click("+1 десяток");
    await wait(100);
    expect(text(".ct-number")).toBe("?");
    expect(h.button("+1 десяток").disabled).toBe(true);
    await wait();
    expect(text(".ct-number")).toBe("80");
  });

  it("every phrase has its recording", async () => {
    for (const key of Object.keys(PHRASE_AUDIO)) expect(existsSync(`public/audio/place-value-numbers/p-${key}.mp3`)).toBe(true);
    expect(PHRASE_AUDIO.fold).not.toMatch(/сто\b/i);
  });
});

describe("«Считаем десятками» — «Какое число дальше?»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const task = (extra = {}) => ({ type: "count_tens", cardId: "c", conceptId: "c", task: "next", number: 90, options: [91, 100, 900], supportMode: "learning", ...extra });

  it("the mistakes that matter are among the choices", async () => {
    expect(countTensOptions(90).sort((a, b) => a - b)).toEqual([91, 100, 900]);
    expect(countTensOptions(100).sort((a, b) => a - b)).toEqual([101, 110, 1010]);
    expect(countTensOptions(190).sort((a, b) => a - b)).toEqual([191, 200, 290]);
    expect(countTensOptions(130).sort((a, b) => a - b)).toEqual([131, 140, 230]);
  });

  it("«Обучение»: a wrong choice is explained; the right one folds the hundred", async () => {
    const onMistake = vi.fn(), onCorrect = vi.fn();
    h.mount(CountTensTask, task(), { onMistake, onCorrect });
    await wait();
    expect(text(".ct-chain")).toBe("70 · 80 · 90 · ?");
    h.click("91");
    await wait();
    expect(text(".sg-status-note")).toBe("91 — это 90 и 1 единица. А мы прибавляем десяток. Десять десятков — это сотня.");
    h.click("900");
    await wait();
    expect(text(".sg-status-note")).toContain("900 — это девятьсот, 9 сотен.");
    expect(onMistake).toHaveBeenCalledTimes(2);
    h.click("100");
    await wait();
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    expect(h.container.querySelectorAll(".ct-squares > .cb-plate")).toHaveLength(1);
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("«1010» after 100 is told apart by its digit count", async () => {
    h.mount(CountTensTask, task({ number: 100, options: [101, 110, 1010] }));
    await wait();
    h.click("1010");
    await wait();
    expect(text(".sg-status-note")).toBe("В числе 1010 четыре цифры. Сто десять — это 1 сотня и 1 десяток: три цифры.");
    expect(h.container.querySelector(".ct-ten--ghost")).not.toBeNull();
  });

  it("engine: the first count is 0 → 100, the rest are short stretches across a hundred", async () => {
    const tasks = generateTasks("count_tens", [], 30, {});
    expect(tasks[0]).toMatchObject({ start: 0, end: 100, task: "count", cardId: "count_tens" });
    for (const t of tasks.slice(1)) {
      const h100 = Math.ceil((t.start + 1) / 100) * 100;
      expect(t.start < h100 && t.end > h100 && h100 <= 200).toBe(true);
      expect((t.end - t.start) / 10).toBeLessThanOrEqual(8);
    }
    const next = generateTasks("count_tens", [], 60, { task: "next", range: "to1000" });
    expect(next.every((t) => t.options.includes(t.number + 10) && t.options.length === 3)).toBe(true);
    expect(next.some((t) => t.number % 100 === 90)).toBe(true);
  });
});

describe("«Считаем десятками» — «Считаем назад»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const task = (extra = {}) => ({ type: "count_tens", cardId: "c", conceptId: "c", task: "back", number: 120, start: 120, end: 80, supportMode: "independent", ...extra });

  it("at a round hundred there are no tens: the child unfolds the hundred, the number stays", async () => {
    const onCorrect = vi.fn();
    h.mount(CountTensTask, task(), { onCorrect });
    await wait();
    expect(text(".sg-title")).toBe("Считаем назад");
    h.click("−1 десяток"); await wait();
    await wait();
    h.click("−1 десяток"); await wait();
    await wait();
    expect(text(".ct-number")).toBe("100");
    expect(count(".ct-ten")).toBe(0);
    h.click("−1 десяток"); await wait();
    await wait();
    // Nothing taken: the column is empty, the number is still 100.
    expect(text(".ct-number")).toBe("100");
    expect(text(".sg-status-note")).toBe("Десятков нет. Разложи сотню.");
    expect(h.button("−1 десяток")).toBeUndefined();
    h.click("Разложи сотню"); await wait();
    await wait();
    expect(count(".ct-squares > .cb-plate")).toBe(0);
    expect(count(".ct-ten")).toBe(10);
    expect(text(".ct-number")).toBe("100");
    expect(text(".ct-caption")).toBe("сто · 10 десятков");
    expect(text(".ct-fold-say")).toBe("1 сотня = 10 десятков");
    h.click("−1 десяток"); await wait();
    await wait();
    expect(text(".ct-number")).toBe("90");
    expect(count(".ct-ten")).toBe(9);
    h.click("−1 десяток"); await wait();
    await wait();
    expect(text(".sg-status-say")).toBe("120 · 110 · 100 · 90 · 80");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("200 unfolded is «1 сотня и 10 десятков»", async () => {
    h.mount(CountTensTask, task({ number: 200, start: 200, end: 170 }));
    await wait();
    h.click("−1 десяток"); await wait();
    await wait();
    h.click("Разложи сотню"); await wait();
    await wait();
    expect(text(".ct-caption")).toBe("двести · 1 сотня и 10 десятков");
    expect(count(".ct-squares > .cb-plate")).toBe(1);
  });

  it("engine: stretches go down across a hundred", async () => {
    const tasks = generateTasks("count_tens", [], 30, { task: "back", range: "to1000" });
    for (const t of tasks) {
      const h100 = Math.floor((t.start - 1) / 100) * 100;
      expect(t.task).toBe("back");
      expect(t.start > h100 && t.end < h100 && h100 >= 100).toBe(true);
    }
  });
});

describe("A tap cuts the voice", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;

  it("a tap while the voice speaks works at once and silences it", async () => {
    const { registerSpeech, isSpeaking } = await import("./numberAudio.js");
    h.mount(CountTensTask, { type: "count_tens", cardId: "c", conceptId: "c", task: "count", number: 70, start: 70, end: 120, supportMode: "independent" });
    await wait();
    // A voice that would go on until stopped.
    const stopped = vi.fn();
    const unregister = registerSpeech(() => { stopped(); unregister(); });
    expect(isSpeaking()).toBe(true);
    h.click("+1 десяток");
    expect(stopped).toHaveBeenCalled();
    await wait();
    expect(text(".ct-number")).toBe("80");
  });

  it("«Какое число дальше?»: the answer can be given while the count is still heard", async () => {
    const onCorrect = vi.fn();
    h.mount(CountTensTask, { type: "count_tens", cardId: "c", conceptId: "c", task: "next", number: 90, options: [91, 100, 900], supportMode: "learning" }, { onCorrect });
    h.click("100");
    expect(h.button("100").className).toContain("ct-option--right");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("stop releases a clip", () => {
    return import("./numberAudio.js").then(({ playNumber, isSpeaking }) => {
      const clip = playNumber(90);
      expect(isSpeaking()).toBe(true);
      clip.stop();
      expect(isSpeaking()).toBe(false);
    });
  });
});

describe("«Считаем десятками» — «Какое число перед?»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const task = (extra = {}) => ({ type: "count_tens", cardId: "c", conceptId: "c", task: "prev", number: 100, options: [99, 90, 0], supportMode: "learning", ...extra });

  it("the mistakes that matter are among the choices", async () => {
    const { countTensPrevOptions } = await import("./engine.js");
    expect(countTensPrevOptions(100).sort((a, b) => a - b)).toEqual([0, 90, 99]);
    expect(countTensPrevOptions(110).sort((a, b) => a - b)).toEqual([10, 100, 109]);
    expect(countTensPrevOptions(240).sort((a, b) => a - b)).toEqual([140, 230, 239]);
  });

  it("«Обучение»: 99 is explained, the hundred is shown unfolded with the ten to take dashed", async () => {
    const onMistake = vi.fn(), onCorrect = vi.fn();
    h.mount(CountTensTask, task(), { onMistake, onCorrect });
    await wait();
    expect(text(".sg-title")).toBe("Какое число перед?");
    expect(text(".ct-chain")).toBe("120 · 110 · 100 · ?");
    expect(count(".ct-squares > .cb-plate")).toBe(1);
    h.click("99");
    await wait();
    expect(text(".sg-status-note")).toBe("99 — это 100 без 1 единицы. А убираем 1 десяток. Сотня — это 10 десятков.");
    expect(count(".ct-squares > .cb-plate")).toBe(0);
    expect(count(".ct-ten")).toBe(10);
    expect(count(".ct-ten--ghost")).toBe(1);
    h.click("0");
    await wait();
    expect(text(".sg-status-note")).toBe("0 — это 100 без 1 сотни. А убираем 1 десяток. Сотня — это 10 десятков.");
    h.click("90");
    await wait();
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    expect(count(".ct-ten")).toBe(9);
    expect(onMistake).toHaveBeenCalledTimes(2);
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("engine: numbers from 100 up, half of them round hundreds", () => {
    const tasks = generateTasks("count_tens", [], 80, { task: "prev", range: "to1000" });
    expect(tasks.every((t) => t.task === "prev" && t.number >= 100 && t.options.includes(t.number - 10) && t.options.every((o) => o >= 0))).toBe(true);
    expect(tasks.filter((t) => t.number % 100 === 0).length).toBeGreaterThan(20);
  });
});
