import { shuffle } from "@/shared/utils/shuffle";

const CONTEXT_BY_PREFIX = { family: "family", home: "home", school: "school" };
const MIN_ALBUM_SIZE = 2;
const MAX_ALBUM_SIZE = 8;
const ALBUM_SIZES = [4, 6, 8];

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
    const firstSize = Math.floor(combined.length / 2);
    groups.splice(-2, 2, combined.slice(0, firstSize), combined.slice(firstSize));
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

function hasIntroducedAxis(person, axis) {
  return Array.isArray(person.introducedAxes) && person.introducedAxes.includes(axis);
}

function albumTasks(people, axis, mode, params, photoPlanner, preferDifferentPhoto = false) {
  const suitablePeople = axis === "relation" ? people.filter((person) => person.relation?.trim()) : people;
  if (suitablePeople.length < MIN_ALBUM_SIZE) return [];
  const groups = toGroups(shuffle(suitablePeople), albumSize(params, suitablePeople.length));
  return groups.map((group) => taskForGroup(group, axis, mode.id, photoPlanner, preferDifferentPhoto));
}

function tasksForAxis(people, axis, mode, params, photoPlanner, preferDifferentPhoto = false) {
  const suitablePeople = axis === "relation" ? people.filter((person) => person.relation?.trim()) : people;
  const newPeople = suitablePeople.filter((person) => !hasIntroducedAxis(person, axis));
  const introducedPeople = suitablePeople.filter((person) => hasIntroducedAxis(person, axis));

  // Do not let staged learning make the lesson impossible: when there are
  // fewer than two already introduced people, keep the existing album intact
  // after the introductions. Otherwise the newly introduced people enter the
  // album on the next renewable round.
  const peopleForAlbum = introducedPeople.length >= MIN_ALBUM_SIZE ? introducedPeople : suitablePeople;

  return [
    ...shuffle(newPeople).map((person) => introTaskForPerson(person, axis, mode.id, photoPlanner, preferDifferentPhoto)),
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

export function generateTasks(mode, student, params = {}, previousImages = new Map()) {
  if (!mode || !student) return [];
  if (mode.id === "about_me") return aboutMeTasks(student);

  const people = peopleForMode(mode, student);
  const photoPlanner = createPhotoPlanner(previousImages);

  if (mode.id === "who_is_this") return personNamingTasks(people, mode, photoPlanner);
  if (people.length < MIN_ALBUM_SIZE) return [];

  if (mode.id === "mix") {
    // The mixed block keeps the concepts separate inside one lesson: names
    // first, then relationships. Each axis has its own introductions before
    // its association album and, when available, uses another photo.
    return [
      ...tasksForAxis(people, "name", mode, params, photoPlanner),
      ...tasksForAxis(people, "relation", mode, params, photoPlanner, true),
    ];
  }

  return tasksForAxis(people, axisForMode(mode), mode, params, photoPlanner);
}
