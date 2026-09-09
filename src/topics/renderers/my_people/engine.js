import { shuffle } from "@/shared/utils/shuffle";

const CONTEXT_BY_PREFIX = { family: "family", home: "home", school: "school" };

function isActive(person) {
  return !person?.deletedAt && person?.enabled !== false && person?.name?.trim() && person?.photos?.[0];
}

function cardFor(person, axis) {
  const label = axis === "relation" ? person.relation?.trim() : person.name.trim();
  return {
    id: `${person.id}:${axis}`,
    conceptId: `${person.id}:${axis}`,
    image: person.photos[0],
    speech: label,
    label,
  };
}

function peopleForMode(mode, student) {
  const people = (student?.myPeople ?? []).filter(isActive);
  if (mode.id === "mix") return people.filter((person) => person.relation?.trim());
  const prefix = mode.id.split("_")[0];
  const context = CONTEXT_BY_PREFIX[prefix];
  return context ? people.filter((person) => person.contexts?.includes(context)) : people;
}

function optionsFor(target, people, axis, count) {
  const targetCard = cardFor(target, axis);
  const candidates = shuffle(people.filter((person) => person.id !== target.id))
    .slice(0, Math.max(0, count - 1))
    .map((person) => ({ conceptId: `${person.id}:${axis}`, card: cardFor(person, axis), isTarget: false }));
  return shuffle([{ conceptId: targetCard.conceptId, card: targetCard, isTarget: true }, ...candidates]);
}

function generateRecognition(mode, people, axis, params) {
  if (people.length < 2) return [];
  const optionCount = Math.min(Math.max(2, Number(params?.optionCount) || 2), people.length);
  return shuffle(people).map((person) => {
    const label = axis === "relation" ? person.relation.trim() : person.name.trim();
    return {
      type: "find_n",
      targetConceptId: `${person.id}:${axis}`,
      targetLabel: `Где ${label}?`,
      promptSpeech: `Где ${label}?`,
      inlinePromptAudio: true,
      options: optionsFor(person, people, axis, optionCount),
    };
  });
}

function generateMix(people, params) {
  if (people.length < 2) return [];
  const optionCount = Math.min(Math.max(2, Number(params?.optionCount) || 4), people.length);
  return shuffle(people.flatMap((person, index) => {
    const axis = index % 2 === 0 ? "name" : "relation";
    const label = axis === "relation" ? person.relation.trim() : person.name.trim();
    return [{
      type: "find_n",
      targetConceptId: `${person.id}:${axis}`,
      targetLabel: `Где ${label}?`,
      promptSpeech: `Где ${label}?`,
      inlinePromptAudio: true,
      options: optionsFor(person, people, axis, optionCount),
    }];
  }));
}

function selfCard(student) {
  return student?.photo ? {
    id: "self:name", conceptId: "self:name", image: student.photo,
    speech: student.name ?? "", label: student.name ?? "",
  } : null;
}

function personalAnswer(mode, student) {
  const profile = student?.myPeopleProfile ?? {};
  const answers = {
    family_name: profile.familyName?.trim(),
    family_label: profile.familyLabel?.trim(),
    city: profile.city?.trim(),
    address: profile.address?.trim(),
  };
  const value = answers[mode.id];
  const questions = {
    family_name: "Какая у тебя фамилия?",
    family_label: "Как называется ваша семья?",
    city: "В каком городе ты живёшь?",
    address: "По какому адресу ты живёшь?",
  };
  if (!value) return [];
  const photoPerson = (student?.myPeople ?? []).find(isActive);
  const card = selfCard(student) ?? (photoPerson ? cardFor(photoPerson, "name") : null);
  if (!card) return [];
  return [{ type: "question_answer", conceptId: mode.id, card, label: value, question: questions[mode.id], promptSpeech: questions[mode.id] }];
}

export function generateTasks(mode, student, params = {}) {
  if (!mode || !student) return [];
  if (mode.id === "self_name") {
    const card = selfCard(student);
    return card ? [{ type: "intro", conceptId: card.conceptId, card, label: card.label }] : [];
  }
  if (["family_name", "family_label", "city", "address"].includes(mode.id)) return personalAnswer(mode, student);

  const people = peopleForMode(mode, student);
  const isRelation = mode.id.includes("relations");
  if (mode.type === "intro") {
    const axis = isRelation ? "relation" : "name";
    return shuffle(people.filter((person) => axis === "name" || person.relation?.trim()))
      .map((person) => {
        const card = cardFor(person, axis);
        return { type: "intro", conceptId: card.conceptId, card, label: card.label };
      });
  }
  if (mode.id === "mix") return generateMix(people, params);
  return generateRecognition(mode, people.filter((person) => !isRelation || person.relation?.trim()), isRelation ? "relation" : "name", params);
}
