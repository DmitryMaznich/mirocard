import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import { hundredSteps } from "./ExchangeHundred.jsx";
import { generateTasks } from "./engine.js";
import { coinHarness } from "./coinTestHelpers.jsx";

const plus = { cardId: "c", conceptId: "c", op: "get", k: 20, number: 194, start: { hundreds: 1, tens: 9, ones: 4 }, result: 214, supportMode: "learning", view: "scheme" };
const minus = { cardId: "c", conceptId: "c", op: "give", k: 30, number: 214, start: { hundreds: 2, tens: 1, ones: 4 }, result: 184, supportMode: "learning", view: "scheme" };

describe("Плюс и минус через сотню", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const answer = (n) => { type(n); h.click("Проверить"); };
  const say = () => h.container.querySelector(".sg-status-say")?.textContent;

  it("plan: ones, tens (with the decision on minus), hundreds", () => {
    expect(hundredSteps(plus).steps.map((s) => s.text)).toEqual(["4 + 0 =", "9 + 2 =", "1 + 1 ="]);
    expect(hundredSteps(minus).steps.map((s) => s.text)).toEqual(["4 − 0 =", "1 − 3: десятков хватает?", "11 − 3 =", "2 − 1 ="]);
  });

  it("scheme plus: ten sticks fold into a square, then the answer", () => {
    const onCorrect = vi.fn();
    h.mount(ExchangeTenTask, plus, { onCorrect });
    expect(count(".hd-zone--hundreds .cb-square")).toBe(1);
    expect(count(".xh-frame .cb-stick")).toBe(9);
    h.click("Десяток из лотка");
    h.click("Сложить сотню"); h.flush();
    expect(count(".hd-zone--hundreds .cb-square")).toBe(2);
    expect(count(".xh-frame .cb-stick")).toBe(0);
    h.click("Десяток из лотка"); h.flush();
    answer(214);
    expect(say()).toBeUndefined();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("scheme minus: a square opens into ten sticks", () => {
    h.mount(ExchangeTenTask, minus);
    h.click("Десяток в рамке 1");
    h.click("Сотня 2"); h.flush();
    expect(count(".hd-zone--hundreds .cb-square")).toBe(1);
    expect(count(".xh-frame .cb-stick")).toBe(10);
    h.click("Десяток в рамке 10"); h.click("Десяток в рамке 9"); h.flush();
    answer(184);
    expect(say()).toBeUndefined();
  });

  it("table plus: 9 + 2 = 11 — the 1 under the tens, the ten flies up over the hundreds", () => {
    h.mount(ExchangeTenTask, { ...plus, view: "table" });
    type(4); type(11);
    const res = Array.from(h.container.querySelectorAll(".xb-result")).map((e) => e.textContent);
    expect(res).toEqual(["", "1", "4"]);
    expect(h.container.querySelector(".xf-carry.xf-carry--hundreds").textContent).toBe("1");
    expect(h.container.querySelector(".xb-over--hundreds").textContent).toBe("");
    h.flush();
    expect(h.container.querySelector(".xf-carry")).toBeNull();
    expect(h.container.querySelector(".xb-over--hundreds").textContent).toBe("1");
  });

  it("table minus: «не хватает» borrows a hundred; forgetting it is explained", () => {
    const onMistake = vi.fn();
    h.mount(ExchangeTenTask, { ...minus, view: "table" }, { onMistake });
    type(4); h.click("Не хватает");
    // The digits turn into the scheme: 2 squares, 1 stick; one square moves
    // over to the tens and falls apart there — 1 square, 11 sticks.
    const n = (sel) => h.container.querySelectorAll(sel).length;
    expect(n(".xf-area--big .cb-square")).toBe(2);
    expect(n(".xf-area--small .cb-stick")).toBe(1);
    act(() => vi.advanceTimersByTime(1950));
    expect(n(".xf-area--big .cb-square")).toBe(1);
    expect(n(".xf-area--small .cb-stick")).toBe(11);
    expect(n(".xf-area--small .xf-group--new .cb-stick")).toBe(10);
    h.flush();
    // Then the borrowed ten goes up over the tens as the written «1».
    expect(h.container.querySelector(".xf-carry--lend").textContent).toBe("1");
    h.flush();
    expect(h.container.querySelector(".xf-layer")).toBeNull();
    // The written way: the 2 crossed, the 1 not — a small «1» over it makes 11;
    // over the hundreds nothing yet — «2 − 1» is the last step.
    const over = (k) => h.container.querySelector(`.xb-over--${k}`).textContent;
    expect(h.container.querySelectorAll(".xb-crossed")).toHaveLength(1);
    expect(h.container.querySelector(".xb-over--tens .xb-lend").textContent).toBe("1");
    expect(over("hundreds")).toBe("");
    // A dot over the hundreds; it pulses at the last step, where 1 goes.
    expect(h.container.querySelector(".xb-over--hundreds .xb-borrow-dot:not(.xb-borrow-dot--wait)")).not.toBeNull();
    type(8);
    expect(h.container.querySelector(".xb-over--hundreds .xb-borrow-dot--wait")).not.toBeNull();
    type(2);
    expect(h.container.querySelector(".sg-status-note").textContent).toBe("Одну сотню мы отдали десяткам.");
    expect(over("hundreds")).toBe("");
    h.flush(); type(1);
    expect(over("hundreds")).toBe("1");
    expect(Array.from(h.container.querySelectorAll(".xb-result")).map((e) => e.textContent)).toEqual(["1", "8", "4"]);
    expect(onMistake).toHaveBeenCalledTimes(1);
  });

  it("engine: round tens, one crossing in half the tasks, results stay three-digit", () => {
    const cards = [{ id: "exchange_ten", conceptId: "exchange_ten", renderer: "place_value", params: { mode: "exchange_ten" } }];
    const tasks = generateTasks("exchange_ten", cards, 200, { range: "to1000", operation: "mixed" });
    expect(tasks.every((t) => t.k % 10 === 0 && t.result >= 100 && t.result <= 999 && t.view === "scheme")).toBe(true);
    const crosses = tasks.filter((t) => Math.floor(t.result / 100) !== t.start.hundreds);
    expect(crosses.length).toBe(100);
  });
});
