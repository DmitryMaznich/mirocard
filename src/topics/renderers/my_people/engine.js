import { shuffle } from "@/shared/utils/shuffle";

const CONTEXT_BY_PREFIX = { family: "family", home: "home", school: "school" };
const MIN_ALBUM_SIZE = 2;
const MAX_ALBUM_SIZE = 8;
const ALBUM_SIZES = [4, 6, 8];

function isActive(person) {
  return !person?.deletedAt && person?.enabled !== false && person?.name?.trim() && person?.photos?.some(Boolean);
}

function peopleForMode(mode, student) {
  const people = (student?.myPeople ?? []).filter(isActive);
  if (mode.id === "mix") return people;
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

function albumTasks(people, axis, mode, params, photoPlanner, preferDifferentPhoto = false) {
  const suitablePeople = axis === "relation" ? people.filter((person) => person.relation?.trim()) : people;
  if (suitablePeople.length < MIN_ALBUM_SIZE) return [];
  const groups = toGroups(shuffle(suitablePeople), albumSize(params, suitablePeople.length));
  return groups.map((group) => taskForGroup(group, axis, mode.id, photoPlanner, preferDifferentPhoto));
}

export function generateTasks(mode, student, params = {}, previousImages = new Map()) {
  if (!mode || !student) return [];
  const people = peopleForMode(mode, student);
  if (people.length < MIN_ALBUM_SIZE) return [];
  const photoPlanner = createPhotoPlanner(previousImages);

  if (mode.id === "mix") {
    // The mixed block keeps the concepts separate inside one lesson: names
    // first, then relationships on a reshuffled album and, when available,
    // another photo of each person.
    return [
      ...albumTasks(people, "name", mode, params, photoPlanner),
      ...albumTasks(people, "relation", mode, params, photoPlanner, true),
    ];
  }

  return albumTasks(people, axisForMode(mode), mode, params, photoPlanner);
}
