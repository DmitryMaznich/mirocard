import { shuffle } from "@/shared/utils/shuffle";
import { pluralRu } from "@/shared/utils/format";

const CONTEXT_BY_PREFIX = { family: "family", home: "home", school: "school" };
const MIN_ALBUM_SIZE = 2;
const MAX_ALBUM_SIZE = 8;
// 2 is the usual starting field for a child with ASD: choosing between two
// photos before three or four.
const ALBUM_SIZES = [2, 4, 6, 8];
// New people introduced per axis per lesson -- across all its rounds, not per
// round. With a full list (up to 20 cards) the first lesson would otherwise
// open with an introduction screen for every single person.
export const MAX_NEW_PER_SESSION = 4;

const ABOUT_ME_FACTS = [
  { id: "self_name", enabledKey: "includeSelfName", value: (student) => student?.name },
  { id: "family_name", enabledKey: "includeFamilyName", value: (student) => student?.myPeopleProfile?.familyName },
  { id: "family_label", enabledKey: "includeFamilyLabel", value: (student) => student?.myPeopleProfile?.familyLabel },
  { id: "city", enabledKey: "includeCity", value: (student) => student?.myPeopleProfile?.city },
];

export function getAboutMeFacts(student) {
  const profile = student?.myPeopleProfile ?? {};
  return ABOUT_ME_FACTS.flatMap((fact) => {
    const value = String(fact.value(student) ?? "").trim();
    return profile[fact.enabledKey] && value ? [{ id: fact.id, value }] : [];
  });
}

export function hasEnoughAboutMeFacts(student) {
  return getAboutMeFacts(student).length >= 2;
}

// ── «Обо мне»: short, fixed questions ──────────────────────────────────
// One direct question, one short answer, always the same wording -- the
// "personal information" skill as taught to preschoolers with ASD. Every
// question is built from data the adult already entered (student card,
// «Мои люди», «Личные данные») and appears only when that data exists.
// Order is the usual teaching ladder: self, then close family, then the
// wider circle, then surname and city.
const RELATION_QUESTIONS = [
  ["мама", "маму"], ["папа", "папу"],
  ["бабушка", "бабушку"], ["дедушка", "дедушку"],
  ["брат", "брата"], ["сестра", "сестру"],
  ["няня", "няню"],
  ["воспитательница", "воспитательницу"], ["воспитатель", "воспитателя"],
  ["учительница", "учительницу"], ["учитель", "учителя"],
];
export const MAX_ABOUT_ME_QUESTIONS_PER_ROUND = 6;

export function ageFromBirthDate(birthDate, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ""));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age >= 1 && age <= 25 ? age : null;
}

export function getAboutMeQuestions(student, now = new Date()) {
  const profile = student?.myPeopleProfile ?? {};
  const questions = [];
  const add = (id, question, answer, cueImage = null) => {
    if (String(answer ?? "").trim()) questions.push({ id, question, answer: String(answer).trim(), cueImage });
  };

  if (profile.includeSelfName !== false) add("name", "Как тебя зовут?", student?.name, student?.photo ?? null);
  if (student?.sex === "m" || student?.sex === "f") {
    add("gender", "Ты мальчик или девочка?", student.sex === "m" ? "Мальчик" : "Девочка", student?.photo ?? null);
  }
  const age = ageFromBirthDate(profile.birthDate, now);
  if (age) add("age", "Сколько тебе лет?", `${age} ${pluralRu(age, "год", "года", "лет")}`);

  const people = (student?.myPeople ?? []).filter((person) => isActive(person) && person.type !== "pet");
  for (const [relation, accusative] of RELATION_QUESTIONS) {
    const matches = people.filter((person) => person.relation?.trim().toLowerCase() === relation);
    if (!matches.length) continue;
    // Two sisters: either name is right, and the adult judges.
    add(`rel:${relation}`, `Как зовут ${accusative}?`, matches.map((person) => person.name.trim()).join(" или "), matches[0].photos.find(Boolean));
  }

  if (profile.includeFamilyName && profile.familyName) add("family_name", "Как твоя фамилия?", profile.familyName);
  if (profile.includeCity && profile.city) add("city", "Где ты живёшь?", profile.city);
  return questions;
}

export function hasEnoughAboutMeQuestions(student) {
  return getAboutMeQuestions(student).length >= 2;
}

export function aboutMeQuestionLabel(conceptId, student) {
  const id = String(conceptId).slice("about_q:".length);
  return getAboutMeQuestions(student).find((question) => question.id === id)?.question ?? "Вопрос обо мне";
}

function aboutMeQuestionTasks(student, round) {
  const questions = getAboutMeQuestions(student);
  // First round keeps the ladder order; later rounds mix it so the answer
  // follows the question, not its position in a memorised chain.
  const ordered = round > 0 ? shuffle(questions) : questions;
  return ordered.slice(0, MAX_ABOUT_ME_QUESTIONS_PER_ROUND).map((question) => {
    const conceptId = `about_q:${question.id}`;
    return {
      type: "about_me_question",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      prompt: question.question,
      promptSpeech: question.question,
      answer: question.answer,
      cueImage: question.cueImage,
    };
  });
}

// ── «Покажи»: receptive identification ─────────────────────────────────
// A voice asks "Где мама?" and the child taps the photo among 2–4 -- the
// first step of the skill, before naming, and it needs no reading.
//
// The word used is how the child calls the person: the kin word for close
// family (mama, not "Анна"), the name for everyone else and for pets. Until
// cards get an explicit "main word" field this is decided here.
const KIN_WORDS = new Set(["мама", "папа", "бабушка", "дедушка", "брат", "сестра", "тётя", "тетя", "дядя"]);
const POINT_FIELD_SIZES = [2, 3, 4];
export const MAX_POINT_TRIALS_PER_ROUND = 8;

export function mainWord(person) {
  const relation = person?.relation?.trim().toLowerCase();
  if (person?.type !== "pet" && relation && KIN_WORDS.has(relation)) return relation;
  return person?.name?.trim() ?? "";
}

function pointTasks(people, params, photoPlanner) {
  if (people.length < 2) return [];
  const introduced = people.filter((person) => person.introducedAxes?.length);
  // Ask about people the child has already met; before anyone is introduced
  // (the introductions live in the album modes), use everyone.
  const targets = introduced.length >= 2 ? introduced : people;
  const requested = Number(params?.fieldSize);
  const fieldSize = Math.min(POINT_FIELD_SIZES.includes(requested) ? requested : 2, people.length);

  return shuffle(targets).slice(0, MAX_POINT_TRIALS_PER_ROUND).map((target) => {
    const word = mainWord(target);
    // Two people answering to the same word (two "Маша") would make the
    // question ambiguous, so they never share a screen.
    const distractors = shuffle(people.filter((person) => person.id !== target.id && mainWord(person).toLowerCase() !== word.toLowerCase()))
      .slice(0, fieldSize - 1);
    const conceptId = `point:${target.id}`;
    return {
      type: "person_point",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      personId: target.id,
      word,
      prompt: `Где ${word}?`,
      promptSpeech: `Где ${word}?`,
      choices: shuffle([target, ...distractors]).map((person) => ({
        personId: person.id,
        image: photoPlanner.imageFor(person, "point"),
      })),
    };
  }).filter((task) => task.choices.length >= 2);
}

function isActive(person) {
  return !person?.deletedAt && person?.enabled !== false && person?.name?.trim() && person?.photos?.some(Boolean);
}

function peopleForMode(mode, student) {
  const people = (student?.myPeople ?? []).filter(isActive);
  if (mode.id === "mix" || mode.id === "who_is_this") return people;
  const context = CONTEXT_BY_PREFIX[mode.id.split("_")[0]];
  return context ? people.filter((person) => person.contexts?.includes(context)) : people;
}

function axisForMode(mode) {
  return mode.id.endsWith("_relations") ? "relation" : "name";
}

function albumSize(params, available) {
  const requested = Number(params?.peopleCount);
  const selectedSize = ALBUM_SIZES.includes(requested) ? requested : 4;
  return Math.min(Math.max(MIN_ALBUM_SIZE, selectedSize), MAX_ALBUM_SIZE, available);
}

function toGroups(people, size) {
  const groups = [];
  for (let index = 0; index < people.length; index += size) {
    groups.push(people.slice(index, index + size));
  }
  // A one-person final page cannot be an association task. Rebalance the last
  // two pages rather than exceeding the size selected by the adult.
  if (groups.length > 1 && groups.at(-1).length === 1) {
    const lastFullGroup = groups.at(-2);
    const combined = [...lastFullGroup, groups.at(-1)[0]];
    // At size 2 splitting 3 would recreate a 1-person page; keep one page of 3.
    if (combined.length <= 3) {
      groups.splice(-2, 2, combined);
    } else {
      const firstSize = Math.floor(combined.length / 2);
      groups.splice(-2, 2, combined.slice(0, firstSize), combined.slice(firstSize));
    }
  }
  return groups;
}

function createPhotoPlanner(previousImages) {
  const lastPhotoIndexes = new Map();
  return {
    imageFor(person, axis, preferDifferent) {
      const photos = person.photos.filter(Boolean);
      const blockedIndexes = new Set();
      const previousImage = previousImages?.get(`${person.id}:${axis}`);
      const previousIndex = lastPhotoIndexes.get(person.id);
      if (previousImage) blockedIndexes.add(photos.indexOf(previousImage));
      if (preferDifferent && previousIndex != null) blockedIndexes.add(previousIndex);
      const eligibleIndexes = photos
        .map((_, index) => index)
        .filter((index) => !blockedIndexes.has(index));
      const choices = eligibleIndexes.length ? eligibleIndexes : photos.map((_, index) => index);
      const index = choices[Math.floor(Math.random() * choices.length)];
      if (previousImage && photos.length > 1 && photos[index] === previousImage) {
        // The fallback only happens when several constraints conflict. Prefer a
        // different previous-round photo whenever the person's gallery allows it.
        const differentIndex = photos.findIndex((photo) => photo !== previousImage);
        if (differentIndex >= 0) {
          lastPhotoIndexes.set(person.id, differentIndex);
          return photos[differentIndex];
        }
      }
      lastPhotoIndexes.set(person.id, index);
      return photos[index];
    },
  };
}

function taskForGroup(group, axis, modeId, photoPlanner, preferDifferentPhoto) {
  const entries = shuffle(group).map((person) => ({
    personId: person.id,
    conceptId: `${person.id}:${axis}`,
    image: photoPlanner.imageFor(person, axis, preferDifferentPhoto),
    label: axis === "relation" ? person.relation.trim() : person.name.trim(),
  }));
  const axisText = axis === "name" ? "имена" : "кто это для меня";
  const ids = entries.map((entry) => entry.personId).sort().join("_");
  return {
    type: "people_album",
    conceptId: `album:${modeId}:${axis}:${ids}`,
    targetConceptId: `album:${modeId}:${axis}:${ids}`,
    progressConceptIds: entries.map((entry) => entry.conceptId),
    axis,
    prompt: axis === "name" ? "Подбери имена" : "Кто это для меня?",
    promptSpeech: axis === "name"
      ? "Подбери имена. Выбери имя, затем фотографию."
      : "Кто эти люди для тебя? Выбери слово, затем фотографию.",
    answerTitle: axisText[0].toUpperCase() + axisText.slice(1),
    entries,
    answers: shuffle(entries.map((entry) => ({ id: `answer:${entry.personId}`, personId: entry.personId, label: entry.label }))),
  };
}

function introTaskForPerson(person, axis, modeId, photoPlanner, preferDifferentPhoto = false) {
  const label = axis === "relation" ? person.relation.trim() : person.name.trim();
  return {
    type: "person_intro",
    conceptId: `intro:${modeId}:${person.id}:${axis}`,
    targetConceptId: `intro:${modeId}:${person.id}:${axis}`,
    // An introduction is deliberately not a scored answer, but preserving an
    // empty list here keeps it out of the session's progress-concept set.
    progressConceptIds: [],
    personId: person.id,
    axis,
    image: photoPlanner.imageFor(person, axis, preferDifferentPhoto),
    label,
    prompt: axis === "name" ? "Это" : "Кто это для меня?",
    promptSpeech: `Это ${label}.`,
  };
}

function hasIntroducedAxis(person, axis, sessionIntroduced) {
  // Also trust this session's own introductions: the student record may not
  // have caught up with markPersonAxisIntroduced by the next round.
  return (Array.isArray(person.introducedAxes) && person.introducedAxes.includes(axis))
    || Boolean(sessionIntroduced?.[axis]?.has(person.id));
}

// The adult adds the closest people first (the settings screen asks for
// that), so the queue follows the order cards were created in.
function byCreation(a, b) {
  return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
}

function albumTasks(people, axis, mode, params, photoPlanner, preferDifferentPhoto = false) {
  const suitablePeople = axis === "relation" ? people.filter((person) => person.relation?.trim()) : people;
  if (suitablePeople.length < MIN_ALBUM_SIZE) return [];
  const groups = toGroups(shuffle(suitablePeople), albumSize(params, suitablePeople.length));
  return groups.map((group) => taskForGroup(group, axis, mode.id, photoPlanner, preferDifferentPhoto));
}

function tasksForAxis(people, axis, mode, params, photoPlanner, preferDifferentPhoto = false, sessionIntroduced = {}) {
  const suitablePeople = axis === "relation" ? people.filter((person) => person.relation?.trim()) : people;
  const newPeople = suitablePeople.filter((person) => !hasIntroducedAxis(person, axis, sessionIntroduced)).sort(byCreation);
  const introducedPeople = suitablePeople.filter((person) => hasIntroducedAxis(person, axis, sessionIntroduced));
  const budget = Math.max(0, MAX_NEW_PER_SESSION - (sessionIntroduced[axis]?.size ?? 0));
  const newToday = newPeople.slice(0, budget);

  // Do not let staged learning make the lesson impossible: when there are
  // fewer than two already introduced people, the album also takes today's
  // newcomers. Otherwise they enter the album on the next renewable round.
  // People still waiting for their introduction never appear in it.
  const peopleForAlbum = introducedPeople.length >= MIN_ALBUM_SIZE ? introducedPeople : [...introducedPeople, ...newToday];

  return [
    ...shuffle(newToday).map((person) => introTaskForPerson(person, axis, mode.id, photoPlanner, preferDifferentPhoto)),
    ...albumTasks(peopleForAlbum, axis, mode, params, photoPlanner, preferDifferentPhoto),
  ];
}

function aboutMeAnswer(facts, combineFullName = false) {
  const values = Object.fromEntries(facts.map((fact) => [fact.id, fact.value]));
  const parts = [];

  if (combineFullName && values.self_name && values.family_name) {
    parts.push(`Меня зовут ${values.self_name} ${values.family_name}.`);
  } else {
    if (values.self_name) parts.push(`Меня зовут ${values.self_name}.`);
    if (values.family_name) parts.push(`Моя фамилия — ${values.family_name}.`);
  }
  if (values.family_label) parts.push(`Наша семья — ${values.family_label}.`);
  if (values.city) parts.push(`Мой город — ${values.city}.`);

  return parts.join(" ");
}

function aboutMeTasks(student) {
  const facts = getAboutMeFacts(student);
  if (facts.length < 2) return [];

  const factIds = facts.map((fact) => fact.id);
  const factKey = factIds.join("_");
  const situations = [
    {
      id: "club",
      situation: "Тебя записывают в кружок.",
      prompt: "Представься и расскажи о себе.",
      combineFullName: true,
    },
    {
      id: "teacher",
      situation: "С тобой знакомится новый учитель.",
      prompt: "Представься учителю и расскажи о себе.",
    },
    {
      id: "card",
      situation: "У твоей работы на выставке есть карточка.",
      prompt: "Покажи, что ты можешь сказать о себе.",
    },
  ];

  return situations.map((situation) => {
    const conceptId = `about_me:${situation.id}:${factKey}`;
    return {
      type: "about_me_situation",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      factIds,
      situation: situation.situation,
      prompt: situation.prompt,
      promptSpeech: `${situation.situation} ${situation.prompt}`,
      answer: aboutMeAnswer(facts, situation.combineFullName),
    };
  });
}

function personNamingTasks(people, mode, photoPlanner) {
  return shuffle(people).flatMap((person) => {
    const axes = ["name", "relation"].filter((axis) => (
      (axis === "name" || person.relation?.trim()) && hasIntroducedAxis(person, axis)
    ));
    if (!axes.length) return [];

    // Each person contributes at most one open-answer card per round. When
    // both axes were introduced, vary which one the child is asked to name.
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const prompt = axis === "name" ? "Кто это?" : "Кто это для тебя?";
    const conceptId = `person_naming:${person.id}:${axis}`;
    return [{
      type: "person_naming",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      personId: person.id,
      axis,
      image: photoPlanner.imageFor(person, axis),
      prompt,
      promptSpeech: prompt,
      answer: axis === "name" ? person.name.trim() : person.relation.trim(),
    }];
  });
}

// sessionIntroduced: { name?: Set<personId>, relation?: Set<personId> } of
// people already introduced in earlier rounds of the current lesson.
export function generateTasks(mode, student, params = {}, previousImages = new Map(), sessionIntroduced = {}, round = 0) {
  if (!mode || !student) return [];
  if (mode.id === "about_me") return aboutMeQuestionTasks(student, round);
  // The open "introduce yourself in a situation" cards: an advanced level
  // for a child who already answers the short questions reliably.
  if (mode.id === "introduce_self") return aboutMeTasks(student);

  const people = peopleForMode(mode, student);
  const photoPlanner = createPhotoPlanner(previousImages);

  if (mode.id === "who_is_this") return personNamingTasks(people, mode, photoPlanner);
  if (mode.id === "show_me") return pointTasks(people, params, photoPlanner);
  if (people.length < MIN_ALBUM_SIZE) return [];

  if (mode.id === "mix") {
    // The mixed block keeps the concepts separate inside one lesson: names
    // first, then relationships. Each axis has its own introductions before
    // its association album and, when available, uses another photo.
    return [
      ...tasksForAxis(people, "name", mode, params, photoPlanner, false, sessionIntroduced),
      ...tasksForAxis(people, "relation", mode, params, photoPlanner, true, sessionIntroduced),
    ];
  }

  return tasksForAxis(people, axisForMode(mode), mode, params, photoPlanner, false, sessionIntroduced);
}
