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
