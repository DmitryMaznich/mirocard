import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { generateTasks } from "../engine";

const mode = topic.modes.find((m) => m.id === "fix_letter");

describe("print_letters engine — «Почини букву»", () => {
  it("is a game of cards with two settings only: the letters and the difficulty (owner, 2026-11-04)", () => {
    expect(mode.type).toBe("fix_letter");
    expect(mode.finite).toBeUndefined();
    expect(mode.summaryOnFinish).toBeUndefined();
    expect(Object.keys(mode.params)).toEqual(["letters", "level"]);
    expect(mode.params.level.values).toEqual(["easy", "mid", "hard"]);
    expect(mode.params.level.default).toBe("easy");
  });

  it("one card per chosen letter, in deck order; the difficulty decides how the letter breaks", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: ["Н", "Г"], level: "mid" });
    expect(tasks.map((t) => t.card.id)).toEqual(["Г", "Н"]);
    expect(tasks[0]).toMatchObject({ type: "pl_fix_letter", level: "mid", broken: 2, tilt: true, mirror: false, prevLabel: "Н", nextLabel: "Н" });
    expect(generateTasks(mode, topic, 500, { letters: ["Г"], level: "hard" })[0]).toMatchObject({ broken: "all", tilt: true, mirror: true, prevLabel: null, nextLabel: null });
  });

  it("takes every letter when none is chosen; an unknown or old setting means «Легко»", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: [], level: "x", broken: "all", tilt: true });
    expect(tasks).toHaveLength(topic.cards.length);
    expect(tasks[0]).toMatchObject({ level: "easy", broken: 1, tilt: false, mirror: false });
  });
});
