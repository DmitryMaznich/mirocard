import { describe, it, expect, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

describe("«Таблица»", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const note = () => h.container.querySelector(".sg-status-note")?.textContent;
  const value = (label) => h.container.querySelector(`output[aria-label="${label}"]`).textContent;
  const identify = (extra = {}) => ({ cardId: "x", conceptId: "x", number: 34, model: { tens: 3, ones: 4 }, layout: "places", seed: 1, supportMode: "learning", view: "table", ...extra });
  const build = (extra = {}) => ({ cardId: "b", conceptId: "b", number: 47, target: { tens: 4, ones: 7 }, prompt: "digits", supportMode: "learning", view: "table", ...extra });

  it("«Какое это число?»: digits in the columns, no picture; the child writes the number", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(IdentifyNumberTask, identify(), { onCorrect, onMistake });
    expect(Array.from(h.container.querySelectorAll(".tb-digit")).map((e) => e.textContent)).toEqual(["3", "4"]);
    expect(count(".cb-stick, .cb-dot, .cb-coin, .cb-ten-stack")).toBe(0);
    type(34); h.click("Проверить");
    expect(value("Какое это число?")).toBe("34");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("«Обучение»: a mistake brings the scheme back under the digits; «Вперемешку» puts ones first", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, identify({ layout: "mixed" }), { onMistake });
    expect(Array.from(h.container.querySelectorAll(".sg-head")).map((e) => e.textContent)).toEqual(["Единицы", "Десятки"]);
    type(43); h.click("Проверить");
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(note()).toContain("Десятки пишут первыми");
    expect(count(".tb-support .cb-stick")).toBe(3);
    expect(count(".tb-support .cb-dot")).toBe(4);
  });

  it("«Больше девяти»: 2 | 14 is 34, not 214", () => {
    h.mount(IdentifyNumberTask, identify({ layout: "over9", model: { tens: 2, ones: 14 } }));
    type(214); h.click("Проверить");
    expect(note()).toContain("Десять единиц — это ещё один десяток");
    h.flush(); type(34); h.click("Проверить");
    expect(value("Какое это число?")).toBe("34");
  });

  it("«Проверка»: no support after a mistake", () => {
    h.mount(IdentifyNumberTask, identify({ supportMode: "independent" }));
    type(43); h.click("Проверить");
    expect(note()).toBe("Проверь число ещё раз.");
    expect(count(".tb-support")).toBe(0);
  });

  it("«Собери число»: the child writes tens, then ones; a mistake colours the number's digits", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(BuildNumberTask, build(), { onCorrect, onMistake });
    expect(h.container.querySelector(".tb-target").textContent).toBe("47");
    type(7);
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(note()).toBe("Десятки — первая цифра числа.");
    expect(h.container.querySelector(".tb-target .tb-digit--tens").textContent).toBe("4");
    h.flush(); type(4); type(7);
    expect(value("Десятки")).toBe("4");
    expect(value("Единицы")).toBe("7");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("b", "b");
  });

  it("«Собери число» словами: the hint speaks of the word", () => {
    h.mount(BuildNumberTask, build({ prompt: "words" }));
    expect(h.container.querySelector(".tb-target").textContent).toBe("сорок семь");
    type(7);
    expect(note()).toBe("Сорок семь: сколько здесь десятков?");
  });

  it("«Число»: reads the places from the written number; «47» as tens is the whole number", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(BuildNumberTask, build({ view: "number" }), { onCorrect, onMistake });
    expect(h.container.querySelector(".nl-ask").textContent).toBe("Сколько десятков в числе 47?");
    expect(Array.from(h.container.querySelectorAll(".nl-choice")).map((b) => b.textContent).sort()).toEqual(["4", "47", "7"]);
    h.click("47");
    expect(note()).toBe("47 — это всё число. А десятков в нём сколько?");
    expect(h.container.querySelector(".pp-support")).not.toBeNull();
    h.click("4");
    expect(h.container.querySelector(".nl-ask").textContent).toBe("Сколько единиц в числе 47?");
    h.click("7");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("b", "b");
    expect(onMistake).toHaveBeenCalledTimes(1);
  });

  it("«Число» словами: 40 instead of 4 tens is explained", () => {
    h.mount(BuildNumberTask, build({ view: "number", prompt: "words" }));
    expect(h.container.querySelector(".nl-ask").textContent).toBe("Сколько десятков в числе «сорок семь»?");
    h.click("40");
    expect(note()).toBe("40 — это 4 десятка. Сколько десятков?");
  });
});
