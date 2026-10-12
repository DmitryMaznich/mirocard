import { describe, it, expect, vi } from "vitest";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import { exchangeSteps } from "./ExchangeTable.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const minus = { cardId: "c", conceptId: "c", op: "give", k: 4, number: 32, start: { tens: 3, ones: 2 }, result: 28, supportMode: "learning", view: "table" };
const plus = { cardId: "c", conceptId: "c", op: "get", k: 4, number: 38, start: { tens: 3, ones: 8 }, result: 42, supportMode: "learning", view: "table" };

describe("«Плюс и минус через десяток» — «Таблица»", () => {
  const h = coinHarness();
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const note = () => text(".sg-status-note");
  const cells = () => Array.from(h.container.querySelectorAll(".xb-cell")).map((e) => e.textContent);

  it("steps: ones first, then tens with the carried / borrowed ten", () => {
    expect(exchangeSteps(plus).steps.map((s) => s.text)).toEqual(["8 + 4 =", "3 + 1 ="]);
    expect(exchangeSteps(minus).steps.map((s) => s.text)).toEqual(["2 − 4: единиц хватает?", "12 − 4 =", "3 − 1 ="]);
    expect(exchangeSteps({ ...plus, k: 24, number: 38, result: 62 }).steps.map((s) => s.text)).toEqual(["8 + 4 =", "3 + 2 + 1 ="]);
    expect(exchangeSteps({ ...minus, k: 1, result: 31 }).steps.map((s) => s.text)).toEqual(["2 − 1: единиц хватает?", "2 − 1 =", "не меняются:"]);
  });

  it("plus: 8 + 4 = 12 puts 2 under the ones and 1 over the tens; then 3 + 1", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(ExchangeTenTask, plus, { onCorrect, onMistake });
    expect(cells()).toEqual(["3", "8", "", "4", "", ""]);
    expect(text(".xb-step-text")).toBe("8 + 4 =");
    type(12);
    expect(text(".xb-over--tens")).toBe("1");
    expect(cells().slice(4)).toEqual(["", "2"]);
    expect(text(".xb-step-text")).toBe("3 + 1 =");
    type(3);
    expect(note()).toBe("Не забудь десяток, который пришёл из единиц.");
    h.flush(); type(4);
    expect(cells().slice(4)).toEqual(["4", "2"]);
    expect(text(".sg-status-say")).toBe("38 + 4 = 42. Сорок два.");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
    expect(onMistake).toHaveBeenCalledTimes(1);
  });

  it("minus: decides «не хватает», borrows a ten, 12 − 4, then 3 − 1", () => {
    const onMistake = vi.fn();
    h.mount(ExchangeTenTask, minus, { onMistake });
    h.click("Хватает");
    expect(note()).toBe("Из 2 нельзя вычесть 4 — единиц не хватает.");
    h.click("Не хватает");
    expect(h.container.querySelectorAll(".xb-crossed")).toHaveLength(2);
    expect(text(".xb-over--ones")).toBe("12");
    expect(text(".xb-over--tens")).toBe("2");
    type(9);
    expect(note()).toBe("Посчитай ещё раз: 12 − 4.");
    expect(h.container.querySelectorAll(".xb-support .cb-dot")).toHaveLength(16);
    h.flush(); type(8); type(2);
    expect(cells().slice(4)).toEqual(["2", "8"]);
    expect(onMistake).toHaveBeenCalledTimes(2);
  });

  it("«Проверка»: no steps, only the result", () => {
    h.mount(ExchangeTenTask, { ...minus, supportMode: "independent" });
    expect(h.container.querySelector(".xb-step")).toBeNull();
    type(28); h.click("Проверить");
    expect(cells().slice(4)).toEqual(["2", "8"]);
  });
});
