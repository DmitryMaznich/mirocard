import { describe, it, expect, vi } from "vitest";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = (extra = {}) => ({ cardId: "b", conceptId: "b", number: 47, target: { tens: 4, ones: 7 }, prompt: "digits", supportMode: "learning", ...extra });

describe("BuildNumberTask", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const take = (label, n) => { for (let i = 0; i < n; i++) h.click(label); };
  const note = () => h.container.querySelector(".px-note")?.textContent;

  it("one tap = one ready stack or one coin; a tap on a placed item takes it back", () => {
    h.mount(BuildNumberTask, task());
    expect(h.container.querySelector(".bn-target").textContent).toBe("47");
    take("Взять стопку", 3); take("Взять монету", 2);
    expect(count(".px-zone--tens .cb-ten-stack")).toBe(3);
    expect(count(".px-zone--ones .cb-coin")).toBe(2);
    h.click("Убрать десяток 1");
    expect(count(".px-zone--tens .cb-ten-stack")).toBe(2);
    h.click("Сначала");
    expect(count(".px-zone .cb-coin, .px-zone .cb-ten-stack")).toBe(0);
  });

  it("checks only on «Проверить» and ends with the spoken model", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(BuildNumberTask, task(), { onCorrect, onMistake });
    take("Взять стопку", 4); take("Взять монету", 7);
    expect(h.container.querySelector(".px-done")).toBeNull();
    h.click("Проверить");
    expect(h.container.querySelector(".px-say").textContent).toBe("4 десятка и 7 единиц — сорок семь");
    expect(onMistake).not.toHaveBeenCalled();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("b", "b");
  });

  it("«Обучение» names swapped tens and ones, and more than nine loose coins", () => {
    const onMistake = vi.fn();
    h.mount(BuildNumberTask, task(), { onMistake });
    take("Взять стопку", 7); take("Взять монету", 4);
    h.click("Проверить");
    expect(note()).toBe("Ты положил 7 десятков — это семьдесят. А нужно сорок семь.");
    h.click("Сначала");
    take("Взять стопку", 3); take("Взять монету", 17);
    h.click("Проверить");
    expect(note()).toContain("Десять монет — это сколько стопок?");
    expect(onMistake).toHaveBeenCalledTimes(2);
  });

  it("plain wrong counts point at the zone, without saying where exactly", () => {
    h.mount(BuildNumberTask, task());
    take("Взять стопку", 3); take("Взять монету", 7);
    h.click("Проверить");
    expect(note()).toBe("Проверь десятки.");
    h.click("Взять стопку"); h.click("Убрать монету 1");
    h.click("Проверить");
    expect(note()).toBe("Проверь единицы.");
  });

  it("«Проверка» gives no hint", () => {
    h.mount(BuildNumberTask, task({ supportMode: "independent" }));
    take("Взять стопку", 7); take("Взять монету", 4);
    h.click("Проверить");
    expect(note()).toBe("Проверь число ещё раз.");
  });

  it("the number can be given in words", () => {
    h.mount(BuildNumberTask, task({ prompt: "words" }));
    expect(h.container.querySelector(".bn-target").textContent).toBe("сорок семь");
    expect(h.container.textContent).not.toContain("47");
  });
});
