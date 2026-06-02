export function generateTasks(mode, cards, _sessionSize, _sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  return allCards
    .filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0)
    .map((card) => ({
      type:     mode.type,
      letter:   card.label ?? card.id,
      category: card.category ?? "consonant",
      viewBox:  card.viewBox  ?? "0 0 100 110",
      strokes:  card.strokes,
    }));
}
