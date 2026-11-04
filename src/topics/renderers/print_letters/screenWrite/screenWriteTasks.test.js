import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { generateTasks } from "../engine";

const mode = topic.modes.find((m) => m.id === "screen_write");

describe("print_letters engine — «Пишу на экране»", () => {
  it("is a mode of the deck with three levels", () => {
    expect(mode.params.level.values).toEqual(["watch", "trace", "free"]);
  });

  it("gives every chosen letter `copies` times in a row, in deck order", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: ["Т", "Г"], level: "trace", copies: 3 });
    expect(tasks.map((t) => t.card.id)).toEqual(["Г", "Г", "Г", "Т", "Т", "Т"]);
    expect(tasks.every((t) => t.type === "pl_screen_write" && t.card.strokes.length > 0)).toBe(true);
    expect(tasks.map((t) => t.copy)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("takes every letter when none is chosen, and one look per letter on «Смотрю»", () => {
    expect(generateTasks(mode, topic, 500, { letters: [], copies: 1 })).toHaveLength(topic.cards.length);
    expect(generateTasks(mode, topic, 500, { letters: ["П"], level: "watch", copies: 5 })).toHaveLength(1);
  });

  it("passes the adult's settings to the task", () => {
    const [t] = generateTasks(mode, topic, 500, { letters: ["П"], level: "free", width: "narrow", hidden: true, lefty: true, sound: false });
    expect(t).toMatchObject({ level: "free", width: "narrow", hidden: true, lefty: true, sound: false });
  });

  it("keeps the constructor mode as it was", () => {
    const [t] = generateTasks(topic.modes[0], topic.cards);
    expect(t.type).toBe("constructor");
  });
});
