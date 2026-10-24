import { describe, expect, it } from "vitest";
import { buildMyPeopleTopicRecord } from "@/topics/builtinMyPeopleTopic";
import { readModeParams, writeModeParams } from "@/shared/utils/topicUtils";
import { aboutMeHistory, ageFromBirthDate, firstSyllable, generateTasks, mainWord, MAX_POINT_TRIALS_PER_ROUND, MIN_POINT_TRIALS_PER_ROUND, getAboutMeQuestions, hasEnoughAboutMeQuestions, insertRetryTrial, MAX_ABOUT_ME_QUESTIONS_PER_ROUND } from "./engine";

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
  it("offers one «Подпиши фото» mode with 2–6 photos and keeps every mode in a renewable loop", () => {
    const topic = buildMyPeopleTopicRecord();
    const labelPhotos = topic.modes.find((mode) => mode.id === "label_photos");
    const aboutMe = topic.modes.find((mode) => mode.id === "about_me");
    const whoIsThis = topic.modes.find((mode) => mode.id === "who_is_this");

    expect(labelPhotos.params.peopleCount.values).toEqual([2, 3, 4, 6]);
    expect(labelPhotos.params.peopleCount.default).toBe(2);
    expect(labelPhotos.params.circle.values).toEqual(["family", "home", "school", "all"]);
    expect(topic.modes.every((mode) => mode.loop && mode.regenerateOnLoop)).toBe(true);
    expect(aboutMe).toEqual(expect.objectContaining({ type: "about_me", evaluation: "adult" }));
    expect(whoIsThis).toEqual(expect.objectContaining({ type: "person_naming", evaluation: "adult", hideConceptPicker: true }));
  });

  it("lists the modes in teaching order and keeps the old album modes only as retired", () => {
    const modes = buildMyPeopleTopicRecord().modes;
    expect(modes.filter((mode) => !mode.retired).map((mode) => mode.id))
      .toEqual(["match_same", "show_me", "who_is_this", "about_me", "label_photos", "introduce_self"]);
    expect(modes.filter((mode) => mode.retired).map((mode) => mode.id))
      .toEqual(["family_names", "family_relations", "home_names", "home_relations", "school_names", "school_relations", "mix"]);
  });

  it("keeps each mode's settings apart, carrying over the old shared ones", () => {
    const modes = buildMyPeopleTopicRecord().modes;
    const match = modes.find((mode) => mode.id === "match_same");
    const showMe = modes.find((mode) => mode.id === "show_me");
    // Saved before, in one object for the whole topic.
    let saved = { sample: "same", fieldSize: 3 };
    expect(readModeParams(saved, match)).toEqual(expect.objectContaining({ sample: "same", fieldSize: 3 }));
    saved = writeModeParams(saved, match, { ...readModeParams(saved, match), sample: "same" });
    // A lesson of «Покажи» on 4 photos no longer resets «Образец» or the field.
    saved = writeModeParams(saved, showMe, { ...readModeParams(saved, showMe), fieldSize: 4 });
    expect(readModeParams(saved, match)).toEqual(expect.objectContaining({ sample: "same", fieldSize: 3 }));
    expect(readModeParams(saved, showMe).fieldSize).toBe(4);
  });

  const introduce = { id: "introduce_self", type: "about_me" };
  const lisa = (profile) => ({ id: "student_about_me", name: "Лиза", myPeopleProfile: { includeSelfName: true, ...profile } });

  it("does not start a conversation with fewer than two facts", () => {
    expect(generateTasks(introduce, lisa({ includeFamilyName: false, includeCity: false }))).toEqual([]);
  });

  it("asks the facts one by one in whole sentences, then all of them at once", () => {
    const tasks = generateTasks(introduce, lisa({ city: "Новоград", includeCity: true }), {}, new Map(), {}, 0);
    expect(tasks.every((task) => task.type === "introduce_turn")).toBe(true);
    expect(tasks.map((task) => [task.conceptId, task.prompt, task.answer])).toEqual([
      ["introduce:name", "Как тебя зовут?", "Меня зовут Лиза."],
      ["introduce:city", "Где ты живёшь?", "Мой город — Новоград."],
      ["introduce:all", "Расскажи о себе.", "Меня зовут Лиза. Мой город — Новоград."],
    ]);
    // The partner greets once, at the start of the conversation.
    expect(tasks[0].promptSpeech).toBe("Здравствуй! Как тебя зовут?");
    expect(tasks[1].promptSpeech).toBe("Где ты живёшь?");
    expect(tasks[2].starter).toBe("Меня зовут … Мой город — …");
  });

  it("meets a different partner each round and starts from the chosen script level", () => {
    const student = lisa({ city: "Новоград", includeCity: true });
    expect(generateTasks(introduce, student, {}, new Map(), {}, 0)[0]).toMatchObject({ partner: "Новая учительница", hintLevel: 2 });
    expect(generateTasks(introduce, student, { scriptHint: "starter" }, new Map(), {}, 1)[0]).toMatchObject({ partner: "Мальчик на площадке", hintLevel: 1, promptSpeech: "Привет! Как тебя зовут?" });
    expect(generateTasks(introduce, student, { scriptHint: "none" }, new Map(), {}, 2)[0]).toMatchObject({ partner: "Доктор", hintLevel: 0 });
  });

  it("uses filled-in facts but never the address, the phone or the family label", () => {
    const tasks = generateTasks(introduce, lisa({
      familyName: "Скрытая фамилия",
      familyLabel: "Скрытая семья",
      city: "Новоград",
      address: "Совершенно секретный адрес, 7",
      phone: "+7 900 111-22-33",
      includePhone: true,
      birthDate: "2018-01-01",
      includeFamilyLabel: true,
      includeCity: true,
      includeAddress: true,
    }));
    const content = JSON.stringify(tasks);
    expect(content).toContain("Новоград");
    expect(content).toContain("Мне ");
    expect(content).toContain("Скрытая фамилия");
    expect(content).not.toContain("Скрытая семья");
    expect(content).not.toContain("Совершенно секретный адрес");
    expect(content).not.toContain("111-22-33");
  });

  it("builds an album where names are independent answers for every displayed person", () => {
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, student, { peopleCount: 4 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual(expect.objectContaining({ type: "people_album", axis: "name", prompt: "Подпиши имена" }));
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

  it("asks to name only people already met, 6–8 trials, one concept per person", () => {
    const people = [
      { id: "anna", name: "Анна", relation: "мама", contexts: ["family"], photos: ["/api/photos/anna"], introducedAxes: ["name"], enabled: true },
      { id: "teacher_1", name: "Ирина", relation: "учитель", contexts: ["school"], photos: ["/api/photos/teacher_1"], introducedAxes: ["relation"], enabled: true },
      { id: "teacher_2", name: "Марина", relation: "учитель", contexts: ["school"], photos: ["/api/photos/teacher_2"], introducedAxes: ["relation"], enabled: true },
      { id: "new_person", name: "Саша", relation: "друг", contexts: ["home"], photos: ["/api/photos/new_person"], introducedAxes: [], enabled: true },
    ];
    const tasks = generateTasks({ id: "who_is_this", type: "person_naming" }, { ...student, myPeople: people });

    expect(tasks).toHaveLength(MIN_POINT_TRIALS_PER_ROUND);
    expect(tasks.every((task) => task.type === "person_naming")).toBe(true);
    // Three people met, two trials each; the newcomer is not asked about.
    const ids = tasks.map((task) => task.personId);
    expect([...new Set(ids)].sort()).toEqual(["anna", "teacher_1", "teacher_2"]);
    for (const id of ["anna", "teacher_1", "teacher_2"]) expect(ids.filter((other) => other === id)).toHaveLength(2);
    expect(tasks.find((task) => task.personId === "anna")).toEqual(expect.objectContaining({
      conceptId: "person_naming:anna", prompt: "Кто это?", answer: "мама · Анна", hintWord: "мама", hintSyllable: "ма",
    }));
    expect(tasks.find((task) => task.personId === "teacher_1").answer).toBe("Ирина · учитель");
  });

  it("never asks «Кто это?» about one person three times running", () => {
    const people = student.myPeople.slice(0, 2).map((person) => ({ ...person, introducedAxes: ["name"] }));
    for (let i = 0; i < 50; i += 1) {
      const ids = generateTasks({ id: "who_is_this", type: "person_naming" }, { ...student, myPeople: people }).map((task) => task.personId);
      expect(ids).toHaveLength(MIN_POINT_TRIALS_PER_ROUND);
      expect(ids.some((id, index) => index >= 2 && id === ids[index - 1] && id === ids[index - 2])).toBe(false);
    }
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

describe("my_people introductions per lesson", () => {
  const familyNames = { id: "family_names" };
  const bigFamily = {
    id: "student_big",
    myPeople: Array.from({ length: 10 }, (_, index) => ({
      id: `p${index}`,
      name: `Имя ${index}`,
      relation: `родня ${index}`,
      contexts: ["family"],
      photos: [`/api/photos/p${index}`],
      introducedAxes: [],
      enabled: true,
      // Created in reverse id order, to prove creation time decides the queue.
      createdAt: `2026-09-${String(20 - index).padStart(2, "0")}T10:00:00.000Z`,
    })),
  };
  const intros = (tasks) => tasks.filter((task) => task.type === "person_intro").map((task) => task.personId);
  const albumPeople = (tasks) => tasks.filter((task) => task.type !== "person_intro").flatMap((task) => task.entries.map((entry) => entry.personId));

  it("introduces at most four new people, the earliest-added first", () => {
    const tasks = generateTasks(familyNames, bigFamily, { peopleCount: 4 });

    expect(intros(tasks).sort()).toEqual(["p6", "p7", "p8", "p9"]);
    expect(new Set(albumPeople(tasks))).toEqual(new Set(["p6", "p7", "p8", "p9"]));
  });

  it("does not introduce anyone new in later rounds of the same lesson", () => {
    const sessionIntroduced = { name: new Set(["p6", "p7", "p8", "p9"]) };
    const tasks = generateTasks(familyNames, bigFamily, { peopleCount: 4 }, new Map(), sessionIntroduced);

    expect(intros(tasks)).toEqual([]);
    expect(new Set(albumPeople(tasks))).toEqual(new Set(["p6", "p7", "p8", "p9"]));
  });

  it("introduces the next four in the next lesson", () => {
    const afterFirstLesson = {
      ...bigFamily,
      myPeople: bigFamily.myPeople.map((person) => (
        ["p6", "p7", "p8", "p9"].includes(person.id) ? { ...person, introducedAxes: ["name"] } : person
      )),
    };
    const tasks = generateTasks(familyNames, afterFirstLesson, { peopleCount: 4 });

    expect(intros(tasks).sort()).toEqual(["p2", "p3", "p4", "p5"]);
    expect(albumPeople(tasks).some((id) => ["p0", "p1", "p2", "p3", "p4", "p5"].includes(id))).toBe(false);
  });
});

describe("«Обо мне»: short questions", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const child = {
    id: "kid",
    name: "Миша",
    sex: "m",
    photo: "/api/photos/misha",
    myPeopleProfile: { includeSelfName: true, birthDate: "2021-10-15", familyName: "Петров", includeFamilyName: true, city: "Любляна", includeCity: false },
    myPeople: [
      { id: "anna", type: "person", name: "Анна", relation: "Мама", contexts: ["family"], photos: ["/api/photos/anna"], enabled: true },
      { id: "masha", type: "person", name: "Маша", relation: "сестра", contexts: ["family"], photos: ["/api/photos/masha"], enabled: true },
      { id: "katya", type: "person", name: "Катя", relation: "сестра", contexts: ["family"], photos: ["/api/photos/katya"], enabled: true },
      { id: "cat", type: "pet", name: "Барсик", relation: "брат", contexts: ["family"], photos: ["/api/photos/cat"], enabled: true },
      { id: "off", type: "person", name: "Иван", relation: "папа", contexts: ["family"], photos: ["/api/photos/ivan"], enabled: false },
    ],
  };

  it("asks whatever the adult filled in, by level, in the teaching order", () => {
    const questions = getAboutMeQuestions(child, now);
    expect(questions.map((q) => [q.level, q.question, q.answer])).toEqual([
      ["self", "Как тебя зовут?", "Миша"],
      ["self", "Ты мальчик или девочка?", "Мальчик"],
      ["self", "Сколько тебе лет?", "4 года"],
      ["family", "Как зовут маму?", "Анна"],
      ["family", "Как зовут сестру?", "Маша или Катя"],
      // A pet of unknown kind ("брат" is no animal) is "питомец".
      ["family", "Как зовут твоего питомца?", "Барсик"],
      ["day", "Когда у тебя день рождения?", "15 октября"],
      // A filled-in field is a question: the old "include" ticks are ignored.
      // «Безопасность» comes last: the most to memorise.
      ["safety", "Как твоя фамилия?", "Петров"],
      ["safety", "В каком городе ты живёшь?", "Любляна"],
    ]);
    // A switched-off person produces no question.
    expect(JSON.stringify(questions)).not.toMatch(/Иван/);
  });

  it("asks the address and the phone only with the adult's yes", () => {
    const profile = { ...child.myPeopleProfile, address: "ул. Ленина, 5", phone: "+7 900 123-45-67", phoneOwner: "папы" };
    const without = getAboutMeQuestions({ ...child, myPeopleProfile: profile }, now);
    expect(JSON.stringify(without)).not.toMatch(/Ленина|123-45-67/);
    const withYes = getAboutMeQuestions({ ...child, myPeopleProfile: { ...profile, includeAddress: true, includePhone: true } }, now);
    expect(withYes.filter((q) => q.level === "safety").map((q) => [q.question, q.answer])).toEqual([
      ["Как твоя фамилия?", "Петров"],
      ["В каком городе ты живёшь?", "Любляна"],
      ["Какой у тебя адрес?", "ул. Ленина, 5"],
      ["Назови телефон папы.", "+7 900 123-45-67"],
    ]);
  });

  it("asks about the kindergarten or the school, the group or the class, and the teacher", () => {
    const withDay = (schoolKind) => ({
      ...child,
      myPeopleProfile: { ...child.myPeopleProfile, schoolKind, school: "№ 5", group: "Солнышко" },
      myPeople: [...child.myPeople, { id: "t", type: "person", name: "Ольга Петровна", relation: "воспитательница", contexts: ["school"], photos: ["/t"], enabled: true }],
    });
    const day = (schoolKind) => getAboutMeQuestions(withDay(schoolKind), now).filter((q) => q.level === "day").map((q) => q.question);
    expect(day("kindergarten")).toEqual(["Когда у тебя день рождения?", "В какой детский сад ты ходишь?", "Как называется твоя группа?", "Как зовут воспитательницу?"]);
    expect(day("school")).toEqual(["Когда у тебя день рождения?", "В какую школу ты ходишь?", "В каком ты классе?", "Как зовут воспитательницу?"]);
  });

  it("names a known pet kind in the question", () => {
    const pets = { ...child, myPeople: [{ id: "c", type: "pet", name: "Мурка", relation: "наша кошка", contexts: ["family"], photos: ["/c"], enabled: true }, { id: "d", type: "pet", name: "Бим", relation: "пёс", contexts: ["family"], photos: ["/d"], enabled: true }] };
    expect(getAboutMeQuestions(pets, now).filter((q) => q.id.startsWith("pet:")).map((q) => q.question)).toEqual(["Как зовут твою кошку?", "Как зовут твоего пса?"]);
  });

  it("uses the right photo as the hint", () => {
    const byId = Object.fromEntries(getAboutMeQuestions(child, now).map((q) => [q.id, q.cueImage]));
    expect(byId.name).toBe("/api/photos/misha");
    expect(byId["rel:мама"]).toBe("/api/photos/anna");
    expect(byId.age).toBeNull();
  });

  it("counts age from the birth date, not from the year alone", () => {
    expect(ageFromBirthDate("2021-09-30", now)).toBe(5);
    expect(ageFromBirthDate("2021-10-01", now)).toBe(4);
    expect(ageFromBirthDate("", now)).toBeNull();
    expect(ageFromBirthDate("2026-09-01", now)).toBeNull();
  });

  it("keeps the ladder order in the first round, caps each round, mixes later rounds", () => {
    const first = generateTasks({ id: "about_me", type: "about_me" }, child);
    // Default levels: «Я» and «Семья» -- six questions for this child.
    expect(first.map((task) => task.prompt)).toEqual(getAboutMeQuestions(child).filter((q) => ["self", "family"].includes(q.level)).map((q) => q.question).slice(0, MAX_ABOUT_ME_QUESTIONS_PER_ROUND));
    expect(first.every((task) => task.type === "about_me_question" && task.conceptId.startsWith("about_q:"))).toBe(true);
    const later = generateTasks({ id: "about_me", type: "about_me" }, child, {}, new Map(), {}, 3);
    expect(later).toHaveLength(first.length);
  });

  it("is available with just a name and a sex, no people needed", () => {
    expect(hasEnoughAboutMeQuestions({ name: "Лиза", sex: "f", myPeopleProfile: {} })).toBe(true);
    expect(hasEnoughAboutMeQuestions({ name: "Лиза", myPeopleProfile: {} })).toBe(false);
  });

  it("asks only the chosen levels, as many as asked for", () => {
    const tasks = generateTasks({ id: "about_me", type: "about_me" }, child, { levels: ["safety", "day"], questionCount: 4 });
    expect(tasks.map((task) => task.conceptId)).toEqual(["about_q:birthday", "about_q:family_name", "about_q:city"]);
    expect(generateTasks({ id: "about_me", type: "about_me" }, child, { levels: ["self", "family", "safety", "day"], questionCount: 4 })).toHaveLength(4);
    expect(hasEnoughAboutMeQuestions(child, { levels: ["day"] })).toBe(false);
  });

  it("asks the not-yet-known questions first and keeps a few known ones", () => {
    const all = { levels: ["self", "family", "safety", "day"], questionCount: 6 };
    // Known: name, gender, age, mum -- answered correctly before.
    const history = new Map([
      ["about_q:name", { askedAt: "2026-09-01", quality: "correct" }],
      ["about_q:gender", { askedAt: "2026-09-02", quality: "correct" }],
      ["about_q:age", { askedAt: "2026-09-03", quality: "correct" }],
      ["about_q:rel:мама", { askedAt: "2026-09-04", quality: "correct" }],
      ["about_q:city", { askedAt: "2026-09-04", quality: "prompted" }],
    ]);
    const ids = generateTasks({ id: "about_me", type: "about_me" }, child, all, new Map(), {}, 0, history).map((task) => task.conceptId);
    // 4 to learn (never asked first, then the city answered with a prompt) + 2 known, oldest first; in ladder order.
    expect(ids).toEqual(["about_q:name", "about_q:gender", "about_q:rel:сестра", "about_q:pet:cat", "about_q:birthday", "about_q:family_name"]);
  });

  it("reads the history from saved lessons: the last answer to each question", () => {
    const sessions = [
      { studentId: "kid", topicId: "my_people", completedAt: "2026-09-02", assessments: [{ conceptId: "about_q:city", quality: "correct" }] },
      { studentId: "kid", topicId: "my_people", completedAt: "2026-09-01", assessments: [{ conceptId: "about_q:city", quality: "fail" }, { conceptId: "point:anna", quality: "correct" }] },
      { studentId: "other", topicId: "my_people", completedAt: "2026-09-03", assessments: [{ conceptId: "about_q:city", quality: "fail" }] },
    ];
    const history = aboutMeHistory(sessions, "kid");
    expect([...history.keys()]).toEqual(["about_q:city"]);
    expect(history.get("about_q:city")).toEqual({ askedAt: "2026-09-02", quality: "correct" });
  });

  it("swaps «мальчик или девочка» every other round against echoing the last word", () => {
    const prompt = (round) => generateTasks({ id: "about_me", type: "about_me" }, child, {}, new Map(), {}, round).find((task) => task.conceptId === "about_q:gender").prompt;
    expect(prompt(0)).toBe("Ты мальчик или девочка?");
    expect(prompt(1)).toBe("Ты девочка или мальчик?");
  });
});

describe("albums of two", () => {
  it("never leaves a single-person page at size 2", () => {
    const five = {
      id: "s",
      myPeople: ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id.toUpperCase(), relation: "друг", contexts: ["family"], photos: [`/api/photos/${id}`], introducedAxes: ["name"], enabled: true })),
    };
    const tasks = generateTasks({ id: "family_names", type: "people_album" }, five, { peopleCount: 2 });
    const sizes = tasks.map((task) => task.entries.length).sort();
    expect(sizes).toEqual([2, 3]);
  });
});

describe("«Покажи»", () => {
  const person = (id, name, relation, extra = {}) => ({
    id, name, relation, type: "person", contexts: ["family"], photos: [`/api/photos/${id}`], introducedAxes: ["name"], enabled: true, ...extra,
  });
  const family = {
    id: "s",
    myPeople: [
      person("anna", "Анна", "Мама"),
      person("pavel", "Павел", "папа"),
      person("elena", "Елена Петровна", "воспитательница"),
      person("cat", "Барсик", "брат", { type: "pet" }),
      person("masha1", "Маша", "подруга"),
      person("masha2", "Маша", "соседка"),
    ],
  };

  it("uses the kin word for close family and the name for everyone else and pets", () => {
    expect(mainWord(family.myPeople[0])).toBe("мама");
    expect(mainWord(family.myPeople[2])).toBe("Елена Петровна");
    expect(mainWord(family.myPeople[3])).toBe("Барсик");
  });

  it("asks «Где …?» with the requested number of photos, target always among them", () => {
    const tasks = generateTasks({ id: "show_me", type: "person_point" }, family, { fieldSize: 3 });
    expect(tasks.length).toBe(Math.min(family.myPeople.length, MAX_POINT_TRIALS_PER_ROUND));
    for (const task of tasks) {
      expect(task.prompt).toBe(`Где ${task.word}?`);
      expect(task.choices).toHaveLength(3);
      expect(task.choices.map((choice) => choice.personId)).toContain(task.personId);
    }
    expect(generateTasks({ id: "show_me", type: "person_point" }, family, {})[0].choices).toHaveLength(2);
  });

  it("never puts two people with the same word on one screen", () => {
    for (let i = 0; i < 20; i += 1) {
      const tasks = generateTasks({ id: "show_me", type: "person_point" }, family, { fieldSize: 4 });
      for (const task of tasks.filter((t) => t.word === "Маша")) {
        const ids = task.choices.map((choice) => choice.personId);
        expect(ids.includes("masha1") && ids.includes("masha2")).toBe(false);
      }
    }
  });

  it("asks about known people plus at most a few newcomers, who it introduces", () => {
    const partly = { ...family, myPeople: family.myPeople.map((p, i) => (i < 2 ? p : { ...p, introducedAxes: [], createdAt: `2026-01-0${i}` })) };
    const tasks = generateTasks({ id: "show_me", type: "person_point" }, partly, {});
    const byId = Object.fromEntries(tasks.map((task) => [task.personId, task]));
    // anna, pavel known + all four newcomers (exactly MAX_NEW_PER_SESSION).
    expect(Object.keys(byId).sort()).toEqual(["anna", "cat", "elena", "masha1", "masha2", "pavel"]);
    expect(byId.anna.introduces).toBe(false);
    expect(byId.elena.introduces).toBe(true);
    expect(byId.elena.axis).toBe("name");
    expect(byId.anna.axis).toBe("relation");
  });

  it("counts this lesson's earlier introductions against the newcomer budget", () => {
    const fresh = { ...family, myPeople: family.myPeople.map((p, i) => ({ ...p, introducedAxes: [], createdAt: `2026-01-0${i}` })) };
    const sessionIntroduced = { name: new Set(["elena", "cat", "masha1"]) };
    const ids = [...new Set(generateTasks({ id: "show_me", type: "person_point" }, fresh, {}, new Map(), sessionIntroduced)
      .map((task) => task.personId))].sort();
    expect(ids).toEqual(["anna", "cat", "elena", "masha1"]);
  });

  it("uses the adult's own «how the child calls them» label first", () => {
    expect(mainWord({ type: "person", name: "Николай", relation: "дядя", sentenceLabel: " дядя Коля " })).toBe("дядя Коля");
    expect(mainWord({ type: "pet", name: "Барсик", relation: "кот", sentenceLabel: "котик" })).toBe("Барсик");
  });

  it("lets «Кто это?» ask about a person once «Покажи» introduced them", () => {
    const fresh = { ...family, myPeople: family.myPeople.map((p) => ({ ...p, introducedAxes: [] })) };
    expect(generateTasks({ id: "who_is_this" }, fresh)).toHaveLength(0);
    const afterPoint = { ...fresh, myPeople: fresh.myPeople.map((p) => (p.id === "anna" ? { ...p, introducedAxes: ["relation"] } : p)) };
    const tasks = generateTasks({ id: "who_is_this" }, afterPoint);
    expect(tasks.map((task) => [task.personId, task.answer])).toEqual([["anna", "мама · Анна"]]);
  });

  const two = { id: "s2", myPeople: [family.myPeople[0], family.myPeople[1]] };

  it("gives even two people a full round, repeating them evenly but never three in a row", () => {
    for (let i = 0; i < 50; i += 1) {
      const tasks = generateTasks({ id: "show_me", type: "person_point" }, two, {});
      expect(tasks).toHaveLength(MIN_POINT_TRIALS_PER_ROUND);
      const ids = tasks.map((task) => task.personId);
      expect(ids.filter((id) => id === "anna")).toHaveLength(MIN_POINT_TRIALS_PER_ROUND / 2);
      for (let k = 2; k < ids.length; k += 1) expect(ids[k] === ids[k - 1] && ids[k] === ids[k - 2]).toBe(false);
    }
  });

  it("never leaves the right photo in the same place three trials running", () => {
    for (let i = 0; i < 50; i += 1) {
      const places = generateTasks({ id: "show_me", type: "person_point" }, two, {})
        .map((task) => task.choices.findIndex((choice) => choice.personId === task.personId));
      for (let k = 2; k < places.length; k += 1) expect(places[k] === places[k - 1] && places[k] === places[k - 2]).toBe(false);
    }
  });

  it("treats a saved one-photo field as two", () => {
    for (const task of generateTasks({ id: "show_me", type: "person_point" }, family, { fieldSize: 1 })) {
      expect(task.choices).toHaveLength(2);
      expect(task.progressConceptIds).toEqual([task.conceptId]);
    }
  });

  it("in the first round sets a pet against people and people against a pet", () => {
    for (let i = 0; i < 20; i += 1) {
      for (const task of generateTasks({ id: "show_me", type: "person_point" }, family, { fieldSize: 2 }, new Map(), {}, 0)) {
        const [other] = task.choices.filter((choice) => choice.personId !== task.personId);
        if (task.personId === "cat") expect(other.personId).not.toBe("cat");
        else expect(other.personId).toBe("cat");
      }
    }
  });
});

describe("«Подпиши фото»", () => {
  const labelPhotos = { id: "label_photos", type: "people_album" };
  const person = (id, name, relation, contexts) => ({
    id, name, relation, type: "person", contexts, photos: [`/p/${id}`], introducedAxes: ["name", "relation"], enabled: true,
  });
  const student = {
    id: "s",
    myPeople: [
      person("anna", "Анна", "мама", ["family"]),
      person("pavel", "Павел", "папа", ["family"]),
      person("maria", "Мария Ивановна", "учительница", ["school"]),
      person("oleg", "Олег Петрович", "учитель", ["school"]),
    ],
  };
  const albums = (params) => generateTasks(labelPhotos, student, params).filter((task) => task.type === "people_album");

  it("takes the circle and the words from the params", () => {
    const [family] = albums({ circle: "family", labelKind: "relation" });
    expect(family.axis).toBe("relation");
    expect(family.entries.map((entry) => entry.personId).sort()).toEqual(["anna", "pavel"]);
    const [school] = albums({ circle: "school", labelKind: "name" });
    expect(school.axis).toBe("name");
    expect(school.entries.map((entry) => entry.label).sort()).toEqual(["Мария Ивановна", "Олег Петрович"]);
    expect(albums({ circle: "all", labelKind: "name", peopleCount: 4 })[0].entries).toHaveLength(4);
  });

  it("defaults to the family and «кто это»", () => {
    const [album] = albums({});
    expect(album.axis).toBe("relation");
    expect(album.entries.map((entry) => entry.personId).sort()).toEqual(["anna", "pavel"]);
  });

  it("with both words starts from the role at home and from the name at school", () => {
    expect(albums({ circle: "family", labelKind: "both" }).map((task) => task.axis)).toEqual(["relation", "name"]);
    expect(albums({ circle: "school", labelKind: "both" }).map((task) => task.axis)).toEqual(["name", "relation"]);
  });

  it("keeps the same progress concepts as the old album modes", () => {
    const [album] = albums({ circle: "family", labelKind: "name" });
    expect(album.progressConceptIds.sort()).toEqual(["anna:name", "pavel:name"]);
  });
});

describe("«Кто это?» first-syllable prompt", () => {
  it("gives the opening syllable the way a speech therapist would", () => {
    expect(firstSyllable("мама")).toBe("ма");
    expect(firstSyllable("Павел")).toBe("Па");
    expect(firstSyllable("бабушка")).toBe("ба");
    expect(firstSyllable("дядя Коля")).toBe("дя");
    expect(firstSyllable("Мария Ивановна")).toBe("Ма");
    // A word opening with a vowel keeps the next consonant.
    expect(firstSyllable("Анна")).toBe("Ан");
    expect(firstSyllable("Игорь")).toBe("Иг");
    expect(firstSyllable("Ая")).toBe("А");
    expect(firstSyllable("")).toBe("");
  });

});

describe("«Найди такого же»", () => {
  const matchSame = { id: "match_same", type: "person_match" };
  const person = (id, photos, extra = {}) => ({ id, name: id, relation: "", type: "person", contexts: ["family"], photos, enabled: true, ...extra });
  const student = {
    id: "s",
    myPeople: [
      person("anna", ["/a1", "/a2", "/a3"]),
      person("pavel", ["/p1", "/p2"]),
      person("olga", ["/o1"]),
      person("cat", ["/c1", "/c2"], { type: "pet" }),
    ],
  };

  it("asks about people with two photos, shows one and hides another of the same person", () => {
    for (let i = 0; i < 30; i += 1) {
      const tasks = generateTasks(matchSame, student, { fieldSize: 3 });
      expect(tasks.length).toBeGreaterThanOrEqual(MIN_POINT_TRIALS_PER_ROUND);
      for (const task of tasks) {
        expect(task.type).toBe("person_match");
        expect(["anna", "pavel", "cat"]).toContain(task.personId);
        const target = student.myPeople.find((p) => p.id === task.personId);
        const found = task.choices.find((choice) => choice.personId === task.personId);
        expect(target.photos).toContain(task.sample);
        expect(target.photos).toContain(found.image);
        // Never the same picture twice: that would be matching identical images.
        expect(found.image).not.toBe(task.sample);
        expect(task.choices).toHaveLength(3);
        expect(JSON.stringify(task)).not.toMatch(/Где|anna\?/);
      }
    }
  });

  it("at «Одинаковое фото» shows the very same picture, so one photo per person is enough", () => {
    const onePhotoEach = { id: "s1", myPeople: [person("olga", ["/o1"]), person("ivan", ["/i1"]), person("cat", ["/c1"], { type: "pet" })] };
    expect(generateTasks(matchSame, onePhotoEach, { sample: "other" })).toEqual([]);
    const tasks = generateTasks(matchSame, onePhotoEach, { sample: "same", fieldSize: 2 });
    expect(tasks.length).toBeGreaterThanOrEqual(MIN_POINT_TRIALS_PER_ROUND);
    for (const task of tasks) {
      expect(task.choices.find((choice) => choice.personId === task.personId).image).toBe(task.sample);
    }
  });

  it("lets a one-photo person be a distractor but never the one to find", () => {
    const ids = new Set();
    for (let i = 0; i < 30; i += 1) {
      for (const task of generateTasks(matchSame, student, { fieldSize: 4 })) ids.add(task.personId);
    }
    expect(ids.has("olga")).toBe(false);
    const tasks = generateTasks(matchSame, student, { fieldSize: 4 });
    expect(tasks[0].choices.map((choice) => choice.personId)).toContain("olga");
  });

  it("needs two people with two photos each", () => {
    const one = { ...student, myPeople: [person("anna", ["/a1", "/a2"]), person("olga", ["/o1"]), person("ivan", ["/i1", "/i1"])] };
    expect(generateTasks(matchSame, one)).toEqual([]);
  });
});

describe("repeat after a helped trial (insertRetryTrial)", () => {
  const trial = (personId, extra = {}) => ({
    type: "person_point",
    conceptId: `point:${personId}`,
    personId,
    choices: [{ personId }, { personId: personId === "x" ? "y" : "x" }],
    ...extra,
  });

  it("brings the trial back after one or two others, photos in new places", () => {
    for (let i = 0; i < 30; i += 1) {
      const tasks = [trial("anna"), trial("pavel"), trial("anna"), trial("pavel"), trial("anna")];
      const next = insertRetryTrial(tasks, 0);
      expect(next).toHaveLength(6);
      const at = next.findIndex((task) => task.retry);
      expect([2, 3]).toContain(at);
      expect(next[at].personId).toBe("anna");
      expect(next[at].choices.findIndex((c) => c.personId === "anna")).not.toBe(tasks[0].choices.findIndex((c) => c.personId === "anna"));
    }
  });

  it("never makes three of one person in a row", () => {
    const tasks = [trial("anna"), trial("pavel"), trial("pavel"), trial("anna"), trial("pavel")];
    // Right after the next trial would make pavel three times running, so
    // the repeat waits one more trial.
    const next = insertRetryTrial(tasks, 1);
    expect(next.findIndex((task) => task.retry)).toBe(4);
    const ids = next.map((task) => task.personId);
    expect(ids.some((id, i) => i >= 2 && id === ids[i - 1] && id === ids[i - 2])).toBe(false);
  });

  it("closes the round when the miss was at its end", () => {
    const tasks = [trial("anna"), trial("pavel")];
    const next = insertRetryTrial(tasks, 1);
    expect(next.at(-1)).toEqual(expect.objectContaining({ personId: "pavel", retry: true }));
  });

  it("does not repeat a repeat or other task types", () => {
    const tasks = [trial("anna", { retry: true }), { type: "person_naming", personId: "olga" }];
    expect(insertRetryTrial(tasks, 0)).toBe(tasks);
    expect(insertRetryTrial(tasks, 1)).toBe(tasks);
  });
});
