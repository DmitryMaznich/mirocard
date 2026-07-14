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
  if (Array.isArray(category)) {
    if (category.length === 0) return cards;
    return cards.filter(c => category.includes(c.category));
  }
  return cards.filter(c => c.category === category);
}

function isOverview(card) {
  return Array.isArray(card.items) && card.items.length > 0;
}

function generatePairIntroTasks(cards, params) {
  const filtered = filterByCategory(cards, params.category);
  const active   = filtered.length > 0 ? filtered : cards;

  const overviewCards = active.filter(isOverview);
  const regularCards  = active.filter(c => !isOverview(c));

  const tasks = overviewCards.map(card => ({
    type: "season_overview",
    card,
    params,
  }));

  if (regularCards.length > 0) {
    tasks.push({
      type:  "pair_intro",
      cards: sortByDifficulty(regularCards),
      params,
    });
  }

  return tasks;
}

function generateFormItTasks(cards, params) {
  const playable      = cards.filter(c => !isOverview(c));
  const optionCount   = params.optionCount ?? 4;
  const stimulusParam = params.stimulus ?? "mixed";

  const stimuli = shuffle(
    playable.map((_, i) =>
      stimulusParam === "mixed"
        ? (i % 2 === 0 ? "phrase" : "image")
        : stimulusParam
    )
  );

  return shuffle(
    playable.map((card, i) => {
      const distractors = pickDistractors(card.id, playable, Math.min(optionCount - 1, playable.length - 1));
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
  const playable = cards.filter(c => !isOverview(c));
  const reps     = params.repsPerConcept ?? 1;
  const tasks    = [];

  for (const card of playable) {
    for (let i = 0; i < reps; i++) {
      const isCorrect = Math.random() < 0.6;
      let displayPhrase;
      if (isCorrect) {
        displayPhrase = card.adjPhrase;
      } else {
        const distractor = shuffle(playable.filter(c => c.id !== card.id))[0];
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
  const playable = cards.filter(c => !isOverview(c));
  return sortByDifficulty(playable).map(card => ({
    type:             "question_ask",
    conceptId:        card.id,
    difficulty:       card.difficulty,
    stimulusImage:    card.image,
    stimulusText:     card.nounPhrase,
    correctAdjPhrase: card.adjPhrase,
  }));
}

function generateSeasonPickItemsTasks(overviewCards, params = {}) {
  const allItems = overviewCards.flatMap(card =>
    (card.items ?? []).map(it => ({ ...it, _seasonCardId: card.id }))
  );
  return shuffle(overviewCards.map(card => {
    const correct     = shuffle([...(card.items ?? [])]).slice(0, 2);
    const distractors = shuffle(allItems.filter(it => it._seasonCardId !== card.id)).slice(0, 4);
    const chips = shuffle([
      ...correct.map(it    => ({ ...it, isTarget: true  })),
      ...distractors.map(it => ({ ...it, isTarget: false })),
    ]);
    return { type: "season_pick_items", card, chips, params };
  }));
}

function generatePickFormTasks(cards, params) {
  const filtered = filterByCategory(cards, params.category);
  const active   = filtered.length > 0 ? filtered : cards;
  const overviewCards = active.filter(isOverview);
  const playable      = active.filter(c => !isOverview(c));
  return [
    ...(overviewCards.length > 0 ? generateSeasonPickItemsTasks(overviewCards, params) : []),
    ...shuffle(sortByDifficulty(playable).map((card) => ({
      type:     "pick_form",
      card,
      allCards: playable,
      params,
    }))),
  ];
}

function generateSeasonFormPickTasks(cards, params) {
  const tasks = [];
  for (const card of cards.filter(isOverview)) {
    for (const item of (card.items ?? [])) {
      tasks.push({ type: "season_form_pick", card, item, params });
    }
  }
  return shuffle(tasks);
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode.type) {
    case "pair_intro":        return generatePairIntroTasks(cards, params);
    case "pick_form":         return generatePickFormTasks(cards, params);
    case "form_it":           return generateFormItTasks(cards, params);
    case "yes_no":            return generateYesNoTasks(cards, params);
    case "question_ask":      return generateQuestionAskTasks(cards);
    case "season_form_pick":  return generateSeasonFormPickTasks(cards, params);
    default:                  return [];
  }
}
