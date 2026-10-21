import { shuffle } from "@/shared/utils/shuffle";
import { pluralRu } from "@/shared/utils/format";

const CONTEXT_BY_PREFIX = { family: "family", home: "home", school: "school" };
const MIN_ALBUM_SIZE = 2;
const MAX_ALBUM_SIZE = 8;
// 2 is the usual starting field for a child with ASD: choosing between two
// photos before three or four.
const ALBUM_SIZES = [2, 3, 4, 6, 8];
// New people introduced per axis per lesson -- across all its rounds, not per
// round. With a full list (up to 20 cards) the first lesson would otherwise
// open with an introduction screen for every single person.
export const MAX_NEW_PER_SESSION = 4;

// ── «Представься»: a conversation with someone new ─────────────────────
// The advanced level after «Обо мне»: the same facts, but answered in whole
// sentences to a new partner, and closed by telling them all in one go --
// chaining, the real skill. Filled-in facts only, and never the address or
// the phone: those are for a trusted adult, not for someone new.
const INTRODUCE_TURNS = [
  {
    id: "name",
    question: "Как тебя зовут?",
    starter: "Меня зовут",
    value: (student) => student?.name,
    sentence: (value) => `Меня зовут ${value}.`,
  },
  {
    id: "age",
    question: "Сколько тебе лет?",
    starter: "Мне",
    value: (student, profile, now) => {
      const age = ageFromBirthDate(profile.birthDate, now);
      return age ? `${age} ${pluralRu(age, "год", "года", "лет")}` : "";
    },
    sentence: (value) => `Мне ${value}.`,
  },
  {
    id: "family_name",
    question: "Какая у тебя фамилия?",
    starter: "Моя фамилия",
    value: (student, profile) => profile.familyName,
    sentence: (value) => `Моя фамилия ${value}.`,
  },
  {
    id: "city",
    question: "Где ты живёшь?",
    // "Я живу в …" would need the city in the prepositional case, which a
    // typed-in name doesn't give us; "Мой город — …" needs none.
    starter: "Мой город —",
    value: (student, profile) => profile.city,
    sentence: (value) => `Мой город — ${value}.`,
  },
];

export function getIntroduceFacts(student, now = new Date()) {
  const profile = student?.myPeopleProfile ?? {};
  return INTRODUCE_TURNS.flatMap((turn) => {
    const value = String(turn.value(student, profile, now) ?? "").trim();
    return value ? [{ ...turn, value }] : [];
  });
}

export function hasEnoughAboutMeFacts(student) {
  return getIntroduceFacts(student).length >= 2;
}

// ── «Обо мне»: short, fixed questions ──────────────────────────────────
// One direct question, one short answer, always the same wording -- the
// "personal information" skill as taught to children with ASD. Every
// question is built from data the adult already entered (student card,
// «Окружение ребёнка», «Личные данные») and appears only when that data
// exists: a filled-in field is a question. Only the address and the phone
// also need the adult's explicit yes.
//
// Four levels, in teaching order. The adult picks which ones a lesson uses:
//   self    -- name, boy/girl, age
//   family  -- names of close family and pets
//   day     -- birthday, kindergarten/school, group/class, the teacher
//   safety  -- surname, city, address, a parent's phone: what a lost child
//              must be able to tell an adult. Last: the most to memorise,
//              with the least to see.
export const ABOUT_ME_LEVELS = ["self", "family", "day", "safety"];
export const ABOUT_ME_DEFAULT_LEVELS = ["self", "family"];
const ABOUT_ME_QUESTION_COUNTS = [4, 6, 8];
export const MAX_ABOUT_ME_QUESTIONS_PER_ROUND = 6;

const FAMILY_QUESTIONS = [
  ["мама", "маму"], ["папа", "папу"],
  ["бабушка", "бабушку"], ["дедушка", "дедушку"],
  ["брат", "брата"], ["сестра", "сестру"],
  ["няня", "няню"],
];
const TEACHER_QUESTIONS = [
  ["воспитательница", "воспитательницу"], ["воспитатель", "воспитателя"],
  ["учительница", "учительницу"], ["учитель", "учителя"],
];
// "Как зовут твою кошку?" needs the animal in the accusative; a typed-in
// "наша кошка" is matched by its last word. Anything else is "питомца".
const PET_ACCUSATIVE = {
  кошка: "твою кошку", кот: "твоего кота", котик: "твоего котика", котёнок: "твоего котёнка", котенок: "твоего котёнка",
  собака: "твою собаку", пёс: "твоего пса", пес: "твоего пса", щенок: "твоего щенка", собачка: "твою собачку",
  попугай: "твоего попугая", хомяк: "твоего хомяка", хомячок: "твоего хомячка", кролик: "твоего кролика",
  черепаха: "твою черепаху", рыбка: "твою рыбку", морская_свинка: "твою морскую свинку", свинка: "твою свинку",
};
const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function ageFromBirthDate(birthDate, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ""));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age >= 1 && age <= 25 ? age : null;
}

function birthdayFromBirthDate(birthDate) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ""));
  if (!match) return "";
  const month = Number(match[1]);
  const day = Number(match[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${day} ${MONTHS_GENITIVE[month - 1]}` : "";
}

function petAccusative(pet) {
  const words = String(pet.relation ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const twoWords = words.slice(-2).join("_");
  return PET_ACCUSATIVE[twoWords] ?? PET_ACCUSATIVE[words.at(-1)] ?? null;
}

export function getAboutMeQuestions(student, now = new Date()) {
  const profile = student?.myPeopleProfile ?? {};
  const questions = [];
  const add = (level, id, question, answer, cueImage = null) => {
    if (String(answer ?? "").trim()) questions.push({ level, id, question, answer: String(answer).trim(), cueImage });
  };
  const people = (student?.myPeople ?? []).filter((person) => isActive(person) && person.type !== "pet");
  const pets = (student?.myPeople ?? []).filter((person) => isActive(person) && person.type === "pet");
  const addRelations = (level, list) => {
    for (const [relation, accusative] of list) {
      const matches = people.filter((person) => person.relation?.trim().toLowerCase() === relation);
      if (!matches.length) continue;
      // Two sisters: either name is right, and the adult judges.
      add(level, `rel:${relation}`, `Как зовут ${accusative}?`, matches.map((person) => person.name.trim()).join(" или "), matches[0].photos.find(Boolean));
    }
  };

  // self
  add("self", "name", "Как тебя зовут?", student?.name, student?.photo ?? null);
  if (student?.sex === "m" || student?.sex === "f") {
    add("self", "gender", "Ты мальчик или девочка?", student.sex === "m" ? "Мальчик" : "Девочка", student?.photo ?? null);
  }
  const age = ageFromBirthDate(profile.birthDate, now);
  if (age) add("self", "age", "Сколько тебе лет?", `${age} ${pluralRu(age, "год", "года", "лет")}`);

  // family
  addRelations("family", FAMILY_QUESTIONS);
  let genericPetAsked = false;
  for (const pet of pets) {
    const accusative = petAccusative(pet);
    // Two pets of unknown kind would get the same question; ask about one.
    if (!accusative && genericPetAsked) continue;
    if (!accusative) genericPetAsked = true;
    add("family", `pet:${pet.id}`, `Как зовут ${accusative ?? "твоего питомца"}?`, pet.name.trim(), pet.photos.find(Boolean));
  }

  // day
  add("day", "birthday", "Когда у тебя день рождения?", birthdayFromBirthDate(profile.birthDate));
  const atSchool = profile.schoolKind === "school";
  add("day", "school", atSchool ? "В какую школу ты ходишь?" : "В какой детский сад ты ходишь?", profile.school);
  add("day", "group", atSchool ? "В каком ты классе?" : "Как называется твоя группа?", profile.group);
  addRelations("day", TEACHER_QUESTIONS);

  // safety
  add("safety", "family_name", "Как твоя фамилия?", profile.familyName);
  // "Где ты живёшь?" has several true answers ("дома", the street); the
  // question names the one it wants.
  add("safety", "city", "В каком городе ты живёшь?", profile.city);
  if (profile.includeAddress) add("safety", "address", "Какой у тебя адрес?", profile.address);
  if (profile.includePhone) {
    const owner = String(profile.phoneOwner ?? "").trim() || "мамы";
    add("safety", "phone", `Назови телефон ${owner}.`, profile.phone);
  }

  return questions;
}

function aboutMeLevels(params) {
  const chosen = (Array.isArray(params?.levels) ? params.levels : []).filter((level) => ABOUT_ME_LEVELS.includes(level));
  return chosen.length ? chosen : ABOUT_ME_DEFAULT_LEVELS;
}

// The questions a lesson with these params can ask (all levels when no
// params are known, e.g. on the mode list).
export function aboutMeQuestionsFor(student, params = null) {
  const questions = getAboutMeQuestions(student);
  if (!params) return questions;
  const levels = aboutMeLevels(params);
  return questions.filter((question) => levels.includes(question.level));
}

export function hasEnoughAboutMeQuestions(student, params = null) {
  return aboutMeQuestionsFor(student, params).length >= 2;
}

export function aboutMeQuestionLabel(conceptId, student) {
  const id = String(conceptId).slice("about_q:".length);
  return getAboutMeQuestions(student).find((question) => question.id === id)?.question ?? "Вопрос обо мне";
}

// What the adult recorded for this student's «Обо мне» questions, from the
// saved lessons: when each was last asked and how it went. Pure, so the
// session hook passes it in and the engine stays store-free.
export function aboutMeHistory(sessions, studentId, topicId = "my_people") {
  const history = new Map();
  const relevant = (sessions ?? [])
    .filter((session) => session.studentId === studentId && session.topicId === topicId && session.assessments?.length)
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
  for (const session of relevant) {
    for (const assessment of session.assessments) {
      if (!String(assessment.conceptId ?? "").startsWith("about_q:")) continue;
      history.set(assessment.conceptId, { askedAt: session.completedAt, quality: assessment.quality });
    }
  }
  return history;
}

// Which questions a round asks. Not yet known first (never asked, or last
// time not answered alone), the longest-unasked first; a third of the
// round keeps already-known questions, oldest first -- easy answers among
// hard ones keep the child going, and nothing known is left to fade.
function pickAboutMeQuestions(questions, count, history) {
  const entry = (question) => history?.get(`about_q:${question.id}`);
  const known = (question) => entry(question)?.quality === "correct";
  const byOldest = (a, b) => String(entry(a)?.askedAt ?? "").localeCompare(String(entry(b)?.askedAt ?? ""));
  const learning = questions.filter((question) => !known(question)).sort(byOldest);
  const mastered = questions.filter(known).sort(byOldest);
  const keepKnown = Math.min(mastered.length, Math.floor(count / 3));
  const picked = [...learning.slice(0, count - keepKnown), ...mastered.slice(0, keepKnown)];
  // Not enough to learn: fill up with more known ones.
  for (const question of mastered) {
    if (picked.length >= count) break;
    if (!picked.includes(question)) picked.push(question);
  }
  // Back to the teaching ladder for the order.
  return questions.filter((question) => picked.includes(question));
}

function aboutMeQuestionTasks(student, params, round, history) {
  const questions = aboutMeQuestionsFor(student, params ?? {});
  const requested = Number(params?.questionCount);
  const count = ABOUT_ME_QUESTION_COUNTS.includes(requested) ? requested : MAX_ABOUT_ME_QUESTIONS_PER_ROUND;
  const picked = pickAboutMeQuestions(questions, count, history);
  // First round keeps the ladder order; later rounds mix it so the answer
  // follows the question, not its position in a memorised chain.
  const ordered = round > 0 ? shuffle(picked) : picked;
  return ordered.map((question) => {
    const conceptId = `about_q:${question.id}`;
    // "…мальчик или девочка?": a child with echolalia repeats the last
    // word, so the two options swap places every other round.
    const prompt = question.id === "gender" && round % 2 === 1 ? "Ты девочка или мальчик?" : question.question;
    return {
      type: "about_me_question",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      prompt,
      promptSpeech: prompt,
      answer: question.answer,
      cueImage: question.cueImage,
    };
  });
}

// ── «Покажи»: receptive identification ─────────────────────────────────
// A voice asks "Где мама?" and the child taps the photo among 2–4 -- the
// first step of the skill, before naming, and it needs no reading.
//
// The word used is how the child calls the person. The adult's own answer
// to that ("Подпись в предложениях и общении": "мама", "дядя Коля") wins;
// without it, the kin word for close family (mama, not "Анна") and the
// name for everyone else and for pets.
const KIN_WORDS = new Set(["мама", "папа", "бабушка", "дедушка", "брат", "сестра", "тётя", "тетя", "дядя"]);
const POINT_FIELD_SIZES = [2, 3, 4];
export const MIN_POINT_TRIALS_PER_ROUND = 6;
export const MAX_POINT_TRIALS_PER_ROUND = 8;

export function mainWord(person) {
  const label = person?.type !== "pet" ? person?.sentenceLabel?.trim() : "";
  if (label) return label;
  const relation = person?.relation?.trim().toLowerCase();
  if (person?.type !== "pet" && relation && KIN_WORDS.has(relation)) return relation;
  return person?.name?.trim() ?? "";
}

// Which introduction a «Покажи» trial counts as: the kin word is the
// relation axis, a name (or "дядя Коля") the name axis. «Покажи» is the
// first mode a non-reading child gets, so it has to introduce people too --
// otherwise «Кто это?», which asks only about introduced people, stays empty.
function pointAxis(person, word) {
  return word.toLowerCase() === person.relation?.trim().toLowerCase() ? "relation" : "name";
}

function isKnownPerson(person, sessionIntroduced) {
  return Boolean(person.introducedAxes?.length)
    || Object.values(sessionIntroduced ?? {}).some((ids) => ids?.has?.(person.id));
}

function pointTasks(people, params, photoPlanner, sessionIntroduced = {}, round = 0) {
  if (people.length < 2) return [];
  // Ask about people the child has already met plus a few newcomers a
  // lesson (same budget as the album introductions); a miss is corrected
  // errorlessly, so a newcomer's first trial is also their introduction.
  const known = people.filter((person) => isKnownPerson(person, sessionIntroduced));
  const introducedToday = new Set(Object.values(sessionIntroduced ?? {}).flatMap((ids) => [...(ids ?? [])]));
  const budget = Math.max(0, MAX_NEW_PER_SESSION - introducedToday.size);
  const newcomers = people.filter((person) => !isKnownPerson(person, sessionIntroduced)).sort(byCreation).slice(0, budget);
  const pool = [...known, ...newcomers];
  const targets = pool.length >= 2 ? pool : people;
  const requested = Number(params?.fieldSize);
  const fieldSize = Math.min(POINT_FIELD_SIZES.includes(requested) ? requested : 2, people.length);

  const positions = [];
  return pointTargetSequence(targets).map((target, trialIndex) => {
    const word = mainWord(target);
    // Two people answering to the same word (two "Маша") would make the
    // question ambiguous, so they never share a screen.
    const distractors = pickPointDistractors(target, people, word, fieldSize - 1, round);
    const order = shuffle(distractors);
    const position = pickTargetPosition(order.length + 1, positions);
    positions.push(position);
    order.splice(position, 0, target);
    const conceptId = `point:${target.id}`;
    return {
      type: "person_point",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      trialIndex,
      personId: target.id,
      word,
      axis: pointAxis(target, word),
      introduces: !isKnownPerson(target, sessionIntroduced),
      prompt: `Где ${word}?`,
      promptSpeech: `Где ${word}?`,
      choices: order.map((person) => ({
        personId: person.id,
        image: photoPlanner.imageFor(person, "point", person.id === target.id),
      })),
    };
  }).filter((task) => task.choices.length >= 2);
}

// A round has 6–8 trials however few people there are: with two people one
// pass is just two taps, too short to practise. People repeat evenly and
// never three times running, so the child answers the word, not a rhythm.
function pointTargetSequence(targets) {
  const length = Math.min(MAX_POINT_TRIALS_PER_ROUND, Math.max(MIN_POINT_TRIALS_PER_ROUND, targets.length));
  const chosen = shuffle(targets).slice(0, length);
  const remaining = new Map(chosen.map((person) => [person.id, 0]));
  for (let index = 0; index < length; index += 1) {
    const id = chosen[index % chosen.length].id;
    remaining.set(id, remaining.get(id) + 1);
  }
  const byId = new Map(chosen.map((person) => [person.id, person]));
  const sequence = [];
  while (sequence.length < length) {
    const lastTwo = sequence.slice(-2).map((person) => person.id);
    const blocked = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null;
    const open = [...remaining].filter(([id, count]) => count > 0 && id !== blocked);
    // Draw from the people with the most trials left so the tail never
    // ends up as one person three times in a row.
    const pool = open.length ? open : [...remaining].filter(([, count]) => count > 0);
    const most = Math.max(...pool.map(([, count]) => count));
    const candidates = pool.filter(([, count]) => count === most);
    const [id] = candidates[Math.floor(Math.random() * candidates.length)];
    remaining.set(id, remaining.get(id) - 1);
    sequence.push(byId.get(id));
  }
  return sequence;
}

// The right photo never sits in the same place three trials running --
// otherwise "always the left one" pays off as well as knowing the face.
function pickTargetPosition(slots, previous) {
  const lastTwo = previous.slice(-2);
  const blocked = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null;
  const open = Array.from({ length: slots }, (_, index) => index).filter((index) => index !== blocked);
  const choices = open.length ? open : [0];
  return choices[Math.floor(Math.random() * choices.length)];
}

// ── «Найди такого же»: matching two different photos of one person ─────
// No words at all: a photo on top, the same person on another photo among
// 2–4 below. The step before «Покажи» for a child who does not yet link
// "Где мама?" to mum, and direct practice in recognising someone across
// photos rather than by one detail (glasses, a jumper, the kitchen).
// Only people with two or more photos can be targets -- with one photo it
// would be matching identical pictures, a different and easier skill.
const MATCH_FIELD_SIZES = [2, 3, 4];

export function hasTwoPhotos(person) {
  return new Set((person?.photos ?? []).filter(Boolean)).size >= 2;
}

// «Образец»: "same" is the step below -- the very photo on top is among the
// choices (identical matching), so one photo per person is enough; "other"
// (the default) is the same person on a different photo.
export function matchUsesSamePhoto(params) {
  return params?.sample === "same";
}

export function matchTargets(people, params) {
  return matchUsesSamePhoto(params) ? people : people.filter(hasTwoPhotos);
}

function matchTasks(people, params, round) {
  const targets = matchTargets(people, params);
  if (targets.length < 2 || people.length < 2) return [];
  const samePhoto = matchUsesSamePhoto(params);
  const requested = Number(params?.fieldSize);
  const fieldSize = Math.min(MATCH_FIELD_SIZES.includes(requested) ? requested : 2, people.length);
  const randomPhoto = (person) => {
    const photos = person.photos.filter(Boolean);
    return photos[Math.floor(Math.random() * photos.length)];
  };
  const positions = [];
  return pointTargetSequence(targets).map((target, trialIndex) => {
    // Two different photos of the target: one on top, one to find -- or
    // the same photo twice at the identical-matching step.
    const photos = shuffle([...new Set(target.photos.filter(Boolean))]);
    const sample = photos[0];
    const match = samePhoto ? sample : photos[1];
    // Distractors are chosen by person, not by word: two "Маша" are two
    // different faces here, so they may share a screen.
    const distractors = pickPointDistractors(target, people, null, fieldSize - 1, round);
    const order = shuffle(distractors);
    const position = pickTargetPosition(order.length + 1, positions);
    positions.push(position);
    order.splice(position, 0, target);
    const conceptId = `match:${target.id}`;
    return {
      type: "person_match",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      trialIndex,
      personId: target.id,
      sample,
      prompt: "Найди такого же",
      promptSpeech: "Найди такого же.",
      correctSpeech: "Правильно!",
      missSpeech: "Смотри, вот.",
      choices: order.map((person) => ({
        personId: person.id,
        image: person.id === target.id ? match : randomPhoto(person),
      })),
    };
  });
}

// Discrimination goes from easy to hard: in the first round of a lesson a
// pet is set against people and people against a pet when the album has
// both, so the very first choices are the most different ones. Later
// rounds draw from everyone.
function pickPointDistractors(target, people, word, count, round) {
  if (count <= 0) return [];
  // `word` null: no word on screen (matching), so any other person will do.
  const eligible = shuffle(people.filter((person) => person.id !== target.id
    && (word == null || mainWord(person).toLowerCase() !== word.toLowerCase())));
  if (round > 0) return eligible.slice(0, count);
  const isPet = (person) => person.type === "pet";
  const contrasting = eligible.filter((person) => isPet(person) !== isPet(target));
  const similar = eligible.filter((person) => isPet(person) === isPet(target));
  return [...contrasting, ...similar].slice(0, count);
}

function isActive(person) {
  return !person?.deletedAt && person?.enabled !== false && person?.name?.trim() && person?.photos?.some(Boolean);
}

export const LABEL_CIRCLES = ["family", "home", "school", "all"];

// «Подпиши фото» takes its circle from the params; the retired album modes
// carried it in their id ("school_names").
function circleFor(mode, params) {
  if (mode.id === "label_photos") return LABEL_CIRCLES.includes(params?.circle) ? params.circle : "family";
  return CONTEXT_BY_PREFIX[mode.id.split("_")[0]] ?? "all";
}

export function peopleInCircle(student, circle) {
  const people = (student?.myPeople ?? []).filter(isActive);
  return circle && circle !== "all" ? people.filter((person) => person.contexts?.includes(circle)) : people;
}

function peopleForMode(mode, student, params) {
  if (mode.id === "who_is_this" || mode.id === "show_me" || mode.id === "match_same") return peopleInCircle(student, "all");
  return peopleInCircle(student, circleFor(mode, params));
}

// The words an album asks for, in order. "both" follows how the child
// knows the circle: at home mum is "мама" before she is "Анна", at school
// the teacher is "Мария Ивановна" before she is "учительница".
export function labelAxes(mode, params) {
  if (mode.id === "label_photos") {
    const kind = params?.labelKind;
    if (kind === "name") return ["name"];
    if (kind === "both") return circleFor(mode, params) === "school" ? ["name", "relation"] : ["relation", "name"];
    return ["relation"];
  }
  if (mode.id === "mix") return ["name", "relation"];
  return [mode.id.endsWith("_relations") ? "relation" : "name"];
}

// «Подпиши фото» starts at two photos, the usual first field for these
// children; the retired album modes kept their old default of four.
function albumSize(mode, params, available) {
  const requested = Number(params?.peopleCount);
  const selectedSize = ALBUM_SIZES.includes(requested) ? requested : (mode.id === "label_photos" ? 2 : 4);
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
  const axisText = axis === "name" ? "имена" : "кто это";
  const ids = entries.map((entry) => entry.personId).sort().join("_");
  return {
    type: "people_album",
    conceptId: `album:${modeId}:${axis}:${ids}`,
    targetConceptId: `album:${modeId}:${axis}:${ids}`,
    progressConceptIds: entries.map((entry) => entry.conceptId),
    axis,
    // Spoken text is what a person would say to the child ("Подпиши
    // имена"), never a description of the screen ("выбери имя, затем
    // фотографию"), and it never mixes "меня" and "тебя".
    prompt: axis === "name" ? "Подпиши имена" : "Подпиши: кто это",
    promptSpeech: axis === "name" ? "Подпиши имена." : "Подпиши: кто это.",
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
    prompt: "Это",
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
  const groups = toGroups(shuffle(suitablePeople), albumSize(mode, params, suitablePeople.length));
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

// Who the child is meeting changes every round -- an adult, a child, a
// doctor -- so the answers don't stick to one partner. The questions stay
// word for word the same: that is the script.
const INTRODUCE_PARTNERS = [
  { id: "teacher", who: "Новая учительница", hello: "Здравствуй!" },
  { id: "kid", who: "Мальчик на площадке", hello: "Привет!" },
  { id: "doctor", who: "Доктор", hello: "Здравствуй!" },
];
export const INTRODUCE_HINT_LEVELS = { none: 0, starter: 1, full: 2 };

function introduceTasks(student, params, round) {
  const facts = getIntroduceFacts(student);
  if (facts.length < 2) return [];
  const partner = INTRODUCE_PARTNERS[round % INTRODUCE_PARTNERS.length];
  // Script fading: the adult starts from the whole answer on screen, then
  // only its opening words, then nothing.
  const hintLevel = INTRODUCE_HINT_LEVELS[params?.scriptHint] ?? INTRODUCE_HINT_LEVELS.full;
  const turn = (id, question, starter, answer, speechPrefix = "") => {
    const conceptId = `introduce:${id}`;
    return {
      type: "introduce_turn",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      partnerId: partner.id,
      partner: partner.who,
      prompt: question,
      promptSpeech: `${speechPrefix}${question}`,
      starter,
      answer,
      hintLevel,
    };
  };
  return [
    // The greeting opens the conversation; the rest follow in its order.
    ...facts.map((fact, index) => turn(fact.id, fact.question, `${fact.starter} …`, fact.sentence(fact.value), index === 0 ? `${partner.hello} ` : "")),
    // Closing turn: everything at once, in the same order.
    turn(
      "all",
      "Расскажи о себе.",
      facts.map((fact) => `${fact.starter} …`).join(" "),
      facts.map((fact) => fact.sentence(fact.value)).join(" "),
    ),
  ];
}

function personNamingTasks(people, mode, photoPlanner) {
  const known = people.filter((person) => ["name", "relation"].some((axis) => (
    (axis === "name" || person.relation?.trim()) && hasIntroducedAxis(person, axis)
  )));
  if (!known.length) return [];
  // A round is 6–8 trials as in «Покажи»: with two or three people met so
  // far, one pass was two or three questions. People repeat evenly, never
  // three times running, and a repeat comes on another photo when there is
  // one. A single person met so far is asked about once -- six "Кто это?"
  // in a row with one answer is echoing, not naming.
  const sequence = known.length >= 2 ? pointTargetSequence(known) : known;
  return sequence.map((person, trialIndex) => {
    const word = mainWord(person);
    // One concept per person: the question and the accepted answers ("мама"
    // and "Анна") don't depend on the axis, so the progress shouldn't either.
    // Older sessions recorded `person_naming:<id>:<axis>`; the summary reads
    // both.
    const conceptId = `person_naming:${person.id}`;
    const axis = pointAxis(person, word);
    return {
      type: "person_naming",
      conceptId,
      targetConceptId: conceptId,
      progressConceptIds: [conceptId],
      trialIndex,
      personId: person.id,
      axis,
      image: photoPlanner.imageFor(person, "naming", true),
      prompt: "Кто это?",
      promptSpeech: "Кто это?",
      // Both answers are right, so the adult sees both: "мама · Анна".
      answer: namingAnswers(person).join(" · "),
      // The prompts lead to the word the child uses for this person.
      hintWord: word,
      hintSyllable: firstSyllable(word),
    };
  });
}

// The child's own word first, then the other right answers, no repeats.
function namingAnswers(person) {
  const answers = [mainWord(person), person.relation?.trim(), person.name?.trim()].filter(Boolean);
  return answers.filter((answer, index) => answers.findIndex((other) => other.toLowerCase() === answer.toLowerCase()) === index);
}

const VOWELS = /[аеёиоуыэюя]/i;

// The phonemic prompt a speech therapist gives: the opening syllable, "Ма…"
// for "мама". A word that starts with a vowel keeps the next consonant
// ("Ан…" for "Анна") -- a lone "А" says too little.
export function firstSyllable(word) {
  const text = String(word ?? "").trim();
  if (!text) return "";
  const vowelIndex = text.search(VOWELS);
  if (vowelIndex < 0) return text[0];
  if (vowelIndex === 0) return text.length > 1 && !VOWELS.test(text[1]) && /\p{L}/u.test(text[1]) ? text.slice(0, 2) : text[0];
  return text.slice(0, vowelIndex + 1);
}

// Error correction in «Покажи» and «Найди такого же»: a trial the child got
// only with help (a miss, or the light after a pause) comes back once, after
// one or two other trials, now without the light -- the "transfer trial"
// that checks the correction took. The photos swap places; a repeat is not
// repeated again. Pure: the session hook calls it on the round's task list.
const RETRY_TYPES = new Set(["person_point", "person_match"]);

export function insertRetryTrial(tasks, index) {
  const task = tasks?.[index];
  if (!task || task.retry || !RETRY_TYPES.has(task.type)) return tasks;
  const retry = { ...task, retry: true, introduces: false, choices: reorderChoices(task) };
  const samePersonRun = (list, at) => {
    const ids = list.slice(Math.max(0, at - 2), at + 3).map((item) => item.personId);
    return ids.some((id, i) => i >= 2 && id === ids[i - 1] && id === ids[i - 2]);
  };
  // After one other trial, else after two; past the end of the round it
  // closes the round.
  for (const at of [index + 2, index + 3]) {
    if (at > tasks.length) break;
    const candidate = [...tasks.slice(0, at), retry, ...tasks.slice(at)];
    if (!samePersonRun(candidate, at)) return candidate;
  }
  return [...tasks, retry];
}

function reorderChoices(task) {
  const choices = task.choices ?? [];
  if (choices.length < 2) return choices;
  const oldSlot = choices.findIndex((choice) => choice.personId === task.personId);
  const others = shuffle(choices.filter((choice) => choice.personId !== task.personId));
  const slots = Array.from({ length: choices.length }, (_, i) => i).filter((i) => i !== oldSlot);
  const slot = slots[Math.floor(Math.random() * slots.length)];
  others.splice(slot, 0, choices[oldSlot]);
  return others;
}

// sessionIntroduced: { name?: Set<personId>, relation?: Set<personId> } of
// people already introduced in earlier rounds of the current lesson.
// history: aboutMeHistory(...) for «Обо мне» -- what was asked when, how it went.
export function generateTasks(mode, student, params = {}, previousImages = new Map(), sessionIntroduced = {}, round = 0, history = null) {
  if (!mode || !student) return [];
  if (mode.id === "about_me") return aboutMeQuestionTasks(student, params, round, history);
  // The open "introduce yourself in a situation" cards: an advanced level
  // for a child who already answers the short questions reliably.
  if (mode.id === "introduce_self") return introduceTasks(student, params, round);

  const people = peopleForMode(mode, student, params);
  const photoPlanner = createPhotoPlanner(previousImages);

  if (mode.id === "who_is_this") return personNamingTasks(people, mode, photoPlanner);
  if (mode.id === "show_me") return pointTasks(people, params, photoPlanner, sessionIntroduced, round);
  if (mode.id === "match_same") return matchTasks(people, params, round);
  if (people.length < MIN_ALBUM_SIZE) return [];

  // Two axes in one lesson stay separate: each has its own introductions
  // before its album, and the second uses another photo when there is one.
  return labelAxes(mode, params).flatMap((axis, index) => (
    tasksForAxis(people, axis, mode, params, photoPlanner, index > 0, sessionIntroduced)
  ));
}
