import { describe, it, expect, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";
import { generateTasks } from "./engine.js";

describe("«Таблица»", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const note = () => h.container.querySelector(".sg-status-note")?.textContent;
  const value = (label) => h.container.querySelector(`output[aria-label="${label}"]`).textContent;
  const identify = (extra = {}) => ({ cardId: "x", conceptId: "x", number: 34, model: { tens: 3, ones: 4 }, layout: "places", seed: 1, supportMode: "learning", view: "table", ...extra });
  const build = (extra = {}) => ({ cardId: "b", conceptId: "b", number: 47, target: { tens: 4, ones: 7 }, prompt: "digits", supportMode: "learning", view: "table", ...extra });

  const rows = () => Array.from(h.container.querySelectorAll(".hd-row")).map((r) => r.textContent);

  it("«Какое это число?»: rows «3 десятка / 4 единицы», no picture; the number in two cells", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(IdentifyNumberTask, identify(), { onCorrect, onMistake });
    expect(rows()).toEqual(["3десятка", "4единицы"]);
    expect(count(".hd-cell")).toBe(2);
    expect(h.container.querySelector(".hd-row-support--off").children.length).toBe(3);
    type(34); h.click("Проверить");
    expect(value("Какое это число?")).toBe("34");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("«Обучение»: единицы on top; a mistake asks about the tens, the second brings the scheme", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, identify({ order: ["ones", "tens"] }), { onMistake });
    expect(rows()).toEqual(["4единицы", "3десятка"]);
    type(43); h.click("Проверить");
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(note()).toBe("Сколько десятков? С них число начинается.");
    expect(h.container.querySelector(".hd-row--lit").textContent).toBe("3десятка");
    expect(h.container.querySelector(".hd-row-support--off")).not.toBeNull();
    h.flush(); type(43); h.click("Проверить");
    expect(h.container.querySelector(".hd-row-support--off")).toBeNull();
    expect(count(".hd-row-support .cb-stick")).toBe(3);
    expect(count(".hd-row-support .cb-dot")).toBe(4);
  });

  it("«Больше девяти»: «2 десятка, 14 единиц» is 34", () => {
    h.mount(IdentifyNumberTask, identify({ layout: "over9", model: { tens: 2, ones: 14 } }));
    expect(rows()).toEqual(["2десятка", "14единиц"]);
    type(24); h.click("Проверить");
    expect(note()).toContain("Десять единиц — это ещё один десяток");
    h.flush(); type(34); h.click("Проверить");
    expect(value("Какое это число?")).toBe("34");
  });

  it("«Проверка»: no lit row, no scheme after a mistake", () => {
    h.mount(IdentifyNumberTask, identify({ supportMode: "independent" }));
    type(43); h.click("Проверить");
    expect(note()).toBe("Проверь число ещё раз.");
    expect(count(".hd-row-support")).toBe(0);
    expect(count(".hd-row--lit")).toBe(0);
  });

  it("engine: the table has no single digits; rows start in the usual order", () => {
    const cards = [{ id: "i", conceptId: "i", renderer: "place_value", params: { mode: "identify_number" } }];
    for (let run = 0; run < 20; run++) {
      const tasks = generateTasks("identify_number", cards, 10, { view: "table", trick: true });
      expect(tasks.every((t) => t.number >= 10)).toBe(true);
      expect(tasks.filter((t) => t.layout === "mixed").every((t) => t.order.join() === "ones,tens")).toBe(true);
      tasks.slice(0, 2).filter((t) => t.layout !== "mixed").forEach((t) => expect(t.order.join()).toBe("tens,ones"));
    }
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

  it("«Число»: both places on one screen, any order; «47» as tens is the whole number", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(BuildNumberTask, build({ view: "number" }), { onCorrect, onMistake });
    expect(h.container.querySelector(".sg-title").textContent).toBe("Сколько десятков и единиц в числе?");
    expect(Array.from(h.container.querySelectorAll(".nl-row-label")).map((e) => e.textContent)).toEqual(["Десятков", "Единиц"]);
    expect(Array.from(h.container.querySelectorAll(".nl-row--tens .nl-choice")).map((b) => b.textContent).sort()).toEqual(["4", "47", "7"]);
    h.click("Десятков: 47");
    expect(note()).toBe("47 — это всё число. А десятков в нём сколько?");
    expect(h.container.querySelector(".pp-support")).not.toBeNull();
    // Ones first, then tens: either order.
    h.click("Единиц: 7");
    expect(h.container.querySelector(".nl-row--ones.nl-row--done")).not.toBeNull();
    // «Далее» keeps its place from the start, unavailable until all are answered.
    expect(h.button("Далее →").disabled).toBe(true);
    h.click("Десятков: 4");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("b", "b");
    expect(onMistake).toHaveBeenCalledTimes(1);
  });

  it("«Число» словами: 40 instead of 4 tens is explained", () => {
    h.mount(BuildNumberTask, build({ view: "number", prompt: "words" }));
    h.click("Десятков: 40");
    expect(note()).toBe("40 — это 4 десятка. Сколько десятков?");
  });
});
