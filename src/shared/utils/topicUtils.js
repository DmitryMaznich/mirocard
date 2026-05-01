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
