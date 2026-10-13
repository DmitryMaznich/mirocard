import { describe, it, expect, vi } from "vitest";
import PlacePartsTask from "./PlacePartsTask.jsx";
import { generateTasks } from "./engine.js";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = (extra = {}) => ({ type: "place_parts", cardId: "p", conceptId: "p", number: 47, direction: "split", prompt: "digits", supportMode: "learning", ...extra });

describe("«Разрядные слагаемые»", () => {
  const h = coinHarness();
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const value = (label) => text(`output[aria-label="${label}"]`);

  it("«Разложи»: 47 = [40] + [7], then the spoken model", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(PlacePartsTask, task(), { onCorrect, onMistake });
    expect(text(".pp-num")).toBe("47");
    type(40); type(7);
    expect(value("Десятки")).toBe("40");
    expect(value("Единицы")).toBe("7");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("p", "p");
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("«4» instead of 40 is explained, and the table comes back", () => {
    const onMistake = vi.fn();
    h.mount(PlacePartsTask, task(), { onMistake });
    type(4); h.click("Проверить");
    expect(text(".sg-status-note")).toBe("4 десятка — это сорок. Сколько это?");
    expect(h.container.querySelector(".pp-support")).not.toBeNull();
    expect(onMistake).toHaveBeenCalledTimes(1);
  });

  it("«Сложи»: 40 + 7 = [47]; «407» gets its own hint", () => {
    h.mount(PlacePartsTask, task({ direction: "join" }));
    expect(text(".pp-row").replace(/\s+/g, "")).toBe("40+7=");
    type(407); h.click("Проверить");
    expect(text(".sg-status-note")).toBe("Сорок семь — это 4 десятка и 7 единиц. Сколько цифр нужно?");
    h.flush(); type(47); h.click("Проверить");
    expect(value("Число")).toBe("47");
  });

  it("словами and «Проверка»: no colours, no table", () => {
    h.mount(PlacePartsTask, task({ prompt: "words", supportMode: "independent" }));
    expect(text(".pp-words")).toBe("сорок семь");
    type(30);
    expect(text(".sg-status-note")).toBe("Проверь ещё раз.");
    expect(h.container.querySelector(".pp-support, .tb-digit--tens")).toBeNull();
  });

  it("engine: no round tens, falls back to a card when the record has none", () => {
    const tasks = generateTasks("place_parts", [], 30, { direction: "mix", maxTens: 3 });
    expect(tasks).toHaveLength(30);
    expect(tasks.every((t) => t.number % 10 !== 0 && t.number >= 11 && t.number <= 39 && t.cardId === "place_parts")).toBe(true);
    expect(new Set(tasks.map((t) => t.direction))).toEqual(new Set(["split", "join"]));
  });

  it("до 1000: 347 = [300] + [40] + [7]; «3» for 300 is explained", () => {
    h.mount(PlacePartsTask, task({ number: 347 }));
    expect(text(".sg-title")).toBe("Разложи на сотни, десятки и единицы");
    type(3); h.click("Проверить");
    expect(text(".sg-status-note")).toBe("3 сотни — это триста. Сколько это?");
    expect(h.container.querySelectorAll(".pp-support .tb-col")).toHaveLength(3);
    h.flush(); type(300); type(40); type(7);
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
  });

  it("до 1000: a zero place gives no part (305 = 300 + 5); joining «3005» gets the digits hint", () => {
    h.mount(PlacePartsTask, task({ number: 305 }));
    expect(h.container.querySelectorAll(".fp-field")).toHaveLength(2);
    type(300); type(5);
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.unmount();
    h.mount(PlacePartsTask, task({ number: 305, direction: "join" }));
    expect(text(".pp-row").replace(/\s+/g, "")).toBe("300+5=");
    type(3005); h.click("Проверить");
    expect(text(".sg-status-note")).toBe("Триста пять — это 3 сотни, 0 десятков и 5 единиц. Сколько цифр нужно?");
  });

  it("engine «до 1000»: three-digit, never a round hundred", () => {
    const tasks = generateTasks("place_parts", [], 200, { range: "to1000" });
    expect(tasks.every((t) => t.number >= 101 && t.number <= 999 && t.number % 100 !== 0)).toBe(true);
    expect(tasks.some((t) => Math.floor(t.number / 10) % 10 === 0)).toBe(true);
  });
});
