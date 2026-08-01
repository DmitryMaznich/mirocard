import { describe, expect, it } from "vitest";
import { generateTasks } from "./engine";

const CASE_CARDS = [
  { id: "basic", skill: "case_agreement", word: "myach", optionSet: "singular", answer: "мяча" },
  { id: "advanced", skill: "case_agreement", word: "myach", optionSet: "plural", answer: "мячах", difficulty: "advanced" },
];

const VERB_CARDS = [
  { id: "singular", skill: "verb_number_agreement", verb: "lezhat", answer: "лежит" },
  { id: "plural", skill: "verb_number_agreement", verb: "lezhat", answer: "лежат" },
];

const VERB_GENDER_CARDS = [
  { id: "masc", skill: "verb_gender_agreement", verb: "upast", answer: "упал" },
  { id: "fem", skill: "verb_gender_agreement", verb: "upast", answer: "упала" },
  { id: "neut", skill: "verb_gender_agreement", verb: "upast", answer: "упало" },
  { id: "plural", skill: "verb_gender_agreement", verb: "upast", answer: "упали" },
];

describe("word agreement task generation", () => {
  it("starts case agreement with two options and hides advanced cards by default", () => {
    const tasks = generateTasks({ type: "case_agreement" }, CASE_CARDS, 500, { optionCount: 2 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].options).toHaveLength(2);
    expect(tasks[0].options).toContain("мяча");
  });

  it("includes advanced case cards only when the setting is enabled", () => {
    const tasks = generateTasks(
      { type: "case_agreement" },
      CASE_CARDS,
      500,
      { optionCount: 4, includeAdvancedCards: true },
    );

    expect(tasks).toHaveLength(2);
    expect(tasks.every((task) => task.options.length === 4)).toBe(true);
  });

  it("uses only third-person verb forms while increasing options", () => {
    const tasks = generateTasks({ type: "verb_number_agreement" }, VERB_CARDS, 500, { optionCount: 4 });
    const thirdPersonForms = new Set([
      "лежит", "лежат", "катится", "катятся", "падает", "падают", "стоит", "стоят",
      "едет", "едут", "висит", "висят", "играет", "играют", "рисует", "рисуют",
      "идёт", "идут", "гуляет", "гуляют",
    ]);

    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      expect(task.options).toHaveLength(4);
      expect(task.options).toContain(task.card.answer);
      expect(task.options.every((option) => thirdPersonForms.has(option))).toBe(true);
    }
  });

  it("offers past-tense verb forms for gender agreement, keyed to the correct answer", () => {
    const tasks = generateTasks({ type: "verb_gender_agreement" }, VERB_GENDER_CARDS, 500, { optionCount: 4 });
    const pastTenseForms = new Set([
      "упал", "упала", "упало", "упали",
      "пошёл", "пошла", "пошло", "пошли",
      "пришёл", "пришла", "пришло", "пришли",
      "лежал", "лежала", "лежало", "лежали",
      "стоял", "стояла", "стояло", "стояли",
      "покатился", "покатилась", "покатилось", "покатились",
    ]);

    expect(tasks).toHaveLength(4);
    for (const task of tasks) {
      expect(task.options).toHaveLength(4);
      expect(task.options).toContain(task.card.answer);
      expect(task.options.every((option) => pastTenseForms.has(option))).toBe(true);
    }
  });
});
