import { describe, it, expect, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { generateTasks } from "./engine.js";
import { numberWords, placeValuePhrase } from "./placeValueLabels.js";
import { coinHarness } from "./coinTestHelpers.jsx";

const counts = (n) => ({ hundreds: Math.floor(n / 100), tens: Math.floor(n / 10) % 10, ones: n % 10 });
const identify = (n, extra = {}) => ({ cardId: "x", conceptId: "x", number: n, model: counts(n), layout: "places", supportMode: "learning", view: "coins", ...extra });
const build = (n, extra = {}) => ({ cardId: "b", conceptId: "b", number: n, target: counts(n), prompt: "digits", supportMode: "learning", view: "coins", ...extra });

describe("Сотни", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const answer = (n) => { type(n); h.click("Проверить"); };
  const note = () => h.container.querySelector(".sg-status-note")?.textContent;
  const value = (label) => h.container.querySelector(`output[aria-label="${label}"]`)?.textContent;

  it("words and the spoken model know hundreds and the placeholder zero", () => {
    expect(numberWords(305)).toBe("триста пять");
    expect(numberWords(200)).toBe("двести");
    expect(placeValuePhrase(305)).toBe("3 сотни, 0 десятков и 5 единиц — триста пять");
  });

  it("«Какое это число?» on coins: plates, stacks, coins; hundreds → tens → ones → number", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(IdentifyNumberTask, identify(247), { onCorrect, onMistake });
    expect(count(".hd-zone--hundreds .cb-plate")).toBe(2);
    expect(count(".hd-zone--tens .cb-ten-stack")).toBe(4);
    expect(count(".hd-zone--ones .cb-coin")).toBe(7);
    type(2); type(4); type(7); answer(247);
    expect(value("Какое это число?")).toBe("247");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("305: «35» and «3005» get the placeholder-zero hints", () => {
    h.mount(IdentifyNumberTask, identify(305));
    type(3); type(0); type(5);
    answer(35);
    expect(note()).toBe("Триста пять — это 3 сотни, 0 десятков и 5 единиц. Сколько цифр нужно?");
    h.flush(); answer(3005);
    expect(note()).toBe("Триста пять — это 3 сотни, 0 десятков и 5 единиц. Сколько цифр нужно?");
    h.flush(); answer(350);
    expect(note()).toBe("Десятков нет — на их месте пишем 0.");
  });

  it("«Схема»: squares; the three digits fly into the number", () => {
    h.mount(IdentifyNumberTask, identify(847, { view: "scheme" }));
    expect(count(".cb-square")).toBe(8);
    type(8); type(4); type(7); h.flush();
    expect(value("Какое это число?")).toBe("847");
    expect(h.container.querySelector(".fp-field--total .tb-digit--hundreds").textContent).toBe("8");
  });

  it("«Таблица»: rows «digit + word» in the task's order, the number in three cells", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(IdentifyNumberTask, identify(305, { view: "table", order: ["ones", "hundreds", "tens"] }), { onCorrect, onMistake });
    const rows = Array.from(h.container.querySelectorAll(".hd-row")).map((r) => r.textContent);
    expect(rows).toEqual(["5единиц", "3сотни", "0десятков"]);
    const cells = () => Array.from(h.container.querySelectorAll(".hd-cell")).map((e) => e.textContent).join("|");
    type(35);
    expect(cells()).toBe("3|5|");
    expect(h.container.querySelector('button[aria-label="Проверить"]').disabled).toBe(true);
    h.click("Стереть цифру"); h.click("Стереть цифру");
    // wrong order: the first wrong place gets a question and a lit row
    answer(503);
    expect(note()).toBe("Сколько сотен? С них число начинается.");
    expect(h.container.querySelector(".hd-row--lit").textContent).toBe("3сотни");
    expect(h.container.querySelector(".hd-row-support--off")).not.toBeNull();
    expect(onMistake).toHaveBeenCalledWith("x", "x", { field: null, given: "503", expected: "305" });
    h.flush();
    expect(cells()).toBe("||");
    // the second mistake brings the scheme into the rows
    answer(350);
    expect(note()).toBe("Сколько десятков? Они пишутся после сотен.");
    expect(h.container.querySelector(".hd-row-support--off")).toBeNull();
    expect(count(".hd-row-support .cb-square")).toBe(3);
    h.flush(); answer(305);
    expect(cells()).toBe("3|0|5");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("«Таблица» in a check: no lit row, no scheme", () => {
    h.mount(IdentifyNumberTask, identify(340, { view: "table", supportMode: "independent" }));
    expect(h.container.querySelector(".hd-row-support")).toBeNull();
    answer(304);
    expect(note()).toBe("Проверь число ещё раз.");
    expect(h.container.querySelector(".hd-row--lit")).toBeNull();
  });

  it("engine: table tasks start in the usual order, later ones often not", () => {
    const usual = "hundreds,tens,ones";
    let other = 0;
    for (let run = 0; run < 20; run++) {
      const tasks = generateTasks("identify_number", [{ id: "i", conceptId: "i", renderer: "place_value", params: { mode: "identify_number" } }], 10, { range: "to1000", view: "table" });
      expect(tasks.slice(0, 2).map((t) => t.order.join())).toEqual([usual, usual]);
      other += tasks.slice(2).filter((t) => t.order.join() !== usual).length;
    }
    expect(other).toBeGreaterThan(40);
    expect(other).toBeLessThan(120);
  });

  it("«Собери число» on coins: take plates, stacks, coins and check", () => {
    const onCorrect = vi.fn();
    h.mount(BuildNumberTask, build(305), { onCorrect });
    for (let i = 0; i < 3; i++) h.click("Взять сотню");
    h.click("Взять десяток");
    for (let i = 0; i < 5; i++) h.click("Взять монету");
    h.click("Проверить");
    expect(note()).toBe("Проверь десятки. В этом числе десятков нет.");
    h.click("Убрать десяток 1"); h.click("Проверить");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("«Собери число» table and number levels", () => {
    h.mount(BuildNumberTask, build(305, { view: "table" }));
    type(3); type(0); type(5);
    expect([value("Сотни"), value("Десятки"), value("Единицы")]).toEqual(["3", "0", "5"]);
    h.unmount();
    h.mount(BuildNumberTask, build(305, { view: "number" }));
    expect(Array.from(h.container.querySelectorAll(".nl-row-label")).map((e) => e.textContent)).toEqual(["Сотен", "Десятков", "Единиц"]);
    h.click("Единиц: 5"); h.click("Сотен: 3");
    // «Далее» keeps its place from the start, unavailable until all are answered.
    expect(h.button("Далее →").disabled).toBe(true);
    h.click("Десятков: 0");
    expect(h.button("Далее →").disabled).toBe(false);
  });

  it("engine: «до 1000» gives three-digit numbers, ≤ 599 on coins, some without tens", () => {
    const cards = [{ id: "identify_number", conceptId: "identify_number", renderer: "place_value", params: { mode: "identify_number" } }];
    const coins = generateTasks("identify_number", cards, 200, { range: "to1000" });
    expect(coins.every((t) => t.number >= 100 && t.number <= 599 && t.model.hundreds >= 1)).toBe(true);
    expect(coins.some((t) => t.model.tens === 0)).toBe(true);
    const scheme = generateTasks("identify_number", cards, 200, { range: "to1000", view: "scheme" });
    expect(scheme.some((t) => t.number >= 600)).toBe(true);
  });
});
