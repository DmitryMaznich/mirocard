import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const give = { cardId: "c", conceptId: "c", op: "give", k: 5, number: 32, start: { tens: 3, ones: 2 }, result: 27, needsExchange: true, supportMode: "learning" };
const get = { cardId: "c", conceptId: "c", op: "get", k: 5, number: 37, start: { tens: 3, ones: 7 }, result: 42, needsExchange: true, supportMode: "learning" };

describe("ExchangeTenTask", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const answer = (digits) => { for (const d of String(digits)) h.click(d); h.click("Проверить"); };

  it("give: the child breaks a ten only when loose cubes run out, then names the result", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(ExchangeTenTask, give, { onCorrect, onMistake });
    expect(count(".px-zone--tens .px-stack")).toBe(3);
    h.click("Монета 1"); h.click("Монета 1");
    expect(count(".px-zone--ones .px-coin")).toBe(0);
    expect(h.container.textContent).toContain("отдано 2 из 5");
    h.click("Десяток 1"); h.flush();
    expect(count(".px-zone--tens .px-stack")).toBe(2);
    expect(count(".px-zone--ones .px-coin")).toBe(10);
    expect(h.container.querySelector(".px-note")).toBeNull();
    h.click("Монета 1"); h.click("Монета 1"); h.click("Монета 1");
    expect(h.container.textContent).toContain("Сколько стало?");
    answer(27);
    expect(h.container.querySelector(".px-eq").textContent).toBe("32 − 5 = 27");
    expect(h.container.querySelector(".px-say").textContent).toBe("2 десятка и 7 единиц — двадцать семь");
    expect(onMistake).not.toHaveBeenCalled();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
  });

  it("a wrong answer is reported and kept on screen", () => {
    const onMistake = vi.fn();
    h.mount(ExchangeTenTask, { ...give, k: 1, result: 31, needsExchange: false }, { onMistake });
    h.click("Монета 1");
    answer(32);
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector("output").textContent).toBe("32");
    expect(h.container.querySelector(".px-done")).toBeNull();
  });

  it("an unneeded break is explained in «Обучение» and counted as a mistake once in «Проверка»", () => {
    const onMistake = vi.fn();
    const easy = { ...give, k: 1, result: 31, needsExchange: false };
    h.mount(ExchangeTenTask, easy, { onMistake });
    h.click("Десяток 1"); h.flush();
    expect(h.container.querySelector(".px-note").textContent).toContain("без размена");
    expect(onMistake).not.toHaveBeenCalled();
    h.unmount();
    h.mount(ExchangeTenTask, { ...easy, supportMode: "independent" }, { onMistake });
    h.click("Десяток 1"); h.flush(); h.click("Десяток 1"); h.flush();
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector(".px-note")).toBeNull();
  });

  it("get: coins come from the tray, ten loose coins go into the form and become a stack", () => {
    const onCorrect = vi.fn();
    h.mount(ExchangeTenTask, get, { onCorrect });
    for (let i = 0; i < 5; i++) h.click("Взять монету 1");
    expect(count(".px-zone--ones .px-coin")).toBe(12);
    expect(h.container.textContent).not.toContain("Сколько стало?");
    for (let i = 0; i < 10; i++) h.click("Монета 1");
    expect(count(".px-mould .cb-stack-coin")).toBe(10);
    h.click("Сложить стопку");
    expect(count(".px-zone--tens .px-stack")).toBe(4);
    expect(count(".px-zone--ones .px-coin")).toBe(2);
    answer(42);
    expect(h.container.querySelector(".px-say").textContent).toBe("4 десятка и 2 единицы — сорок два");
  });

  it("undo restores the previous step in «Обучение» and is absent in «Проверка»", () => {
    h.mount(ExchangeTenTask, give);
    h.click("Десяток 1"); h.flush();
    h.click("↶ Отменить");
    expect(count(".px-zone--tens .px-stack")).toBe(3);
    expect(count(".px-zone--ones .px-coin")).toBe(2);
    h.unmount();
    h.mount(ExchangeTenTask, { ...give, supportMode: "independent" });
    expect(h.button("↶ Отменить")).toBeUndefined();
  });

  it("hints appear only once the child is stuck, and only in «Обучение»", () => {
    h.mount(ExchangeTenTask, give);
    h.click("Монета 1"); h.click("Монета 1");
    expect(h.container.querySelector(".px-hint")).toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    expect(h.container.querySelector(".px-hint").textContent).toContain("Где ещё есть монеты?");
    act(() => vi.advanceTimersByTime(4000));
    expect(count(".px-stack.px-glow")).toBe(3);
    h.unmount();
    h.mount(ExchangeTenTask, { ...give, supportMode: "independent" });
    h.click("Монета 1"); h.click("Монета 1");
    act(() => vi.advanceTimersByTime(10000));
    expect(h.container.querySelector(".px-hint")).toBeNull();
  });

  it("the column record crosses the tens digit when a ten is broken", () => {
    h.mount(ExchangeTenTask, { ...give, showColumn: true });
    expect(h.container.querySelector(".px-nb-d--gone")).toBeNull();
    h.click("Монета 1"); h.click("Монета 1"); h.click("Десяток 2"); h.flush();
    const corners = Array.from(h.container.querySelectorAll(".px-nb-corner")).map((el) => el.textContent);
    expect(h.container.querySelector(".px-nb-d--gone").firstChild.textContent).toBe("3");
    expect(corners).toEqual(["2", "1"]);
  });
});
