import { pickDistractorLetters } from "./phoneticDistractors";
import { shuffle } from "@/shared/utils/shuffle";

const OPTION_COUNT = 3;

function buildLetterOptions(targetLetter, letterCase) {
  const distractors = pickDistractorLetters(targetLetter, OPTION_COUNT - 1);
  const cast = (l) => (letterCase === "upper" ? l.toUpperCase() : l);
  const target = { id: targetLetter, letter: cast(targetLetter), isTarget: true };
  const distractorOptions = distractors.map((l) => ({ id: l, letter: cast(l), isTarget: false }));
  return shuffle([target, ...distractorOptions]);
}

function generateEdgeTasks(cards, edge) {
  const field = edge === "first" ? "targetLetterFirst" : "targetLetterLast";
  const type  = edge === "first" ? "first_sound" : "last_sound";
  const tasks = [];
  for (const card of cards) {
    const targetLetter = card[field];
    if (!targetLetter) continue; // например, ваза без targetLetterLast
    tasks.push({
      type,
      taskId: `${type}_${card.id}`,
      word: card.word,
      emoji: card.emoji,
      image: card.image,
      targetLetter,
      options: buildLetterOptions(targetLetter, "upper"),
    });
  }
  return shuffle(tasks);
}

function generatePositionTasks(cards) {
  const tasks = [];
  for (const card of cards) {
    for (const entry of card.positionWords ?? []) {
      tasks.push({
        type: "sound_position",
        taskId: `sound_position_${card.id}_${entry.targetLetter}`,
        word: card.word,
        emoji: card.emoji,
        image: card.image,
        targetLetter: entry.targetLetter.toUpperCase(),
        correctPosition: entry.position,
      });
    }
  }
  return shuffle(tasks);
}

function generateBlankTasks(cards) {
  const tasks = [];
  for (const card of cards) {
    for (const blank of card.blanks ?? []) {
      tasks.push({
        type: "missing_letter",
        taskId: `missing_letter_${card.id}_${blank.blankIndex}`,
        word: card.word,
        emoji: card.emoji,
        image: card.image,
        blankIndex: blank.blankIndex,
        targetLetter: blank.targetLetter,
        options: buildLetterOptions(blank.targetLetter, "lower"),
      });
    }
  }
  return shuffle(tasks);
}

export function generateTasks(modeType, cards) {
  switch (modeType) {
    case "first_sound":    return generateEdgeTasks(cards, "first");
    case "last_sound":     return generateEdgeTasks(cards, "last");
    case "sound_position": return generatePositionTasks(cards);
    case "missing_letter": return generateBlankTasks(cards);
    default: return [];
  }
}
