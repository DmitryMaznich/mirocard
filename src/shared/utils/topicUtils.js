export function deriveConcepts(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.conceptId)) {
      map.set(card.conceptId, { conceptId: card.conceptId, cards: [], primary: null });
    }
    const concept = map.get(card.conceptId);
    concept.cards.push(card);
    if (card.primary) concept.primary = card;
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
