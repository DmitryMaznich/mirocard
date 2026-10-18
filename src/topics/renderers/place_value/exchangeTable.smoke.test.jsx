import { describe, it, expect, vi } from "vitest";
import { act } from "react";
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
    expect(exchangeSteps(minus).steps.map((s) => s.text)).toEqual(["2 − 4: единиц хватает?", "3 − 1 =", "10 + 2 =", "12 − 4 =", "не меняются:"]);
    expect(exchangeSteps({ ...plus, k: 24, number: 38, result: 62 }).steps.map((s) => s.text)).toEqual(["8 + 4 =", "3 + 2 + 1 ="]);
    expect(exchangeSteps({ ...minus, k: 1, result: 31 }).steps.map((s) => s.text)).toEqual(["2 − 1: единиц хватает?", "2 − 1 =", "не меняются:"]);
  });

  it("plus: 8 + 4 = 12 puts 2 under the ones and 1 over the tens; then 3 + 1", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(ExchangeTenTask, plus, { onCorrect, onMistake });
    expect(cells()).toEqual(["3", "8", "", "4", "", ""]);
    expect(text(".xb-step-text")).toBe("8 + 4 =");
    type(12);
    // Written way, no pieces: 2 stays under the ones, the 1 of 12 flies up
    // over the tens and stays there.
    expect(h.container.querySelector(".xf-area")).toBeNull();
    expect(text(".xf-carry")).toBe("1");
    expect(text(".xb-over--tens")).toBe("");
    act(() => vi.advanceTimersByTime(800));
    expect(h.container.querySelector(".xf-carry--up")).not.toBeNull();
    h.flush();
    expect(text(".xb-over--tens")).toBe("1");
    expect(cells().slice(4)).toEqual(["", "2"]);
    expect(text(".xb-step-text")).toBe("3 + 1 =");
    type(3);
    expect(note()).toBe("Не забудь десяток, который пришёл из единиц.");
    h.flush(); type(4);
    expect(cells().slice(4)).toEqual(["4", "2"]);
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
    expect(onMistake).toHaveBeenCalledTimes(1);
  });

  it("minus: decides «не хватает», borrows a ten, 12 − 4, then 3 − 1", () => {
    const onMistake = vi.fn();
    h.mount(ExchangeTenTask, minus, { onMistake });
    h.click("Хватает");
    // No ready answer: the child compares the two numbers, lit in the table.
    expect(note()).toBe("Сначала сравни числа единиц.");
    expect(text(".xb-compare-ask")).toBe("Что больше: 2 или 4?");
    expect(h.container.querySelectorAll(".xb-cell--compare")).toHaveLength(2);
    h.click("2");
    expect(note()).toBe("Посмотри на числа в таблице ещё раз.");
    h.click("4");
    expect(text(".xb-compared")).toBe("2 < 4");
    h.click("Не хватает");
    // 3 sticks, 2 dots; a stick goes to the ones and falls apart: 2 sticks, 12 dots.
    const n = (sel) => h.container.querySelectorAll(sel).length;
    expect(n(".xf-area--big .cb-stick")).toBe(3);
    expect(h.container.querySelectorAll(".xb-crossed")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1950));
    expect(n(".xf-area--big .cb-stick")).toBe(2);
    expect(n(".xf-area--small .cb-dot")).toBe(12);
    h.flush();
    // Both crossed; the child writes what goes over them: 3 − 1, then 10 + 2.
    expect(h.container.querySelectorAll(".xb-crossed")).toHaveLength(2);
    expect(text(".xb-over--tens")).toBe("?");
    type(2);
    expect(text(".xb-over--tens")).toBe("2");
    type(12);
    expect(text(".xb-over--ones")).toBe("12");
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
