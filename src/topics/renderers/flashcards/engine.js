import { shuffle } from "@/shared/utils/shuffle";
import { pickVariation } from "@/shared/utils/topicUtils";
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

function filterByTaskKind(concepts, kind) {
  return concepts.filter((concept) => concept.cards.some((card) => card.taskKind === kind));
}

function generateMirrorDrawTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "mirror")).map((t) => ({ ...t, type: "mirror_draw" }));
}

function generateRepeatDrawTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "repeat")).map((t) => ({ ...t, type: "repeat_draw" }));
}

function generateSituationEmotionTasks(displayConcepts, allCards, params) {
  const optionCount = params.optionCount ?? 4;
  const difficulty = params.distractorLevel ?? "medium";
  const situationCards = allCards.filter((c) => c.cardType === "situation");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    const distractorCount = Math.min(optionCount - 1, displayConcepts.length - 1);
    const distractorIds = selectDistractorConceptIds(situationCard.conceptId, displayConcepts, distractorCount, difficulty);
    const distractorOptions = distractorIds.map((cid) => {
      const dc = displayConcepts.find((c) => c.conceptId === cid);
      return { conceptId: cid, card: pickVariation(dc), isTarget: false };
    });
    const targetOption = { conceptId: situationCard.conceptId, card: pickVariation(targetConcept), isTarget: true };
    tasks.push({
      type: "situation_emotion",
      targetConceptId: situationCard.conceptId,
      targetLabel: situationCard.label,
      options: shuffle([targetOption, ...distractorOptions]),
    });
  }
  return shuffle(tasks);
}

function generateSituationIntroTasks(displayConcepts, allCards) {
  const situationCards = allCards.filter((c) => c.cardType === "situation");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    tasks.push({
      type: "situation_intro",
      conceptId: situationCard.conceptId,
      situationText: situationCard.label,
      card: pickVariation(targetConcept),
      label: targetConcept.primary?.label ?? targetConcept.conceptId,
    });
  }
  return shuffle(tasks);
}

function generateEmotionSituationTasks(displayConcepts, allCards, params) {
  const optionCount = params.optionCount ?? 4;
  const difficulty = params.distractorLevel ?? "medium";
  const situationCards = allCards.filter((c) => c.cardType === "situation");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    const distractorCount = Math.min(optionCount - 1, displayConcepts.length - 1);
    const distractorIds = selectDistractorConceptIds(situationCard.conceptId, displayConcepts, distractorCount, difficulty);
    const distractorOptions = distractorIds
      .map((cid) => {
        const candidates = situationCards.filter((sc) => sc.conceptId === cid);
        if (candidates.length === 0) return null;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return { label: pick.label, conceptId: cid, isTarget: false };
      })
      .filter(Boolean);
    const targetOption = { label: situationCard.label, conceptId: situationCard.conceptId, isTarget: true };
    tasks.push({
      type: "emotion_situation",
      conceptId: situationCard.conceptId,
      card: pickVariation(targetConcept),
      options: shuffle([targetOption, ...distractorOptions]),
    });
  }
  return shuffle(tasks);
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
        card: pickVariation(concept),
        displayLabel,
        correctLabel: accusativeLabel(concept.primary) ?? concept.conceptId,
        isLabelCorrect: useCorrect,
      });
    }
  }
  return shuffle(tasks);
}

function generateFindNTasks(concepts, params) {
  const reps        = params.repsPerConcept ?? 1;
  const optionCount = params.optionCount    ?? 4;
  const difficulty  = params.distractorLevel ?? "medium";
  const tasks = [];

  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      const distractorCount = Math.min(optionCount - 1, concepts.length - 1);
      const distractorIds   = selectDistractorConceptIds(
        concept.conceptId, concepts, distractorCount, difficulty
      );
      const distractorOptions = distractorIds.map((cid) => {
        const dc = concepts.find((c) => c.conceptId === cid);
        return { conceptId: cid, card: pickVariation(dc), isTarget: false };
      });
      const targetOption = {
        conceptId: concept.conceptId,
        card: pickVariation(concept),
        isTarget: true,
      };
      tasks.push({
        type: "find_n",
        targetConceptId: concept.conceptId,
        targetLabel: concept.primary?.label ?? concept.conceptId,
        options: shuffle([targetOption, ...distractorOptions]),
      });
    }
  }
  return shuffle(tasks);
}

function generateChooseWordTasks(concepts, params) {
  const reps = params.repsPerConcept ?? 1;
  const tasks = [];

  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      const distractorCount = Math.min(3, concepts.length - 1);
      const distractorIds   = selectDistractorConceptIds(
        concept.conceptId, concepts, distractorCount, "medium"
      );
      const distractorOptions = distractorIds.map((cid) => {
        const dc = concepts.find((c) => c.conceptId === cid);
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
        card: pickVariation(concept),
        options: shuffle([targetOption, ...distractorOptions]),
      });
    }
  }
  return shuffle(tasks);
}

function generateChooseAllTasks(concepts, params) {
  const gridSize   = params.optionCount ?? 6;
  const maxTargets = Math.max(1, Math.floor(gridSize / 2));
  const tasks = [];

  for (const concept of concepts) {
    const targetCards    = concept.cards.slice(0, Math.min(concept.cards.length, maxTargets));
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

  return shuffle(tasks);
}

export function generateTasks(modeType, concepts, allCards, params = {}) {
  // Cards tagged with a cardType (e.g. "situation") aren't an ordinary
  // picture/word variation and must never surface as one - strip them from
  // every mode's card pool except the mode built specifically to consume
  // them. A card that never sets cardType passes through unchanged, so this
  // is a no-op for every flashcards topic other than emotions_v2.
  const displayConcepts = concepts.map((c) => {
    const displayCards = c.cards.filter((card) => !card.cardType);
    if (displayCards.length === c.cards.length) return c;
    return { ...c, cards: displayCards, primary: displayCards.find((card) => card.primary) ?? displayCards[0] ?? c.primary };
  });
  switch (modeType) {
    case "intro":                  return generateIntroTasks(displayConcepts);
    case "mirror_draw":            return generateMirrorDrawTasks(displayConcepts);
    case "repeat_draw":            return generateRepeatDrawTasks(displayConcepts);
    case "situation_emotion":      return generateSituationEmotionTasks(displayConcepts, allCards, params);
    case "situation_intro":        return generateSituationIntroTasks(displayConcepts, allCards);
    case "emotion_situation":      return generateEmotionSituationTasks(displayConcepts, allCards, params);
    case "question_answer":        return generateIntroTasks(displayConcepts).map((t) => ({ ...t, type: "question_answer" }));
    case "yes_no":                 return generateYesNoTasks(displayConcepts, params);
    case "find_n":                 return generateFindNTasks(displayConcepts, params);
    case "choose_word_by_picture": return generateChooseWordTasks(displayConcepts, params);
    case "choose_all":             return generateChooseAllTasks(displayConcepts, params);
    default:                       return [];
  }
}
