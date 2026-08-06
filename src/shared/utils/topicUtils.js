export function deriveConcepts(cards) {
  const map = new Map();
  for (const card of cards) {
    const conceptId = card.conceptId ?? card.id;
    const label     = typeof card.label === "string"
      ? card.label
      : (card.labels?.ru ?? card.labels?.en ?? card.answerKey ?? conceptId);
    const normalized = { ...card, conceptId, label };

    if (!map.has(conceptId)) {
      map.set(conceptId, { conceptId, cards: [], primary: null });
    }
    const concept = map.get(conceptId);
    concept.cards.push(normalized);
    if (card.primary || concept.primary === null) concept.primary = normalized;
  }
  return [...map.values()];
}

// symmetry_draw bundles three unrelated task kinds (mirror, repeat,
// dictation) as one card array with a `taskKind` field per card, one mode
// per kind. Same reasoning as word_agreement below: without this, every
// mode's concept picker would list all three kinds' concepts mixed
// together, and picking concepts for "Симметричный рисунок" would also
// offer repeat/dictation figures that mode never draws.
const TASK_KIND_BY_MODE_TYPE = {
  mirror_draw: "mirror",
  repeat_draw: "repeat",
  graphic_dictation: "dictation",
};

// word_agreement bundles several unrelated skills (case, verb number, verb
// gender, ...) as one big card array with a `skill` field per card, one
// mode per skill. Without this, the concept picker would list every card in
// the whole topic regardless of which mode is open — e.g. picking concepts
// for "Числительное + существительное" would also show all the case/verb
// cards that mode never uses. Every other renderer keeps one card set per
// mode already, so this is a no-op for them.
export function getConceptCards(topicRecord, mode) {
  const cards = topicRecord?.cards ?? [];
  if (topicRecord?.meta?.renderer === "word_agreement" && mode?.type) {
    return cards.filter((c) => c.skill === mode.type);
  }
  const taskKind = mode?.type ? TASK_KIND_BY_MODE_TYPE[mode.type] : undefined;
  if (taskKind) {
    return cards.filter((c) => c.taskKind === taskKind);
  }
  return cards;
}

export function getPrimaryCard(cards, conceptId) {
  return cards.find((c) => c.conceptId === conceptId && c.primary) ?? null;
}

export function pickVariation(concept, excludeCardId = null) {
  const pool =
    concept.cards.length > 1
      ? concept.cards.filter((c) => c.id !== excludeCardId)
      : concept.cards;
  return pool[Math.floor(Math.random() * pool.length)];
}
