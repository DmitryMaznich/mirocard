import { describe, expect, it } from "vitest";
import { buildMyPeopleTopicRecord } from "@/topics/builtinMyPeopleTopic";
import { generateTasks } from "./engine";

const student = {
  id: "student_1",
  myPeople: [
    { id: "anna", name: "Анна", relation: "мама", contexts: ["family", "home"], photos: ["/api/photos/anna", "/api/photos/anna-2"], enabled: true },
    { id: "pavel", name: "Павел", relation: "папа", contexts: ["family", "home"], photos: ["/api/photos/pavel"], enabled: true },
    { id: "olga", name: "Ольга", relation: "бабушка", contexts: ["family"], photos: ["/api/photos/olga"], enabled: true },
    { id: "elena", name: "Елена", relation: "учительница", contexts: ["school"], photos: ["/api/photos/elena"], enabled: true },
    { id: "maks", name: "Макс", relation: "одноклассник", contexts: ["school"], photos: ["/api/photos/maks"], enabled: true },
    { id: "disabled", name: "Саша", relation: "брат", contexts: ["family"], photos: ["/api/photos/sasha"], enabled: false },
  ],
};

describe("my_people album engine", () => {
  it("uses 4, 6, or 8 portraits and keeps every mode in a renewable loop", () => {
    const topic = buildMyPeopleTopicRecord();

    expect(topic.modes[0].params.peopleCount.values).toEqual([4, 6, 8]);
    expect(topic.modes.every((mode) => mode.loop && mode.regenerateOnLoop)).toBe(true);
  });

  it("builds an album where names are independent answers for every displayed person", () => {
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, student, { peopleCount: 4 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual(expect.objectContaining({ type: "people_album", axis: "name", prompt: "Подбери имена" }));
    expect(tasks[0].entries).toHaveLength(3);
    expect(tasks[0].answers.map((answer) => answer.label).sort()).toEqual(["Анна", "Ольга", "Павел"]);
    expect(tasks[0].entries.map((entry) => entry.conceptId)).toEqual(expect.arrayContaining(["anna:name", "pavel:name", "olga:name"]));
    expect(tasks[0].progressConceptIds).toEqual(expect.arrayContaining(["anna:name", "pavel:name", "olga:name"]));
  });

  it("uses a separate relationship axis without conflating it with a name", () => {
    const tasks = generateTasks({ id: "family_relations", type: "people_album" }, student);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].axis).toBe("relation");
    expect(tasks[0].answers.map((answer) => answer.label)).toEqual(expect.arrayContaining(["мама", "папа", "бабушка"]));
    expect(tasks[0].entries.map((entry) => entry.conceptId)).toEqual(expect.arrayContaining(["anna:relation", "pavel:relation", "olga:relation"]));
  });

  it("does not produce a one-person album", () => {
    const singlePersonStudent = { ...student, myPeople: [student.myPeople[3]] };
    expect(generateTasks({ id: "school_names", type: "people_album" }, singlePersonStudent)).toEqual([]);
  });

  it("keeps the selected album limit when the final group would contain one person", () => {
    const ninePeople = Array.from({ length: 9 }, (_, index) => ({
      id: `person_${index}`,
      name: `Имя ${index}`,
      contexts: ["family"],
      photos: [`/api/photos/${index}`],
      enabled: true,
    }));
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, { ...student, myPeople: ninePeople }, { peopleCount: 8 });

    expect(tasks.map((task) => task.entries.length).sort()).toEqual([4, 5]);
    expect(tasks.every((task) => task.entries.length >= 2 && task.entries.length <= 8)).toBe(true);
  });

  it("uses the available five people without placeholder cards when six are selected", () => {
    const fiveFamilyPeople = Array.from({ length: 5 }, (_, index) => ({
      id: `family_${index}`,
      name: `Семья ${index}`,
      contexts: ["family"],
      photos: [`/api/photos/family_${index}`],
      enabled: true,
    }));
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, { ...student, myPeople: fiveFamilyPeople }, { peopleCount: 6 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].entries).toHaveLength(5);
    expect(tasks[0].answers).toHaveLength(5);
  });

  it("uses a different photo for the same person in the next loop round when possible", () => {
    const firstRound = generateTasks({ id: "family_names", type: "people_album" }, student, { peopleCount: 4 });
    const previousImages = new Map(
      firstRound.flatMap((task) => task.entries.map((entry) => [`${entry.personId}:${task.axis}`, entry.image])),
    );
    const nextRound = generateTasks({ id: "family_names", type: "people_album" }, student, { peopleCount: 4 }, previousImages);
    const firstAnnaPhoto = firstRound.flatMap((task) => task.entries).find((entry) => entry.personId === "anna").image;
    const nextAnnaPhoto = nextRound.flatMap((task) => task.entries).find((entry) => entry.personId === "anna").image;

    expect(nextAnnaPhoto).not.toBe(firstAnnaPhoto);
  });

  it("keeps names and relationships in separate albums inside the mixed block", () => {
    const tasks = generateTasks({ id: "mix", type: "people_album" }, student, { peopleCount: 4 });
    const nameTasks = tasks.filter((task) => task.axis === "name");
    const relationTasks = tasks.filter((task) => task.axis === "relation");

    expect(tasks.map((task) => task.axis)).toEqual(["name", "name", "relation", "relation"]);
    const namePhoto = nameTasks.flatMap((task) => task.entries).find((entry) => entry.personId === "anna").image;
    const relationPhoto = relationTasks.flatMap((task) => task.entries).find((entry) => entry.personId === "anna").image;
    expect(["/api/photos/anna", "/api/photos/anna-2"]).toContain(namePhoto);
    expect(relationPhoto).not.toBe(namePhoto);
  });
});
