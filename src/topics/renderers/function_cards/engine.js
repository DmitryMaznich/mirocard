// src/topics/renderers/function_cards/engine.js
import { shuffle } from "@/shared/utils/shuffle";

function pickDistractors(currentConceptId, concepts, count) {
  const others = concepts.filter(c => c.conceptId !== currentConceptId);
  return shuffle([...others]).slice(0, count);
}

function getToolCard(concept) {
  return (
    concept.cards.find(c => c.type === "tool" && c.primary === true) ??
    concept.cards.find(c => c.type === "tool")
  );
}

function generateChooseActionTasks(concepts) {
  const tasks = [];
  for (const concept of concepts) {
    const toolCard = getToolCard(concept);
    const distractors = pickDistractors(concept.conceptId, concepts, 3);
    const options = shuffle([
      { action: concept.primary.action, conceptId: concept.conceptId, isTarget: true },
      ...distractors.map(d => ({
        action: d.primary.action,
        conceptId: d.conceptId,
        isTarget: false,
      })),
    ]);
    tasks.push({
      type: "choose_action",
      conceptId: concept.conceptId,
      toolCard,
      labelInstrumental: concept.primary.labelInstrumental,
      question: `Что делают ${concept.primary.labelInstrumental}?`,
      feedbackText: `${concept.primary.label} ${concept.primary.action}!`,
      options,
    });
  }
  return shuffle(tasks);
}

function generateSceneFunctionTasks(concepts) {
  const tasks = [];
  for (const concept of concepts) {
    const sceneBefore = concept.cards.find(c => c.type === "scene_before");
    const sceneAfter  = concept.cards.find(c => c.type === "scene_after");
    const toolCard    = getToolCard(concept);
    const distractors = pickDistractors(concept.conceptId, concepts, 3);
    const options = shuffle([
      {
        conceptId: concept.conceptId,
        toolCard,
        label: concept.primary.label,
        isTarget: true,
      },
      ...distractors.map(d => ({
        conceptId: d.conceptId,
        toolCard: getToolCard(d),
        label: d.primary.label,
        isTarget: false,
      })),
    ]);
    tasks.push({
      type: "scene_function",
      conceptId: concept.conceptId,
      sceneBefore,
      sceneAfter,
      feedbackText: `${concept.primary.label} ${concept.primary.action}!`,
      options,
    });
  }
  return shuffle(tasks);
}

export function generateTasks(modeType, concepts, allCards, params = {}) {
  switch (modeType) {
    case "choose_action":  return generateChooseActionTasks(concepts);
    case "scene_function": return generateSceneFunctionTasks(concepts);
    default:               return [];
  }
}
