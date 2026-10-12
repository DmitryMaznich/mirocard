import { describe, it, expect, vi } from "vitest";
import NumberNamesTask from "./NumberNamesTask.jsx";
import { confusables, numberNameOptions, numberNamesNumber } from "./numberNames.js";
import { numberAudioParts, NUMBER_AUDIO_WORDS } from "./numberAudio.js";
import { generateTasks } from "./engine.js";
import { coinHarness } from "./coinTestHelpers.jsx";
import { existsSync } from "node:fs";

const task = (extra = {}) => ({ type: "number_names", cardId: "n", conceptId: "n", number: 90, options: [19, 90, 9], supportMode: "learning", ...extra });

describe("«Названия чисел»", () => {
  const h = coinHarness();
  const text = (sel) => h.container.querySelector(sel)?.textContent;

  it("the sound-alike distractors", () => {
    expect(confusables(90).slice(0, 2)).toEqual([19, 900]);
    expect(confusables(19).slice(0, 2)).toEqual([90, 900]);
    expect(confusables(12).slice(0, 2)).toEqual([20, 200]);
    expect(confusables(200).slice(0, 2)).toEqual([20, 12]);
    expect(confusables(47).slice(0, 2)).toEqual([74, 17]);
    expect(confusables(305).slice(0, 2)).toEqual([350, 35]);
    expect(numberNameOptions(90).sort((a, b) => a - b)).toEqual([19, 90, 900]);
  });

  it("every number up to 999 is spoken from recorded words, and every word has a file", () => {
    expect(numberAudioParts(347)).toEqual([300, 40, 7]);
    expect(numberAudioParts(315)).toEqual([300, 15]);
    expect(numberAudioParts(90)).toEqual([90]);
    for (const n of Object.keys(NUMBER_AUDIO_WORDS)) expect(existsSync(`public/audio/place-value-numbers/n${n}.mp3`)).toBe(true);
  });

  it("right answer: the card turns green and the name is shown", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(NumberNamesTask, task(), { onCorrect, onMistake });
    expect(h.button("Послушать")).toBeDefined();
    h.click("90");
    expect(h.button("90").className).toContain("nn-option--right");
    expect(text(".sg-status-say")).toBe("90 — девяносто");
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("n", "n");
    expect(onMistake).not.toHaveBeenCalled();
  });

  it("«Обучение»: a wrong tap names what was tapped and stays crossed out", () => {
    const onMistake = vi.fn();
    h.mount(NumberNamesTask, task(), { onMistake });
    h.click("19");
    expect(text(".sg-status-note")).toBe("19 — это «девятнадцать». А звучало другое число. Послушай ещё раз.");
    expect(h.button("19").disabled).toBe(true);
    expect(onMistake).toHaveBeenCalledTimes(1);
    h.click("90");
    expect(text(".sg-status-say")).toBe("90 — девяносто");
  });

  it("engine: sets and no immediate repeats; works without a card in the record", () => {
    const tasks = generateTasks("number_names", [], 50, { set: "teens_tens" });
    expect(tasks).toHaveLength(50);
    expect(tasks.every((t, i) => (i === 0 || t.number !== tasks[i - 1].number) && t.options.includes(t.number) && t.options.length === 3 && t.cardId === "number_names")).toBe(true);
    expect(tasks.every((t) => (t.number >= 11 && t.number <= 19) || t.number % 10 === 0)).toBe(true);
    for (let i = 0; i < 200; i++) { const v = numberNamesNumber("three_digit"); expect(v >= 101 && v <= 999 && v % 100 !== 0).toBe(true); }
  });
});
