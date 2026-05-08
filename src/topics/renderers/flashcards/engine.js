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

function generateYesNoTasks(concepts, params) {
  const reps = params.repsPerConcept ?? 1;
  const tasks = [];
  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      const useCorrect = Math.random() < 0.5;
      let displayLabel;
      if (useCorrect) {
        displayLabel = concept.primary?.label ?? concept.conceptId;
      } else {
        const others = concepts.filter((c) => c.conceptId !== concept.conceptId);
        const distractor = others[Math.floor(Math.random() * others.length)];
        displayLabel = distractor?.primary?.label ?? concept.primary?.label;
      }
      tasks.push({
        type: "yes_no",
        conceptId: concept.conceptId,
        card: pickVariation(concept),
        displayLabel,
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
  switch (modeType) {
    case "intro":                  return generateIntroTasks(concepts);
    case "question_answer":        return generateIntroTasks(concepts).map((t) => ({ ...t, type: "question_answer" }));
    case "yes_no":                 return generateYesNoTasks(concepts, params);
    case "find_n":                 return generateFindNTasks(concepts, params);
    case "choose_word_by_picture": return generateChooseWordTasks(concepts, params);
    case "choose_all":             return generateChooseAllTasks(concepts, params);
    default:                       return [];
  }
}
