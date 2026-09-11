import { describe, expect, it } from "vitest";
import { buildMyPeopleTopicRecord } from "@/topics/builtinMyPeopleTopic";
import { generateTasks } from "./engine";

const student = {
  id: "student_1",
  myPeople: [
    { id: "anna", name: "Анна", relation: "мама", contexts: ["family", "home"], photos: ["/api/photos/anna", "/api/photos/anna-2"], introducedAxes: ["name", "relation"], enabled: true },
    { id: "pavel", name: "Павел", relation: "папа", contexts: ["family", "home"], photos: ["/api/photos/pavel"], introducedAxes: ["name", "relation"], enabled: true },
    { id: "olga", name: "Ольга", relation: "бабушка", contexts: ["family"], photos: ["/api/photos/olga"], introducedAxes: ["name", "relation"], enabled: true },
    { id: "elena", name: "Елена", relation: "учительница", contexts: ["school"], photos: ["/api/photos/elena"], introducedAxes: ["name", "relation"], enabled: true },
    { id: "maks", name: "Макс", relation: "одноклассник", contexts: ["school"], photos: ["/api/photos/maks"], introducedAxes: ["name", "relation"], enabled: true },
    { id: "disabled", name: "Саша", relation: "брат", contexts: ["family"], photos: ["/api/photos/sasha"], introducedAxes: ["name", "relation"], enabled: false },
  ],
};

describe("my_people album engine", () => {
  it("uses 4, 6, or 8 portraits and keeps every mode in a renewable loop", () => {
    const topic = buildMyPeopleTopicRecord();
    const familyNames = topic.modes.find((mode) => mode.id === "family_names");
    const aboutMe = topic.modes.find((mode) => mode.id === "about_me");
    const whoIsThis = topic.modes.find((mode) => mode.id === "who_is_this");

    expect(familyNames.params.peopleCount.values).toEqual([4, 6, 8]);
    expect(topic.modes.every((mode) => mode.loop && mode.regenerateOnLoop)).toBe(true);
    expect(aboutMe).toEqual(expect.objectContaining({ type: "about_me", evaluation: "adult" }));
    expect(whoIsThis).toEqual(expect.objectContaining({ type: "person_naming", evaluation: "adult", hideConceptPicker: true }));
  });

  it("does not generate an about-me block with fewer than two included facts", () => {
    const tasks = generateTasks(
      { id: "about_me", type: "about_me" },
      {
        id: "student_about_me",
        name: "Лиза",
        myPeopleProfile: {
          includeSelfName: true,
          includeFamilyName: false,
          includeFamilyLabel: false,
          includeCity: false,
        },
      },
    );

    expect(tasks).toEqual([]);
  });

  it("builds situational about-me cards from included profile facts only", () => {
    const tasks = generateTasks(
      { id: "about_me", type: "about_me" },
      {
        id: "student_about_me",
        name: "Лиза",
        myPeopleProfile: {
          familyName: "Скрытая фамилия",
          familyLabel: "Скрытая семья",
          city: "Новоград",
          address: "Совершенно секретный адрес, 7",
          includeSelfName: true,
          includeFamilyName: false,
          includeFamilyLabel: false,
          includeCity: true,
          includeAddress: true,
        },
      },
    );

    expect(tasks).toHaveLength(3);
    expect(tasks.every((task) => task.type === "about_me_situation")).toBe(true);
    expect(tasks.map((task) => task.factIds)).toEqual([
      ["self_name", "city"],
      ["self_name", "city"],
      ["self_name", "city"],
    ]);
    expect(tasks.map((task) => task.situation)).toEqual([
      "Тебя записывают в кружок.",
      "С тобой знакомится новый учитель.",
      "У твоей работы на выставке есть карточка.",
    ]);

    const content = JSON.stringify(tasks);
    expect(content).toContain("Лиза");
    expect(content).toContain("Новоград");
    expect(content).not.toContain("Скрытая фамилия");
    expect(content).not.toContain("Скрытая семья");
  });

  it("never puts an address into an about-me card", () => {
    const tasks = generateTasks(
      { id: "about_me", type: "about_me" },
      {
        id: "student_about_me",
        name: "Лиза",
        myPeopleProfile: {
          familyName: "Иванова",
          familyLabel: "семья Ивановых",
          city: "Новоград",
          address: "Совершенно секретный адрес, 7",
          includeSelfName: true,
          includeFamilyName: true,
          includeFamilyLabel: true,
          includeCity: true,
          includeAddress: true,
        },
      },
    );

    expect(JSON.stringify(tasks)).not.toContain("Совершенно секретный адрес, 7");
    expect(tasks.every((task) => !task.factIds.includes("address"))).toBe(true);
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

  it("introduces a new person before including them in a name album", () => {
    const people = student.myPeople.slice(0, 2).map((person) => (
      person.id === "anna" ? { ...person, introducedAxes: [] } : person
    ));
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, { ...student, myPeople: people });

    expect(tasks.map((task) => task.type)).toEqual(["person_intro", "people_album"]);
    expect(tasks[0]).toEqual(expect.objectContaining({
      personId: "anna",
      axis: "name",
      label: "Анна",
      promptSpeech: "Это Анна.",
      progressConceptIds: [],
    }));
    // There is only one familiar person, so preserve the two-person album.
    expect(tasks[1].entries.map((entry) => entry.personId).sort()).toEqual(["anna", "pavel"]);
  });

  it("sends already introduced people directly to the album", () => {
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, student);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("people_album");
  });

  it("adds introductions only for the missing axes in a mixed block", () => {
    const people = student.myPeople.slice(0, 3).map((person) => {
      if (person.id === "anna") return { ...person, introducedAxes: ["name"] };
      if (person.id === "olga") return { ...person, introducedAxes: [] };
      return person;
    });
    const tasks = generateTasks({ id: "mix", type: "people_album" }, { ...student, myPeople: people });
    const introductions = tasks.filter((task) => task.type === "person_intro");

    expect(introductions.map((task) => `${task.personId}:${task.axis}`).sort()).toEqual([
      "anna:relation",
      "olga:name",
      "olga:relation",
    ]);
    expect(tasks.findIndex((task) => task.type === "people_album" && task.axis === "name"))
      .toBeGreaterThan(tasks.findIndex((task) => task.type === "person_intro" && task.axis === "name"));
    expect(tasks.findIndex((task) => task.type === "people_album" && task.axis === "relation"))
      .toBeGreaterThan(tasks.findIndex((task) => task.type === "person_intro" && task.axis === "relation"));
  });

  it("does not produce a one-person album", () => {
    const singlePersonStudent = { ...student, myPeople: [student.myPeople[3]] };
    expect(generateTasks({ id: "school_names", type: "people_album" }, singlePersonStudent)).toEqual([]);
  });

  it("asks to name only introduced axes without repeating a person in the round", () => {
    const people = [
      { id: "anna", name: "Анна", relation: "мама", contexts: ["family"], photos: ["/api/photos/anna"], introducedAxes: ["name"], enabled: true },
      { id: "teacher_1", name: "Ирина", relation: "учитель", contexts: ["school"], photos: ["/api/photos/teacher_1"], introducedAxes: ["relation"], enabled: true },
      { id: "teacher_2", name: "Марина", relation: "учитель", contexts: ["school"], photos: ["/api/photos/teacher_2"], introducedAxes: ["relation"], enabled: true },
      { id: "new_person", name: "Саша", relation: "друг", contexts: ["home"], photos: ["/api/photos/new_person"], introducedAxes: [], enabled: true },
    ];
    const tasks = generateTasks({ id: "who_is_this", type: "person_naming" }, { ...student, myPeople: people });

    expect(tasks).toHaveLength(3);
    expect(tasks.every((task) => task.type === "person_naming")).toBe(true);
    expect(new Set(tasks.map((task) => task.personId)).size).toBe(tasks.length);
    expect(tasks.map((task) => task.personId).sort()).toEqual(["anna", "teacher_1", "teacher_2"]);
    expect(tasks.find((task) => task.personId === "anna")).toEqual(expect.objectContaining({
      axis: "name", prompt: "Кто это?", answer: "Анна",
    }));
    expect(tasks.filter((task) => task.axis === "relation").map((task) => task.answer)).toEqual(["учитель", "учитель"]);
  });

  it("does not ask naming questions before any axis was introduced", () => {
    const people = student.myPeople.slice(0, 2).map((person) => ({ ...person, introducedAxes: [] }));
    expect(generateTasks({ id: "who_is_this", type: "person_naming" }, { ...student, myPeople: people })).toEqual([]);
  });

  it("keeps the selected album limit when the final group would contain one person", () => {
    const ninePeople = Array.from({ length: 9 }, (_, index) => ({
      id: `person_${index}`,
      name: `Имя ${index}`,
      contexts: ["family"],
      photos: [`/api/photos/${index}`],
      introducedAxes: ["name"],
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
      introducedAxes: ["name"],
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
