import { describe, expect, it } from "vitest";
import { generateTasks } from "./engine";

const student = {
  id: "student_1",
  name: "Иван",
  photo: "/api/photos/ivan",
  myPeopleProfile: { familyName: "Петров", includeFamilyName: true },
  myPeople: [
    { id: "anna", name: "Анна", relation: "мама", contexts: ["family", "home"], photos: ["/api/photos/anna"], enabled: true },
    { id: "pavel", name: "Павел", relation: "папа", contexts: ["family", "home"], photos: ["/api/photos/pavel"], enabled: true },
    { id: "elena", name: "Елена", relation: "учительница", contexts: ["school"], photos: ["/api/photos/elena"], enabled: true },
    { id: "disabled", name: "Саша", relation: "брат", contexts: ["family"], photos: ["/api/photos/sasha"], enabled: false },
  ],
};

describe("my_people engine", () => {
  it("keeps a name and a relationship as independent teaching cards", () => {
    const names = generateTasks({ id: "family_names_intro", type: "intro" }, student);
    const relations = generateTasks({ id: "family_relations_intro", type: "intro" }, student);

    expect(names).toHaveLength(2);
    expect(names.map((task) => task.label)).toEqual(expect.arrayContaining(["Анна", "Павел"]));
    expect(relations.map((task) => task.label)).toEqual(expect.arrayContaining(["мама", "папа"]));
    expect(relations.map((task) => task.conceptId)).toEqual(expect.arrayContaining(["anna:relation", "pavel:relation"]));
  });

  it("uses the requested context and always makes a distinct photo distractor", () => {
    const tasks = generateTasks({ id: "family_names_find", type: "find_n" }, student, { optionCount: 2 });

    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      expect(task.targetLabel).toMatch(/^Где /);
      expect(task.targetConceptId).toMatch(/:(name|relation)$/);
      expect(task.options).toHaveLength(2);
      expect(task.options.filter((option) => option.isTarget)).toHaveLength(1);
      expect(new Set(task.options.map((option) => option.card.image)).size).toBe(2);
    }
  });

  it("does not create an impossible recognition task when a group has one person", () => {
    expect(generateTasks({ id: "school_names_find", type: "find_n" }, student)).toEqual([]);
  });

  it("makes personal answers adult-assessed and draws the answer from the profile", () => {
    const tasks = generateTasks({ id: "family_name", type: "question_answer" }, student);
    expect(tasks).toEqual([expect.objectContaining({ type: "question_answer", label: "Петров", card: expect.objectContaining({ image: "/api/photos/ivan" }) })]);
  });
});
