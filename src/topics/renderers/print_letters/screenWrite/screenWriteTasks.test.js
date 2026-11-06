import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { generateTasks } from "../engine";

const mode = topic.modes.find((m) => m.id === "screen_write");

describe("print_letters engine — «Пишу на экране»", () => {
  it("is a mode of the deck with two levels — «Обвожу» and «Сам»", () => {
    expect(mode.params.level.values).toEqual(["trace", "free"]);
  });

  it("«Вспомогательные линии» is on unless switched off, apart from «Рамка», in both screen modes", () => {
    const fix = topic.modes.find((m) => m.id === "fix_letter");
    expect(mode.params.guides.default).toBe(true);
    expect(fix.params.guides.default).toBe(true);
    const [t] = generateTasks(mode, topic, 500, { letters: ["Г"], copies: 1, guides: false });
    expect([t.frame, t.guides]).toEqual([true, false]);
    expect(generateTasks(fix, topic, 500, { frame: false }).every((x) => x.frame === false && x.guides === true)).toBe(true);
  });

  it("«Рамка» is on unless switched off, in both screen modes", () => {
    const fix = topic.modes.find((m) => m.id === "fix_letter");
    expect(mode.params.frame.default).toBe(true);
    expect(fix.params.frame.default).toBe(true);
    expect(generateTasks(mode, topic, 500, { letters: ["Г"], copies: 1 })[0].frame).toBe(true);
    expect(generateTasks(mode, topic, 500, { letters: ["Г"], copies: 1, frame: false })[0].frame).toBe(false);
    expect(generateTasks(fix, topic, 500, {}).every((t) => t.frame === true)).toBe(true);
    expect(generateTasks(fix, topic, 500, { frame: false }).every((t) => t.frame === false)).toBe(true);
  });

  it("gives every chosen letter `copies` times in a row, in deck order", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: ["Т", "Г"], level: "trace", copies: 3 });
    expect(tasks.map((t) => t.card.id)).toEqual(["Г", "Г", "Г", "Т", "Т", "Т"]);
    expect(tasks.every((t) => t.type === "pl_screen_write" && t.card.strokes.length > 0)).toBe(true);
    expect(tasks.map((t) => t.copy)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("takes every letter when none is chosen; a saved «Смотрю» becomes «Обвожу»", () => {
    expect(generateTasks(mode, topic, 500, { letters: [], copies: 1 })).toHaveLength(topic.cards.length);
    const watch = generateTasks(mode, topic, 500, { letters: ["П"], level: "watch", copies: 2 });
    expect(watch).toHaveLength(2);
    expect(watch[0].level).toBe("trace");
  });

  it("passes the adult's settings to the task", () => {
    const [t] = generateTasks(mode, topic, 500, { letters: ["П"], level: "free", width: "narrow", hidden: true, sound: false });
    expect(t).toMatchObject({ level: "free", width: "narrow", sound: false });
    expect(t.hidden).toBeUndefined(); // «Спрятанная буква» removed (owner, 2026-11-04)
  });

  it("names the letters to go back to and on to (the set ends after its last letter)", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: ["Г", "Т"], copies: 2 });
    expect(tasks.map((t) => [t.prevLabel, t.nextLabel])).toEqual([[null, "Г"], ["Г", "Т"], ["Г", "Т"], ["Т", null]]);
    expect(generateTasks(mode, topic, 500, { letters: ["П"], copies: 1 })[0].nextLabel).toBeNull();
  });

  it("is a set that ends on its own, with the usual star series", () => {
    expect(mode.finite).toBe(true);
    expect(mode.rewardPerBlock).toBeUndefined();
    expect(mode.evaluation).toBe("instant");
  });

  it("keeps the constructor mode as it was", () => {
    const [t] = generateTasks(topic.modes[0], topic.cards);
    expect(t.type).toBe("constructor");
  });
});
