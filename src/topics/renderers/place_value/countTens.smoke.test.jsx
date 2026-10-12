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

  it("counts by tens; the tenth ten has to be folded into a hundred by the child", async () => {
    const onCorrect = vi.fn();
    h.mount(CountTensTask, task(), { onCorrect });
    expect(text(".ct-number")).toBe("70");
    expect(count(".ct-stick")).toBe(7);
    h.click("+1 десяток"); await wait();
    expect(text(".ct-number")).toBe("80");
    expect(text(".ct-caption")).toBe("восемьдесят · 8 десятков");
    h.click("+1 десяток"); await wait();
    h.click("+1 десяток"); await wait();
    // Ten sticks, no number, no «+1 десяток» — only «Сложи сотню».
    expect(count(".ct-stick")).toBe(10);
    expect(count(".ct-square")).toBe(0);
    expect(text(".ct-number")).toBe("?");
    expect(h.button("+1 десяток")).toBeUndefined();
    h.click("Сложи сотню"); await wait();
    expect(count(".ct-square")).toBe(1);
    expect(count(".ct-stick")).toBe(0);
    expect(text(".ct-number")).toBe("100");
    expect(text(".ct-fold-say")).toBe("10 десятков = 1 сотня");
    expect(text(".ct-caption")).toBe("сто · 1 сотня");
    h.click("+1 десяток"); await wait();
    expect(text(".ct-caption")).toBe("сто десять · 1 сотня и 1 десяток");
    h.click("+1 десяток"); await wait();
    expect(text(".ct-number")).toBe("120");
    expect(text(".sg-status-say")).toBe("70 · 80 · 90 · 100 · 110 · 120");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
  });

  it("«Обучение»: the number waits so the child can say it first", async () => {
    h.mount(CountTensTask, task({ supportMode: "learning" }));
    h.click("+1 десяток");
    await wait(100);
    expect(text(".ct-number")).toBe("?");
    expect(h.button("+1 десяток").disabled).toBe(true);
    await wait();
    expect(text(".ct-number")).toBe("80");
  });

  it("every phrase has its recording", () => {
    for (const key of Object.keys(PHRASE_AUDIO)) expect(existsSync(`public/audio/place-value-numbers/p-${key}.mp3`)).toBe(true);
    expect(PHRASE_AUDIO.fold).not.toMatch(/сто\b/i);
  });
});

describe("«Считаем десятками» — «Какое число дальше?»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const task = (extra = {}) => ({ type: "count_tens", cardId: "c", conceptId: "c", task: "next", number: 90, options: [91, 100, 900], supportMode: "learning", ...extra });

  it("the mistakes that matter are among the choices", () => {
    expect(countTensOptions(90).sort((a, b) => a - b)).toEqual([91, 100, 900]);
    expect(countTensOptions(100).sort((a, b) => a - b)).toEqual([101, 110, 1010]);
    expect(countTensOptions(190).sort((a, b) => a - b)).toEqual([191, 200, 290]);
    expect(countTensOptions(130).sort((a, b) => a - b)).toEqual([131, 140, 230]);
  });

  it("«Обучение»: a wrong choice is explained; the right one folds the hundred", async () => {
    const onMistake = vi.fn(), onCorrect = vi.fn();
    h.mount(CountTensTask, task(), { onMistake, onCorrect });
    expect(text(".ct-chain")).toBe("70 · 80 · 90 · ?");
    h.click("91");
    expect(text(".sg-status-note")).toBe("91 — это 90 и 1 единица. А мы прибавляем десяток. Десять десятков — это сотня.");
    h.click("900");
    expect(text(".sg-status-note")).toContain("900 — это девятьсот, 9 сотен.");
    expect(onMistake).toHaveBeenCalledTimes(2);
    h.click("100");
    expect(text(".sg-status-say")).toBe("10 десятков = 1 сотня. 90 и ещё десяток — 100, сто.");
    expect(h.container.querySelectorAll(".ct-square")).toHaveLength(1);
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("«1010» after 100 is told apart by its digit count", () => {
    h.mount(CountTensTask, task({ number: 100, options: [101, 110, 1010] }));
    h.click("1010");
    expect(text(".sg-status-note")).toBe("В числе 1010 четыре цифры. Сто десять — это 1 сотня и 1 десяток: три цифры.");
    expect(h.container.querySelector(".ct-stick--ghost")).not.toBeNull();
  });

  it("engine: the first count is 0 → 100, the rest are short stretches across a hundred", () => {
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
