// src/topics/renderers/function_cards/engine.js
import { shuffle } from "@/shared/utils/shuffle";
import { generateTasks as flashcardsGenerateTasks } from "../flashcards/engine";

// Concepts filtered to tool-image cards only (no scene_before / scene_after)
function toolOnlyConcepts(concepts) {
  return concepts.map((c) => ({
    ...c,
    cards: c.cards.filter((card) => card.type === "tool" || !card.type),
  }));
}

function pickDistractors(currentConceptId, concepts, count) {
  const others = concepts.filter(c => c.conceptId !== currentConceptId);
  return shuffle([...others]).slice(0, count);
}

function getToolCard(concept) {
  const card =
    concept.cards.find(c => c.type === "tool" && c.primary === true) ??
    concept.cards.find(c => c.type === "tool");
  if (!card) throw new Error(`function_cards: concept "${concept.conceptId}" has no tool card`);
  return card;
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
      question: concept.primary.sceneQuestion ?? null,
      feedbackText: `${concept.primary.label} ${concept.primary.action}!`,
      options,
    });
  }
  return shuffle(tasks);
}

// allCards satisfies the shared generateTasks interface but is not needed here.
// params is accepted for interface compatibility.
export function generateTasks(modeType, concepts, allCards, params = {}) {  // eslint-disable-line no-unused-vars
  switch (modeType) {
    case "choose_action":  return generateChooseActionTasks(concepts);
    case "scene_function": return generateSceneFunctionTasks(concepts);
    default:               return flashcardsGenerateTasks(modeType, toolOnlyConcepts(concepts), allCards, params);
  }
}
