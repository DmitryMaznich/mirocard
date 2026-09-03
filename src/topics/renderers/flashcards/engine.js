import { shuffle } from "@/shared/utils/shuffle";
import { pickVariation, deriveConcepts } from "@/shared/utils/topicUtils";
import { selectDistractorConceptIds } from "@/shared/utils/distractorEngine";

function generateIntroTasks(concepts) {
  const tasks = [];
  for (const concept of concepts) {
    for (const card of concept.cards) {
      tasks.push({
        type: "intro",
        conceptId: concept.conceptId,
        card,
        label: concept.primary?.label ?? concept.conceptId,
      });
    }
  }
  return shuffle(tasks);
}

// A control task keeps the productive prompt (“name the emotion”) but makes
// the answer observable: by default every concept in the topic is offered
// as a word (the active session may be narrowed to selected targets, while
// its answer bank remains the full topic vocabulary). params.optionCount
// narrows that answer bank instead to the N most confusable concepts (via
// selectDistractorConceptIds at "hard" difficulty) - a smaller, still
// meaningfully-hard set for a child who isn't ready for the full topic
// vocabulary as both a receptive (find the word) and expressive (name it
// first) task at once.
function generateEmotionControlTasks(displayConcepts, allCards, params = {}) {
  const vocabularyCards = allCards
    .filter((card) => card.primary && card.cardType !== "situation" && card.label);
  const vocabularyConcepts = deriveConcepts(vocabularyCards);
  const optionCount = Math.min(params.optionCount ?? vocabularyConcepts.length, vocabularyConcepts.length);

  return generateIntroTasks(displayConcepts).map((task) => {
    const distractorCount = Math.max(0, Math.min(optionCount - 1, vocabularyConcepts.length - 1));
    const distractorIds = selectDistractorConceptIds(task.conceptId, vocabularyConcepts, distractorCount, "hard");
    const targetCard = vocabularyCards.find((card) => card.conceptId === task.conceptId);
    const options = [
      { conceptId: task.conceptId, label: targetCard?.label ?? task.conceptId, isTarget: true },
      ...distractorIds.map((conceptId) => ({
        conceptId,
        label: vocabularyCards.find((card) => card.conceptId === conceptId)?.label ?? conceptId,
        isTarget: false,
      })),
    ];
    return { ...task, type: "emotion_control", options: shuffle(options) };
  });
}

function filterByTaskKind(concepts, kind) {
  return concepts.filter((concept) => concept.cards.some((card) => card.taskKind === kind));
}

function generateMirrorDrawTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "mirror")).map((t) => ({ ...t, type: "mirror_draw" }));
}

function generateRepeatDrawTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "repeat")).map((t) => ({ ...t, type: "repeat_draw" }));
}

function generateGraphicDictationTasks(concepts, params) {
  const taskKind = params?.dictationCommand === "coordinates" ? "coordinate" : "dictation";
  return generateIntroTasks(filterByTaskKind(concepts, taskKind)).map((t) => ({ ...t, type: "graphic_dictation" }));
}

// Navigator is deliberately a short, repeating reaction drill instead of a
// finite set of picture cards. The one metadata card keeps it compatible with
// the topic/concept picker; every generated task then carries its own direction.
function generateNavigatorTasks(concepts, params) {
  const cards = filterByTaskKind(concepts, "navigator");
  const source = cards.flatMap((concept) => concept.cards.filter((card) => card.taskKind === "navigator"));
  const base = source[0];
  if (!base) return [];
  const directions = params?.navigatorDirections === "all"
    ? ["up", "down", "left", "right", "up_left", "up_right", "down_left", "down_right"]
    : ["up", "down", "left", "right"];
  const sequence = Array.from({ length: 20 }, (_, index) => directions[index % directions.length]);
  return shuffle(sequence).map((direction, index) => ({
    type: "navigator",
    id: `navigator_${index}_${direction}`,
    conceptId: base.conceptId,
    card: base,
    label: base.label,
    direction,
    cells: (index % 3) + 1,
  }));
}

// A short coordinate deck uses a fresh point every time, so the child learns
// to read the labels rather than memorising a familiar picture on the grid.
function generateCoordinateTasks(concepts) {
  const cards = filterByTaskKind(concepts, "coordinates");
  const base = cards.flatMap((concept) => concept.cards).find((card) => card.taskKind === "coordinates");
  if (!base) return [];
  const columns = Math.max(1, Math.min(7, Math.round(Number(base.columns) || 7)));
  const rows = Math.max(1, Math.min(7, Math.round(Number(base.rows) || 7)));
  const points = [];
  for (let col = 0; col <= columns; col += 1) {
    for (let row = 0; row <= rows; row += 1) points.push({ col, row });
  }
  return shuffle(points).slice(0, 20).map((target, index) => ({
    id: `coordinates-${index}-${target.col}-${target.row}`,
    type: "coordinates",
    conceptId: base.conceptId,
    card: base,
    label: base.label,
    target,
  }));
}

function getSituationCards(allCards, use = "all") {
  return allCards.filter((card) => {
    if (card.cardType !== "situation") return false;
    const situationUse = card.situationUse ?? "auto";
    if (use === "intro") return true;
    if (use === "all") return situationUse !== "deferred";
    return situationUse === use;
  });
}

function conceptsForSituations(displayConcepts, situationCards) {
  const conceptIds = new Set(situationCards.map((card) => card.conceptId));
  return displayConcepts.filter((concept) => conceptIds.has(concept.conceptId));
}

function shuffleSituationTasks(tasks, params) {
  const shuffled = shuffle(tasks);
  const taskCount = Number(params?.taskCount);
  return Number.isFinite(taskCount) && taskCount > 0 ? shuffled.slice(0, taskCount) : shuffled;
}

function generateSituationEmotionTasks(displayConcepts, allCards, params) {
  const optionCount = params.optionCount ?? 4;
  const difficulty = params.distractorLevel ?? "medium";
  const situationCards = getSituationCards(allCards, "auto");
  const taskConcepts = conceptsForSituations(displayConcepts, situationCards);
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = taskConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    const distractorCount = Math.min(optionCount - 1, taskConcepts.length - 1);
    const distractorIds = selectDistractorConceptIds(situationCard.conceptId, taskConcepts, distractorCount, difficulty);
    const distractorOptions = distractorIds.map((cid) => {
      const dc = taskConcepts.find((c) => c.conceptId === cid);
      return { conceptId: cid, card: pickVariation(dc), isTarget: false };
    });
    const targetOption = { conceptId: situationCard.conceptId, card: pickVariation(targetConcept), isTarget: true };
    tasks.push({
      type: "situation_emotion",
      targetConceptId: situationCard.conceptId,
      targetLabel: situationCard.label,
      sceneImage: situationCard.sceneImage ?? null,
      options: shuffle([targetOption, ...distractorOptions]),
    });
  }
  return shuffleSituationTasks(tasks, params);
}

function generateSituationIntroTasks(displayConcepts, allCards, params) {
  const situationCards = getSituationCards(allCards, "intro");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    // A situation can supply a dedicated portrait of the same child. Keep it
    // local to this two-step flow so the general face-card modes retain their
    // existing variation set.
    const revealCard = situationCard.revealImage
      ? {
        ...targetConcept.primary,
        id: `${situationCard.id}_reveal`,
        image: situationCard.revealImage,
      }
      : situationCard.revealCardId
        ? allCards.find((card) => card.id === situationCard.revealCardId && card.conceptId === situationCard.conceptId)
        : null;
    tasks.push({
      type: "situation_intro",
      conceptId: situationCard.conceptId,
      situationText: situationCard.label,
      sceneImage: situationCard.sceneImage ?? null,
      card: revealCard ?? pickVariation(targetConcept),
      label: targetConcept.primary?.label ?? targetConcept.conceptId,
    });
  }
  return shuffleSituationTasks(tasks, params);
}

function generateEmotionSituationTasks(displayConcepts, allCards, params) {
  const optionCount = params.optionCount ?? 4;
  const difficulty = params.distractorLevel ?? "medium";
  const situationCards = getSituationCards(allCards, "auto");
  const taskConcepts = conceptsForSituations(displayConcepts, situationCards);
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = taskConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    const distractorCount = Math.min(optionCount - 1, taskConcepts.length - 1);
    const distractorIds = selectDistractorConceptIds(situationCard.conceptId, taskConcepts, distractorCount, difficulty);
    const distractorOptions = distractorIds
      .map((cid) => {
        const candidates = situationCards.filter((sc) => sc.conceptId === cid);
        if (candidates.length === 0) return null;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return {
          id: pick.id,
          label: pick.label,
          sceneImage: pick.sceneImage ?? null,
          conceptId: cid,
          isTarget: false,
        };
      })
      .filter(Boolean);
    const targetOption = {
      id: situationCard.id,
      label: situationCard.label,
      sceneImage: situationCard.sceneImage ?? null,
      conceptId: situationCard.conceptId,
      isTarget: true,
    };
    tasks.push({
      type: "emotion_situation",
      conceptId: situationCard.conceptId,
      card: pickVariation(targetConcept),
      options: shuffle([targetOption, ...distractorOptions]),
    });
  }
  return shuffleSituationTasks(tasks, params);
}

// Most nouns share their nominative and accusative forms, but not all
// (e.g. "скука" -> "скуку"). Cards may set `accusative` to override.
function accusativeLabel(card) {
  return card?.accusative ?? card?.label;
}

function generateYesNoTasks(concepts, params) {
  const reps = params.repsPerConcept ?? 1;
  const tasks = [];
  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      // One task per photo variation, not one random pick per rep - see
      // generateFindNTasks for why.
      for (const targetCard of concept.cards) {
        const useCorrect = Math.random() < 0.5;
        let displayLabel;
        if (useCorrect) {
          displayLabel = accusativeLabel(concept.primary) ?? concept.conceptId;
        } else {
          const others = concepts.filter((c) => c.conceptId !== concept.conceptId);
          const distractor = others[Math.floor(Math.random() * others.length)];
          displayLabel = accusativeLabel(distractor?.primary) ?? accusativeLabel(concept.primary);
        }
        tasks.push({
          type: "yes_no",
          conceptId: concept.conceptId,
          card: targetCard,
          displayLabel,
          correctLabel: accusativeLabel(concept.primary) ?? concept.conceptId,
          isLabelCorrect: useCorrect,
        });
      }
    }
  }
  return shuffle(tasks);
}

// Some topics (e.g. people_names) document that one comparison axis (gender:
// boy/girl, man/woman) must not be confounded with another one already encoded
// by the same cards (age: child/adult). When the target has semantic.age,
// narrow its distractor pool to concepts of the same age. This is a no-op for
// ordinary flashcard topics and falls back to the full pool for small selections
// where there is no same-age alternative.
function sameAgePool(concept, concepts) {
  const age = concept.primary?.semantic?.age;
  if (!age) return concepts;
  const narrowed = concepts.filter(
    (candidate) => candidate.conceptId === concept.conceptId || candidate.primary?.semantic?.age === age
  );
  return narrowed.length > 1 ? narrowed : concepts;
}

function generateFindNTasks(concepts, params) {
  const reps        = params.repsPerConcept ?? 1;
  const optionCount = params.optionCount    ?? 4;
  const difficulty  = params.distractorLevel ?? "medium";
  const tasks = [];

  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      // One task per photo variation, not one random pick per rep - a concept
      // with 3 images must produce 3 find_n tasks (x reps), otherwise most of
      // its variations never appear in a session at all.
      for (const targetCard of concept.cards) {
        const pool = sameAgePool(concept, concepts);
        const distractorCount = Math.min(optionCount - 1, pool.length - 1);
        const distractorIds   = selectDistractorConceptIds(
          concept.conceptId, pool, distractorCount, difficulty
        );
        const distractorOptions = distractorIds.map((cid) => {
          const dc = pool.find((c) => c.conceptId === cid);
          return { conceptId: cid, card: pickVariation(dc), isTarget: false };
        });
        const targetOption = {
          conceptId: concept.conceptId,
          card: targetCard,
          isTarget: true,
        };
        tasks.push({
          type: "find_n",
          targetConceptId: concept.conceptId,
          targetLabel: concept.primary?.label ?? concept.conceptId,
          promptSpeech: targetCard.promptSpeech ?? null,
          options: shuffle([targetOption, ...distractorOptions]),
        });
      }
    }
  }
  return shuffle(tasks);
}

// A probe task must use a photo the child has never drilled on in any
// teaching mode - the whole point is testing whether the word transferred
// to a new person, not whether the child memorised a specific photo. Reuses
// generateFindNTasks's task shape exactly; the only difference is the card
// pool, which is restricted to cards the author explicitly reserved via
// card.probeOnly instead of the pool every other mode draws from.
function generateProbeTasks(concepts, params) {
  const probeConcepts = concepts
    .map((c) => ({ ...c, cards: c.cards.filter((card) => card.probeOnly) }))
    .filter((c) => c.cards.length > 0);
  return generateFindNTasks(probeConcepts, params);
}

function generateChooseWordTasks(concepts, params) {
  const reps = params.repsPerConcept ?? 1;
  const tasks = [];

  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      // One task per photo variation, not one random pick per rep - see
      // generateFindNTasks for why.
      for (const targetCard of concept.cards) {
        const pool = sameAgePool(concept, concepts);
        const distractorCount = Math.min(3, pool.length - 1);
        const distractorIds   = selectDistractorConceptIds(
          concept.conceptId, pool, distractorCount, "medium"
        );
        const distractorOptions = distractorIds.map((cid) => {
          const dc = pool.find((c) => c.conceptId === cid);
          return { label: dc.primary?.label ?? cid, conceptId: cid, isTarget: false };
        });
        const targetOption = {
          label: concept.primary?.label ?? concept.conceptId,
          conceptId: concept.conceptId,
          isTarget: true,
        };
        tasks.push({
          type: "choose_word_by_picture",
          conceptId: concept.conceptId,
          card: targetCard,
          options: shuffle([targetOption, ...distractorOptions]),
        });
      }
    }
  }
  return shuffle(tasks);
}

function generateChooseAllTasks(concepts, params) {
  const gridSize   = params.optionCount ?? 6;
  const maxTargets = Math.max(1, Math.floor(gridSize / 2));
  const tasks = [];

  for (const concept of concepts) {
    // One round per chunk of variations, not just the first maxTargets -
    // a concept with more variations than fit in one grid otherwise never
    // shows its later variations at all, in any session.
    for (let start = 0; start < concept.cards.length; start += maxTargets) {
      const targetCards    = concept.cards.slice(start, start + maxTargets);
      const distractorCount = gridSize - targetCards.length;
      const distractorIds  = selectDistractorConceptIds(concept.conceptId, concepts, distractorCount, "medium");
      const distractorCards = distractorIds.map((cid) => {
        const dc = concepts.find((c) => c.conceptId === cid);
        return pickVariation(dc);
      });

      tasks.push({
        type:         "choose_all",
        conceptId:    concept.conceptId,
        targetLabel:  concept.primary?.label ?? concept.conceptId,
        targetCardIds: targetCards.map((c) => c.id),
        allCards:     shuffle([...targetCards, ...distractorCards]),
      });
    }
  }

  return shuffle(tasks);
}

// A person's name is an independent label for this particular photo, not a
// property inferred from the category word. Keep the ordinary category intro
// and this name-only exposure separate so the two verbal models are never
// introduced as one rule. Also swaps card.audio for card.personAudio: once
// pre-recorded audio exists, getTaskAudioPath (index.jsx) plays whatever is
// in card.audio.ru unconditionally, so leaving the category line's
// recording in place here would play "Это мальчик." on a screen captioned
// "Петя" - a personAudio clip (or none, falling back to browser TTS of
// personSpeech) must replace it, not stack with it.
function generatePersonIntroTasks(concepts) {
  return generateIntroTasks(concepts).map((task) => {
    const person = task.card?.person;
    return {
      ...task,
      type: "person_intro",
      label: person?.name ?? task.label,
      card: person?.name
        ? { ...task.card, speech: task.card.personSpeech ?? task.card.speech, audio: task.card.personAudio }
        : task.card,
    };
  });
}

function getPerson(card) {
  if (!card?.person?.name) return null;
  return {
    id: card.person.id ?? card.id,
    name: card.person.name,
  };
}

function namedCards(concepts) {
  return concepts.flatMap((concept) => concept.cards)
    .filter((card) => Boolean(getPerson(card)));
}

// These two directions deliberately keep an individual person as the unit of
// learning. A name is first an arbitrary, socially useful label for a person —
// not a rule for inferring a person's category from spelling or sound.
function generateFindPersonByNameTasks(concepts, params = {}) {
  const cards = namedCards(concepts);
  const optionCount = Math.max(2, Math.min(params.optionCount ?? 2, cards.length));
  return shuffle(cards.map((targetCard) => {
    const targetPerson = getPerson(targetCard);
    const alternatives = shuffle(cards.filter((card) => getPerson(card)?.id !== targetPerson.id))
      .slice(0, optionCount - 1);
    const options = shuffle([
      { card: targetCard, conceptId: targetCard.conceptId, isTarget: true },
      ...alternatives.map((card) => ({ card, conceptId: card.conceptId, isTarget: false })),
    ]);
    return {
      type: "find_person_by_name",
      targetConceptId: targetCard.conceptId,
      targetLabel: `Где ${targetPerson.name}?`,
      promptSpeech: `Где ${targetPerson.name}?`,
      targetPersonId: targetPerson.id,
      options,
    };
  }));
}

function generateChooseNameTasks(concepts, params = {}) {
  const cards = namedCards(concepts);
  const optionCount = Math.max(2, Math.min(params.optionCount ?? 2, cards.length));
  return shuffle(cards.map((targetCard) => {
    const targetPerson = getPerson(targetCard);
    const alternatives = shuffle(cards.filter((card) => getPerson(card)?.id !== targetPerson.id))
      .slice(0, optionCount - 1);
    return {
      type: "choose_name",
      conceptId: targetCard.conceptId,
      card: targetCard,
      targetPersonId: targetPerson.id,
      promptSpeech: "Как зовут?",
      options: shuffle([
        { id: targetPerson.id, label: targetPerson.name, isTarget: true },
        ...alternatives.map((card) => {
          const person = getPerson(card);
          return { id: person.id, label: person.name, isTarget: false };
        }),
      ]),
    };
  }));
}

const SORT_GROUPS = {
  age: [
    { value: "child", label: "Ребёнок" },
    { value: "adult", label: "Взрослый" },
  ],
  category: [
    { value: "boy", label: "Мальчик" },
    { value: "girl", label: "Девочка" },
    { value: "man", label: "Мужчина" },
    { value: "woman", label: "Женщина" },
  ],
};

function generateSortByAttributeTasks(concepts, params = {}) {
  const sortBy = params.sortBy === "category" ? "category" : "age";
  const groups = SORT_GROUPS[sortBy];
  const cards = concepts.flatMap((concept) => concept.cards)
    .filter((card) => groups.some((group) => group.value === card?.semantic?.[sortBy]));
  return shuffle(cards.map((card) => ({
    type: "sort_by_attribute",
    conceptId: card.conceptId,
    card,
    sortBy,
    groups,
    targetValue: card.semantic[sortBy],
  })));
}

export function generateTasks(modeType, concepts, allCards, params = {}) {
  // Cards tagged with a cardType (e.g. "situation") aren't an ordinary
  // picture/word variation and must never surface as one - strip them from
  // every mode's card pool except the mode built specifically to consume
  // them. A card that never sets cardType passes through unchanged, so this
  // is a no-op for every flashcards topic other than emotions_v2.
  const displayConcepts = concepts.map((c) => {
    const displayCards = c.cards.filter((card) => !card.cardType && !card.probeOnly);
    if (displayCards.length === c.cards.length) return c;
    return { ...c, cards: displayCards, primary: displayCards.find((card) => card.primary) ?? displayCards[0] ?? c.primary };
  });
  switch (modeType) {
    case "intro":                  return generateIntroTasks(displayConcepts);
    case "person_intro":           return generatePersonIntroTasks(displayConcepts);
    case "mirror_draw":            return generateMirrorDrawTasks(displayConcepts);
    case "repeat_draw":            return generateRepeatDrawTasks(displayConcepts);
    case "graphic_dictation":      return generateGraphicDictationTasks(displayConcepts, params);
    case "navigator":              return generateNavigatorTasks(displayConcepts, params);
    case "coordinates":            return generateCoordinateTasks(displayConcepts);
    case "situation_emotion":      return generateSituationEmotionTasks(displayConcepts, allCards, params);
    case "situation_intro":        return generateSituationIntroTasks(displayConcepts, allCards, params);
    case "emotion_situation":      return generateEmotionSituationTasks(displayConcepts, allCards, params);
    case "emotion_control":        return generateEmotionControlTasks(displayConcepts, allCards, params);
    case "question_answer":        return generateIntroTasks(displayConcepts).map((t) => ({ ...t, type: "question_answer" }));
    case "yes_no":                 return generateYesNoTasks(displayConcepts, params);
    case "find_n":                 return generateFindNTasks(displayConcepts, params);
    case "generalisation_probe":   return generateProbeTasks(concepts, params);
    case "choose_word_by_picture": return generateChooseWordTasks(displayConcepts, params);
    case "choose_all":             return generateChooseAllTasks(displayConcepts, params);
    case "find_person_by_name":    return generateFindPersonByNameTasks(displayConcepts, params);
    case "choose_name":            return generateChooseNameTasks(displayConcepts, params);
    case "sort_by_attribute":      return generateSortByAttributeTasks(displayConcepts, params);
    default:                       return [];
  }
}
