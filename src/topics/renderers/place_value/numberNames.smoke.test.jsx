import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import NumberNamesTask from "./NumberNamesTask.jsx";
import { confusables, numberNameOptions, numberNamesNumber } from "./numberNames.js";
import { numberAudioParts, NUMBER_AUDIO_WORDS } from "./numberAudio.js";
import { generateTasks } from "./engine.js";
import { coinHarness } from "./coinTestHelpers.jsx";

// The voice locks taps (useSpeechGuard): let it finish before the next tap.
const wait = (ms = 5000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
import { existsSync } from "node:fs";

const task = (extra = {}) => ({ type: "number_names", cardId: "n", conceptId: "n", number: 90, options: [19, 90, 9], supportMode: "learning", ...extra });

describe("«Названия чисел»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;

  it("the sound-alike distractors", async () => {
    expect(confusables(90).slice(0, 2)).toEqual([19, 900]);
    expect(confusables(19).slice(0, 2)).toEqual([90, 900]);
    expect(confusables(12).slice(0, 2)).toEqual([20, 200]);
    expect(confusables(200).slice(0, 2)).toEqual([20, 12]);
    expect(confusables(47).slice(0, 2)).toEqual([74, 17]);
    expect(confusables(305).slice(0, 2)).toEqual([350, 35]);
    expect(numberNameOptions(90).sort((a, b) => a - b)).toEqual([19, 90, 900]);
  });

  it("every number up to 999 is spoken from recorded words, and every word has a file", async () => {
    expect(numberAudioParts(347)).toEqual([300, 40, 7]);
    expect(numberAudioParts(315)).toEqual([300, 15]);
    expect(numberAudioParts(90)).toEqual([90]);
    for (const n of Object.keys(NUMBER_AUDIO_WORDS)) expect(existsSync(`public/audio/place-value-numbers/n${n}.mp3`)).toBe(true);
  });

  it("right answer: the card turns green and the name is shown", async () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(NumberNamesTask, task(), { onCorrect, onMistake });
    await wait();
    expect(h.button("Послушать")).toBeDefined();
    h.click("90");
    await wait();
    expect(h.button("90").className).toContain("nn-option--right");
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("n", "n");
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("«Обучение»: a wrong tap names what was tapped and stays crossed out", async () => {
    const onMistake = vi.fn();
    h.mount(NumberNamesTask, task(), { onMistake });
    await wait();
    h.click("19");
    await wait();
    expect(text(".sg-status-note")).toBe("19 — это «девятнадцать». А звучало другое число. Послушай ещё раз.");
    expect(h.button("19").disabled).toBe(true);
    expect(onMistake).toHaveBeenCalledTimes(1);
    h.click("90");
    await wait();
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
  });

  it("engine: sets and no immediate repeats; works without a card in the record", async () => {
    const tasks = generateTasks("number_names", [], 50, { set: "teens_tens" });
    expect(tasks).toHaveLength(50);
    expect(tasks.every((t, i) => (i === 0 || t.number !== tasks[i - 1].number) && t.options.includes(t.number) && t.options.length === 3 && t.cardId === "number_names")).toBe(true);
    expect(tasks.every((t) => (t.number >= 11 && t.number <= 19) || t.number % 10 === 0)).toBe(true);
    for (let i = 0; i < 200; i++) { const v = numberNamesNumber("three_digit"); expect(v >= 101 && v <= 999 && v % 100 !== 0).toBe(true); }
  });
});

describe("«Названия чисел» — «Услышь и напиши»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const type = (n) => { for (const d of String(n)) h.click(d); };
  const answer = (n) => { type(n); h.click("Проверить"); };
  const write = (extra = {}) => ({ type: "number_names", cardId: "n", conceptId: "n", number: 90, options: [19, 90, 900], task: "write", supportMode: "learning", ...extra });

  it("the child types the number", async () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(NumberNamesTask, write(), { onCorrect, onMistake });
    await wait();
    expect(text(".sg-title")).toBe("Услышь и напиши число");
    expect(h.container.querySelector(".nn-option")).toBeNull();
    answer(90);
    await wait();
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("«Обучение»: a wrong number is named, a wrong digit count names the places, two misses bring the choices back", async () => {
    const onMistake = vi.fn();
    h.mount(NumberNamesTask, write({ number: 305, options: [350, 305, 35] }), { onMistake });
    await wait();
    answer(3005);
    await wait();
    expect(text(".sg-status-note")).toBe("Триста пять — это 3 сотни, 0 десятков и 5 единиц. Сколько цифр нужно?");
    h.flush(); answer(350);
    await wait();
    expect(text(".sg-status-note")).toBe("350 — это «триста пятьдесят». А звучало другое число. Послушай ещё раз.");
    expect(text(".nn-choose-hint")).toBe("Какое число звучит? Выбери.");
    h.click("305");
    await wait();
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    expect(onMistake).toHaveBeenCalledTimes(2);
  });

  it("«Проверка»: no hints beyond «listen again», no choices", async () => {
    h.mount(NumberNamesTask, write({ supportMode: "independent" }));
    await wait();
    answer(19); h.flush(); answer(9);
    await wait();
    expect(text(".sg-status-note")).toBe("Послушай ещё раз.");
    expect(h.container.querySelector(".nn-option")).toBeNull();
  });

  it("engine passes the task kind", async () => {
    expect(generateTasks("number_names", [], 3, { task: "write" }).every((t) => t.task === "write")).toBe(true);
    expect(generateTasks("number_names", [], 3, {}).every((t) => t.task === "choose")).toBe(true);
  });
});

describe("«Названия чисел» — «Прочитай и выбери»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;
  const read = (extra = {}) => ({ type: "number_names", cardId: "n", conceptId: "n", number: 305, options: [350, 305, 35], task: "read", supportMode: "learning", ...extra });
  const word = (w) => Array.from(h.container.querySelectorAll(".nn-word")).find((b) => b.textContent.replace(/\s+/g, " ").trim() === w);

  it("the number is written, the options are names with the same root; words carry place colours", async () => {
    h.mount(NumberNamesTask, read());
    await wait();
    expect(text(".sg-title")).toBe("Прочитай и выбери название");
    expect(text(".nn-number")).toBe("305");
    expect(h.container.querySelector(".nn-diktor")).toBeNull();
    expect(Array.from(h.container.querySelectorAll(".nn-word")).map((b) => b.textContent.replace(/\s+/g, " ").trim()).sort())
      .toEqual(["тридцать пять", "триста пять", "триста пятьдесят"]);
    expect(word("триста пятьдесят").querySelector(".nn-w--hundreds").textContent).toBe("триста");
    expect(word("триста пятьдесят").querySelector(".nn-w--tens").textContent).toBe("пятьдесят");
  });

  it("«Обучение»: a wrong name is tied to its own number; the right one finishes", async () => {
    const onMistake = vi.fn(), onCorrect = vi.fn();
    h.mount(NumberNamesTask, read(), { onMistake, onCorrect });
    await wait();
    act(() => word("тридцать пять").click());
    await wait();
    expect(text(".sg-status-note")).toBe("«тридцать пять» — это 35. Прочитай число ещё раз.");
    act(() => word("триста пять").click());
    await wait();
    expect(h.container.querySelector(".sg-status-say")).toBeNull();
    expect(onMistake).toHaveBeenCalledTimes(1);
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalled();
  });

  it("«Проверка»: words without colours", async () => {
    h.mount(NumberNamesTask, read({ supportMode: "independent" }));
    await wait();
    expect(h.container.querySelector(".nn-w--hundreds")).toBeNull();
    act(() => word("тридцать пять").click());
    await wait();
    expect(text(".sg-status-note")).toBe("Прочитай ещё раз.");
  });

  it("engine passes «read»", async () => {
    expect(generateTasks("number_names", [], 3, { task: "read" }).every((t) => t.task === "read")).toBe(true);
  });
});

describe("No voice after a right answer", () => {
  const h = coinHarness();
  it("the right choice stops the voice and says nothing more", async () => {
    const { isSpeaking } = await import("./numberAudio.js");
    h.mount(NumberNamesTask, { type: "number_names", cardId: "n", conceptId: "n", number: 90, options: [19, 90, 900], supportMode: "learning" });
    await wait();
    h.click("90");
    expect(isSpeaking()).toBe(false);
    expect(h.button("Далее →")).toBeDefined();
  });
});
