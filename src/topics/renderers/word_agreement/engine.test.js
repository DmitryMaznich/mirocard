import { describe, expect, it } from "vitest";
import { generateTasks, FORMS_BY_WORD } from "./engine";

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

const NUMERAL_CARDS = [
  { id: "few", skill: "numeral_agreement", word: "myach", optionSet: "singular", answer: "мяча" },
  { id: "many", skill: "numeral_agreement", word: "myach", optionSet: "plural", answer: "мячей" },
];

const ADJECTIVE_CARDS = [
  { id: "masc", skill: "adjective_agreement", adjective: "bolshoy", answer: "большой" },
  { id: "fem", skill: "adjective_agreement", adjective: "bolshoy", answer: "большая" },
  { id: "neut", skill: "adjective_agreement", adjective: "bolshoy", answer: "большое" },
  { id: "plural", skill: "adjective_agreement", adjective: "bolshoy", answer: "большие" },
];

const POSSESSIVE_CARDS = [
  { id: "masc", skill: "possessive_agreement", possessive: "svoy", answer: "свой" },
  { id: "fem", skill: "possessive_agreement", possessive: "svoy", answer: "свою" },
  { id: "neut", skill: "possessive_agreement", possessive: "svoy", answer: "своё" },
  { id: "plural", skill: "possessive_agreement", possessive: "svoy", answer: "свои" },
];

const PREPOSITION_CARDS = [
  {
    id: "ball_box_in",
    skill: "prepositions",
    relation: "in",
    distractorRelations: ["on"],
  },
  {
    id: "ball_table_on",
    skill: "prepositions",
    relation: "on",
    distractorRelations: ["under"],
  },
];

describe("word agreement task generation", () => {
  it("starts case agreement with two options and hides advanced cards by default", () => {
    const tasks = generateTasks({ type: "case_agreement" }, CASE_CARDS, 500, { optionCount: 2 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].options).toHaveLength(2);
    expect(tasks[0].options).toContain("мяча");
  });

  it("has a valid 6-form pool for every newly added lexical set", () => {
    for (const word of ["stol", "kniga", "kukla", "okno", "yaytso"]) {
      expect(FORMS_BY_WORD[word].singular).toHaveLength(6);
      expect(FORMS_BY_WORD[word].plural).toHaveLength(6);
    }
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

  it("uses two third-person forms at the basic verb level", () => {
    const tasks = generateTasks({ type: "verb_number_agreement" }, VERB_CARDS, 500, { optionCount: 2 });

    for (const task of tasks) {
      expect(new Set(task.options)).toEqual(new Set(["лежит", "лежат"]));
    }
  });

  it("adds only same-verb present-tense forms at higher levels", () => {
    const fourOptions = generateTasks({ type: "verb_number_agreement" }, VERB_CARDS, 500, { optionCount: 4 });
    const sixOptions = generateTasks({ type: "verb_number_agreement" }, VERB_CARDS, 500, { optionCount: 6 });
    const allForms = new Set(["лежу", "лежишь", "лежит", "лежим", "лежите", "лежат"]);

    for (const task of fourOptions) {
      expect(new Set(task.options)).toEqual(new Set(["лежу", "лежит", "лежим", "лежат"]));
      expect(task.options).toContain(task.card.answer);
    }
    for (const task of sixOptions) {
      expect(new Set(task.options)).toEqual(allForms);
      expect(task.options).toContain(task.card.answer);
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
      "открылся", "открылась", "открылось", "открылись",
    ]);

    expect(tasks).toHaveLength(4);
    for (const task of tasks) {
      expect(task.options).toHaveLength(4);
      expect(task.options).toContain(task.card.answer);
      expect(task.options.every((option) => pastTenseForms.has(option))).toBe(true);
    }
  });

  it("draws numeral agreement options from the same singular/plural pools as case agreement", () => {
    const tasks = generateTasks({ type: "numeral_agreement" }, NUMERAL_CARDS, 500, { optionCount: 3 });

    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      expect(task.options).toHaveLength(3);
      expect(task.options).toContain(task.card.answer);
    }
  });

  it("offers adjective forms for gender agreement, keyed to the correct answer", () => {
    const tasks = generateTasks({ type: "adjective_agreement" }, ADJECTIVE_CARDS, 500, { optionCount: 4 });
    const adjectiveForms = new Set([
      "большой", "большая", "большое", "большие",
      "маленький", "маленькая", "маленькое", "маленькие",
      "новый", "новая", "новое", "новые",
    ]);

    expect(tasks).toHaveLength(4);
    for (const task of tasks) {
      expect(task.options).toHaveLength(4);
      expect(task.options).toContain(task.card.answer);
      expect(task.options.every((option) => adjectiveForms.has(option))).toBe(true);
    }
  });

  it("offers possessive forms for gender agreement, keyed to the correct answer", () => {
    const tasks = generateTasks({ type: "possessive_agreement" }, POSSESSIVE_CARDS, 500, { optionCount: 4 });
    const possessiveForms = new Set([
      "свой", "свою", "своё", "свои",
      "мой", "моя", "моё", "мои",
      "твой", "твоя", "твоё", "твои",
      "наш", "наша", "наше", "наши",
    ]);

    expect(tasks).toHaveLength(4);
    for (const task of tasks) {
      expect(task.options).toHaveLength(4);
      expect(task.options).toContain(task.card.answer);
      expect(task.options.every((option) => possessiveForms.has(option))).toBe(true);
    }
  });

  it("keeps preposition contrasts concrete and selects the requested practice form", () => {
    const tasks = generateTasks(
      { type: "prepositions" },
      PREPOSITION_CARDS,
      500,
      { practice: "place" },
    );

    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      expect(task.type).toBe("preposition_place");
      expect(task.options).toHaveLength(2);
      expect(task.options).toContain(task.card.relation);
      expect(new Set(task.options).size).toBe(task.options.length);
    }
  });

  it("uses recognition practice when the preposition setting is missing or invalid", () => {
    const [defaultTask] = generateTasks({ type: "prepositions" }, PREPOSITION_CARDS, 500, {});
    const [invalidTask] = generateTasks({ type: "prepositions" }, PREPOSITION_CARDS, 500, { practice: "draw" });

    expect(defaultTask.type).toBe("preposition_recognize");
    expect(invalidTask.type).toBe("preposition_recognize");
  });
});
