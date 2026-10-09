import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import IdentifyNumberTask, { mixedLayout } from "./IdentifyNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = (extra = {}) => ({ cardId: "x", conceptId: "x", number: 34, model: { tens: 3, ones: 4 }, layout: "places", seed: 5, supportMode: "learning", ...extra });

describe("IdentifyNumberTask", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const answer = (n) => { for (const d of String(n)) h.click(d); h.click("Проверить"); };
  const active = () => h.container.querySelector(".fp-field--active output")?.getAttribute("aria-label");
  const note = () => h.container.querySelector(".sg-status-note")?.textContent;
  const value = (label) => h.container.querySelector(`output[aria-label="${label}"]`).textContent;

  it("«Обучение»: tens → ones → number, typed straight into the fields under the columns", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task(), { onCorrect, onMistake });
    expect(count(".sg-stacks .cb-ten-stack")).toBe(3);
    expect(count(".id-ones .cb-coin")).toBe(4);
    expect(Array.from(h.container.querySelectorAll(".sg-head")).map((e) => e.textContent)).toEqual(["Десятки", "Единицы"]);
    expect(active()).toBe("Десятки");
    answer(3); expect(active()).toBe("Единицы");
    answer(4); expect(active()).toBe("Какое это число?");
    answer(34);
    expect(value("Какое это число?")).toBe("34");
    expect(h.container.querySelector(".px-say")).toBeNull();
    expect(onMistake).not.toHaveBeenCalled();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
  });

  it("«Проверка» asks only for the number, and the coins can't be ticked", () => {
    h.mount(IdentifyNumberTask, task({ supportMode: "independent" }));
    expect(count(".fp-field")).toBe(1);
    expect(active()).toBe("Какое это число?");
    expect(count("button.id-item")).toBe(0);
    answer(43);
    expect(note()).toBe("Проверь число ещё раз.");
  });

  it("names the typical mistakes in «Обучение»", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task(), { onMistake });
    answer(3); answer(4);
    answer(43);
    expect(note()).toContain("их пишут первыми");
    expect(value("Какое это число?")).toBe("43");
    h.click("Стереть цифру"); h.click("Стереть цифру");
    answer(304);
    expect(note()).toBe("Тридцать четыре — это 3 десятка и 4 единицы. Сколько цифр нужно?");
    expect(onMistake).toHaveBeenCalledTimes(2);
  });

  it("more than nine loose coins: asks for loose coins and explains «214»", () => {
    h.mount(IdentifyNumberTask, task({ layout: "over9", model: { tens: 2, ones: 14 } }));
    expect(count(".id-ones .cb-coin")).toBe(14);
    answer(2);
    expect(active()).toBe("Отдельных монет");
    answer(14); answer(214);
    expect(note()).toContain("не может быть больше девяти");
    h.click("Стереть цифру"); h.click("Стереть цифру"); h.click("Стереть цифру");
    answer(34);
    expect(h.button("Далее →")).toBeDefined();
  });

  it("mixed: one zone, loose coins left of the stacks; the answer columns under it", () => {
    h.mount(IdentifyNumberTask, task({ layout: "mixed" }));
    expect(count(".id-mixed .cb-ten-stack")).toBe(3);
    expect(count(".id-mixed .cb-coin")).toBe(4);
    expect(count(".id-fields .fp-field")).toBe(2);
  });

  it("a tap ticks a stack or coin as counted; the ticks clear at the next question", () => {
    h.mount(IdentifyNumberTask, task());
    h.click("Десяток"); h.click("Монета");
    expect(count(".id-item--counted")).toBe(2);
    h.click("Десяток");
    expect(count(".id-item--counted")).toBe(1);
    answer(3);
    expect(count(".id-item--counted")).toBe(0);
  });

  it("tens and ones check themselves; only the number needs «Проверить»", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task({ layout: "over9", model: { tens: 2, ones: 14 } }), { onMistake });
    expect(h.button("Проверить").disabled).toBe(true);
    h.click("2");
    expect(active()).toBe("Отдельных монет");
    h.click("1");
    expect(active()).toBe("Отдельных монет"); // «1» may still become 14
    h.click("4");
    expect(active()).toBe("Какое это число?");
    expect(onMistake).not.toHaveBeenCalled();
    h.click("3");
    expect(h.button("Проверить").disabled).toBe(false);
  });

  it("a digit that can't lead to the answer is a mistake at once and clears itself", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task(), { onMistake });
    h.click("5");
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(note()).toContain("Посчитай стопки");
    expect(h.container.querySelector(".fp-field--wrong")).not.toBeNull();
    act(() => vi.advanceTimersByTime(800));
    expect(value("Десятки")).toBe("");
    h.click("3");
    expect(active()).toBe("Единицы");
  });

  it("one-digit numbers and round tens", () => {
    h.mount(IdentifyNumberTask, task({ number: 7, model: { tens: 0, ones: 7 }, supportMode: "independent" }));
    expect(count(".cb-ten-stack")).toBe(0);
    answer(7);
    expect(h.button("Далее →")).toBeDefined();
  });
});

describe("mixedLayout", () => {
  it("puts every loose coin left of (or level with) every stack", () => {
    for (const [t, o] of [[3, 4], [2, 9], [5, 1], [0, 6]]) {
      const { items } = mixedLayout(t, o, 9, 8);
      expect(items).toHaveLength(t + o);
      const coinCols = items.filter((i) => i.kind === "coin").map((i) => i.col);
      const stackCols = items.filter((i) => i.kind === "stack").map((i) => i.col);
      if (coinCols.length && stackCols.length) expect(Math.max(...coinCols)).toBeLessThanOrEqual(Math.min(...stackCols));
      expect(new Set(items.map((i) => `${i.col}:${i.row}`)).size).toBe(t + o);
    }
  });
});
