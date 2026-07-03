import { shuffle } from "@/shared/utils/shuffle";

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };

function sortByDifficulty(cards) {
  return [...cards].sort(
    (a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 99) - (DIFFICULTY_ORDER[b.difficulty] ?? 99)
  );
}

function pickDistractors(targetId, cards, count) {
  return shuffle(cards.filter(c => c.id !== targetId)).slice(0, count);
}

function filterByCategory(cards, category) {
  if (!category || category === "all") return cards;
  return cards.filter(c => c.category === category);
}

function generatePairIntroTasks(cards, params) {
  const filtered = filterByCategory(cards, params.category);
  const active   = filtered.length > 0 ? filtered : cards;
  return [{
    type:         "pair_intro",
    cards:        sortByDifficulty(active),
    vesselImage:  active[0]?.vesselImage  ?? "media/pot.webp",
    questionText: active[0]?.questionText ?? "Какой суп?",
    params,
  }];
}

function generateFormItTasks(cards, params) {
  const optionCount   = params.optionCount ?? 4;
  const stimulusParam = params.stimulus ?? "mixed";

  const stimuli = shuffle(
    cards.map((_, i) =>
      stimulusParam === "mixed"
        ? (i % 2 === 0 ? "phrase" : "image")
        : stimulusParam
    )
  );

  return shuffle(
    cards.map((card, i) => {
      const distractors = pickDistractors(card.id, cards, Math.min(optionCount - 1, cards.length - 1));
      const options = shuffle([
        { adjPhrase: card.adjPhrase, isTarget: true },
        ...distractors.map(d => ({ adjPhrase: d.adjPhrase, isTarget: false })),
      ]);
      return {
        type:             "form_it",
        conceptId:        card.id,
        difficulty:       card.difficulty,
        stimulus:         stimuli[i],
        stimulusImage:    card.image,
        stimulusText:     card.nounPhrase,
        stimulusAudio:    card.audioNounPhrase,
        correctAdjPhrase: card.adjPhrase,
        correctAudio:     card.audioAdjPhrase,
        options,
      };
    })
  );
}

function generateYesNoTasks(cards, params) {
  const reps  = params.repsPerConcept ?? 1;
  const tasks = [];

  for (const card of cards) {
    for (let i = 0; i < reps; i++) {
      const isCorrect = Math.random() < 0.6;
      let displayPhrase;
      if (isCorrect) {
        displayPhrase = card.adjPhrase;
      } else {
        const distractor = shuffle(cards.filter(c => c.id !== card.id))[0];
        displayPhrase = distractor?.adjPhrase ?? card.adjPhrase;
      }
      tasks.push({
        type:          "yes_no",
        conceptId:     card.id,
        image:         card.image,
        displayPhrase,
        isCorrect:     displayPhrase === card.adjPhrase,
        correctAudio:  card.audioAdjPhrase,
      });
    }
  }

  return shuffle(tasks);
}

function generateQuestionAskTasks(cards) {
  return sortByDifficulty(cards).map(card => ({
    type:             "question_ask",
    conceptId:        card.id,
    difficulty:       card.difficulty,
    stimulusImage:    card.image,
    stimulusText:     card.nounPhrase,
    correctAdjPhrase: card.adjPhrase,
  }));
}

function generatePickFormTasks(cards, params) {
  const filtered = filterByCategory(cards, params.category);
  const active   = filtered.length > 0 ? filtered : cards;
  // One task per card — session engine handles advancement between cards.
  return shuffle(sortByDifficulty(active).map((card) => ({
    type:     "pick_form",
    card,
    allCards: active,
    params,
  })));
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode.type) {
    case "pair_intro":   return generatePairIntroTasks(cards, params);
    case "pick_form":    return generatePickFormTasks(cards, params);
    case "form_it":      return generateFormItTasks(cards, params);
    case "yes_no":       return generateYesNoTasks(cards, params);
    case "question_ask": return generateQuestionAskTasks(cards);
    default:             return [];
  }
}
