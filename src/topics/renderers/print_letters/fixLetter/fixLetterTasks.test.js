import { describe, it, expect } from "vitest";
import topic from "../../../../../tools/print_letters/topic.json";
import { generateTasks } from "../engine";

const mode = topic.modes.find((m) => m.id === "fix_letter");

describe("print_letters engine — «Почини букву»", () => {
  it("is a game of cards: not finite, no summary, starts with one broken part and a strong magnet", () => {
    expect(mode.type).toBe("fix_letter");
    expect(mode.finite).toBeUndefined();
    expect(mode.summaryOnFinish).toBeUndefined();
    expect(mode.params.broken.default).toBe("1");
    expect(mode.params.magnet.default).toBe("strong");
    expect(mode.params.tilt.default).toBe(false);
  });

  it("one card per chosen letter, in deck order, with the adult's settings", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: ["Н", "Г"], broken: "all", tilt: true, mirror: false, magnet: "normal" });
    expect(tasks.map((t) => t.card.id)).toEqual(["Г", "Н"]);
    expect(tasks[0]).toMatchObject({ type: "pl_fix_letter", broken: "all", tilt: true, mirror: false, magnet: "normal", sample: true, prevLabel: "Н", nextLabel: "Н" });
    expect(generateTasks(mode, topic, 500, { letters: ["Г"], broken: "2" })[0]).toMatchObject({ broken: 2, prevLabel: null, nextLabel: null });
  });

  it("takes every letter when none is chosen; unknown values fall back to the easy ones", () => {
    const tasks = generateTasks(mode, topic, 500, { letters: [], broken: "9", magnet: "x" });
    expect(tasks).toHaveLength(topic.cards.length);
    expect(tasks[0]).toMatchObject({ broken: 1, magnet: "strong", tilt: false, mirror: false });
  });
});
