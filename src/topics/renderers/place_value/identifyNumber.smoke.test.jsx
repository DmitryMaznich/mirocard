import { describe, it, expect, vi } from "vitest";
import IdentifyNumberTask, { mixedLayout } from "./IdentifyNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = (extra = {}) => ({ cardId: "x", conceptId: "x", number: 34, model: { tens: 3, ones: 4 }, layout: "places", seed: 5, supportMode: "learning", ...extra });

describe("IdentifyNumberTask", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const answer = (n) => { for (const d of String(n)) h.click(d); h.click("Проверить"); };
  const active = () => h.container.querySelector(".gt-q--active")?.textContent;

  it("«Обучение»: tens → ones → number, then the spoken model", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task(), { onCorrect, onMistake });
    expect(count(".px-zone--tens .cb-ten-stack")).toBe(3);
    expect(count(".px-zone--ones .cb-coin")).toBe(4);
    expect(active()).toContain("Сколько десятков?");
    answer(3); expect(active()).toContain("Сколько единиц?");
    answer(4); expect(active()).toContain("Какое это число?");
    answer(34);
    expect(h.container.querySelector(".px-say").textContent).toBe("3 десятка и 4 единицы — тридцать четыре");
    expect(onMistake).not.toHaveBeenCalled();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
  });

  it("«Проверка» asks only for the number and offers no counting help", () => {
    h.mount(IdentifyNumberTask, task({ supportMode: "independent" }));
    expect(count(".gt-q")).toBe(1);
    expect(active()).toContain("Какое это число?");
    expect(h.button("Посчитать")).toBeUndefined();
    answer(43);
    expect(h.container.querySelector(".px-note").textContent).toBe("Проверь число ещё раз.");
  });

  it("names the typical mistakes in «Обучение»", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task(), { onMistake });
    answer(3); answer(4);
    answer(43);
    expect(h.container.querySelector(".px-note").textContent).toContain("их пишут первыми");
    expect(h.container.querySelector("output").textContent).toBe("43");
    h.click("Стереть цифру"); h.click("Стереть цифру");
    answer(304);
    expect(h.container.querySelector(".px-note").textContent).toBe("Тридцать четыре — это 3 десятка и 4 единицы. Сколько цифр нужно?");
    expect(onMistake).toHaveBeenCalledTimes(2);
  });

  it("more than nine loose coins: asks for loose coins and explains «214»", () => {
    h.mount(IdentifyNumberTask, task({ layout: "over9", model: { tens: 2, ones: 14 } }));
    expect(count(".px-zone--ones .cb-coin")).toBe(14);
    answer(2);
    expect(active()).toContain("Сколько отдельных монет?");
    answer(14); answer(214);
    expect(h.container.querySelector(".px-note").textContent).toContain("не может быть больше девяти");
    h.click("Стереть цифру"); h.click("Стереть цифру"); h.click("Стереть цифру");
    answer(34);
    expect(h.container.querySelector(".px-done")).not.toBeNull();
  });

  it("mixed: one zone, no tens/ones labels, loose coins left of the stacks", () => {
    h.mount(IdentifyNumberTask, task({ layout: "mixed" }));
    expect(h.container.querySelector(".px-zone--tens")).toBeNull();
    expect(count(".id-mixed .cb-ten-stack")).toBe(3);
    expect(count(".id-mixed .cb-coin")).toBe(4);
  });

  it("«Посчитать» ticks items without counting for the child", () => {
    h.mount(IdentifyNumberTask, task());
    h.click("Посчитать"); h.click("Десяток"); h.click("Монета");
    expect(count(".id-item--counted")).toBe(2);
    expect(h.container.querySelector("output").textContent).toBe("?");
    h.click("Закончить счёт");
    expect(count(".id-item--counted")).toBe(0);
  });

  it("one-digit numbers and round tens", () => {
    h.mount(IdentifyNumberTask, task({ number: 7, model: { tens: 0, ones: 7 }, supportMode: "independent" }));
    expect(count(".cb-ten-stack")).toBe(0);
    answer(7);
    expect(h.container.querySelector(".px-say").textContent).toBe("7 единиц — семь");
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
