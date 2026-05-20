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
    const sceneAfterCard = concept.cards.find(c => c.type === "scene_after") ?? null;
    const distractors = pickDistractors(concept.conceptId, concepts, 3);
    const options = shuffle([
      { actionInf: concept.primary.actionInf, conceptId: concept.conceptId, isTarget: true },
      ...distractors.map(d => ({
        actionInf: d.primary.actionInf,
        conceptId: d.conceptId,
        isTarget: false,
      })),
    ]);
    const needsForm = concept.primary.needsForm ?? "";
    const question = needsForm
      ? `Для чего ${needsForm} ${concept.primary.label}?`
      : `Что делают ${concept.primary.labelInstrumental}?`;
    const lInstr = concept.primary.labelInstrumental;
    tasks.push({
      type: "choose_action",
      conceptId: concept.conceptId,
      toolCard,
      sceneAfterCard,
      question,
      questionPrefixAudio: concept.primary.questionPrefixAudio ?? null,
      toolNameAudio: toolCard.audio?.ru ?? null,
      action: concept.primary.action,
      feedbackText: `${lInstr[0].toUpperCase()}${lInstr.slice(1)} ${concept.primary.action}!`,
      options,
    });
  }
  return shuffle(tasks);
}

function generateFunctionIntroTasks(concepts) {
  return concepts.map(concept => {
    const toolCard = getToolCard(concept);
    const sceneAfterCard = concept.cards.find(c => c.type === "scene_after") ?? null;
    const needsForm = concept.primary.needsForm ?? "";
    const question = needsForm
      ? `Для чего ${needsForm} ${concept.primary.label}?`
      : `Что делают ${concept.primary.labelInstrumental}?`;
    return {
      type: "fc_intro",
      conceptId: concept.conceptId,
      toolCard,
      sceneAfterCard,
      label: concept.primary.label,
      question,
      toolNameAudio: toolCard.audio?.ru ?? null,
    };
  });
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
      feedbackText: `${concept.primary.labelInstrumental[0].toUpperCase()}${concept.primary.labelInstrumental.slice(1)} ${concept.primary.action}!`,
      options,
    });
  }
  return shuffle(tasks);
}

// allCards satisfies the shared generateTasks interface but is not needed here.
// params is accepted for interface compatibility.
export function generateTasks(modeType, concepts, allCards, params = {}) {  // eslint-disable-line no-unused-vars
  switch (modeType) {
    case "intro":          return generateFunctionIntroTasks(concepts);
    case "choose_action":  return generateChooseActionTasks(concepts);
    case "scene_function": return generateSceneFunctionTasks(concepts);
    default:               return flashcardsGenerateTasks(modeType, toolOnlyConcepts(concepts), allCards, params);
  }
}
