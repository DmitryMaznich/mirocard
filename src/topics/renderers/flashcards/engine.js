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

function generateGraphicDictationTasks(concepts, params) {
  const taskKind = params?.dictationCommand === "coordinates" ? "coordinate" : "dictation";
  return generateIntroTasks(filterByTaskKind(concepts, taskKind)).map((t) => ({ ...t, type: "graphic_dictation" }));
}

// Navigator is deliberately a short, repeating reaction drill instead of a
// finite set of picture cards. The one metadata card keeps it compatible with
// the topic/concept picker; every generated task then carries its own direction.
function generateNavigatorTasks(concepts) {
  const cards = filterByTaskKind(concepts, "navigator");
  const source = cards.flatMap((concept) => concept.cards.filter((card) => card.taskKind === "navigator"));
  const base = source[0];
  if (!base) return [];
  const directions = ["up", "down", "left", "right", "up_left", "up_right", "down_left", "down_right"];
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
          card: targetCard,
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
  }
  return shuffle(tasks);
}

function generateChooseWordTasks(concepts, params) {
  const reps = params.repsPerConcept ?? 1;
  const tasks = [];

  for (const concept of concepts) {
    for (let i = 0; i < reps; i++) {
      // One task per photo variation, not one random pick per rep - see
      // generateFindNTasks for why.
      for (const targetCard of concept.cards) {
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
    case "graphic_dictation":      return generateGraphicDictationTasks(displayConcepts, params);
    case "navigator":              return generateNavigatorTasks(displayConcepts);
    case "coordinates":            return generateCoordinateTasks(displayConcepts);
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
