import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { fixLetterTasks, generateTasks } from "../engine";

const mode = topic.modes.find((m) => m.id === "fix_letter");
const letters = topic.cards.filter((c) => Array.isArray(c.strokes) && c.strokes.length);
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

describe("print_letters engine — «Почини букву»", () => {
  it("is a game of cards with two settings — the difficulty and «Рамка и риски» (owner, 2026-11-04/05/06)", () => {
    expect(mode.type).toBe("fix_letter");
    expect(mode.finite).toBeUndefined();
    expect(mode.summaryOnFinish).toBeUndefined();
    expect(Object.keys(mode.params)).toEqual(["level", "frame"]);
    expect(mode.params.level.values).toEqual(["easy", "mid", "hard"]);
    expect(mode.params.level.default).toBe("easy");
  });

  it("a card for every letter, each once, in random order (owner: «это же игра»)", () => {
    const a = fixLetterTasks(letters, { level: "easy" }, seeded(1)).map((t) => t.card.id);
    const b = fixLetterTasks(letters, { level: "easy" }, seeded(2)).map((t) => t.card.id);
    expect(a.slice().sort()).toEqual(letters.map((c) => c.id).sort());
    expect(new Set(a).size).toBe(letters.length);
    expect(a).not.toEqual(letters.map((c) => c.id));          // not the deck order
    expect(a).not.toEqual(b);
    // old saved letter choices are ignored
    expect(generateTasks(mode, topic, 500, { letters: ["Г"], level: "easy" })).toHaveLength(letters.length);
  });

  it("the difficulty decides how the letter breaks; an unknown setting means «Легко»; the neighbours are labelled", () => {
    const [t] = fixLetterTasks(letters, { level: "mid" }, seeded(3));
    expect(t).toMatchObject({ type: "pl_fix_letter", level: "mid", broken: 2, tilt: true, mirror: false });
    expect(fixLetterTasks(letters, { level: "hard" })[0]).toMatchObject({ broken: "all", tilt: true, mirror: true });
    expect(fixLetterTasks(letters, { level: "x" })[0]).toMatchObject({ level: "easy", broken: 1, tilt: false, mirror: false });
    const tasks = fixLetterTasks(letters, {}, seeded(4));
    expect(tasks[1].prevLabel).toBe(tasks[0].card.label);
    expect(tasks[0].nextLabel).toBe(tasks[1].card.label);
  });
});
