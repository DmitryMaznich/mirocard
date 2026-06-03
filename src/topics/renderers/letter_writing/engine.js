export function generateTasks(mode, cards, _sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const letters  = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);

  if (mode.type === "worksheet") {
    return [{
      type:              "worksheet",
      letters,
      background:        sessionParams?.background        ?? "lined",
      letterHeightCells: Number(sessionParams?.letterHeightCells ?? 2),
      blankRows:         Number(sessionParams?.blankRows         ?? 1),
    }];
  }

  // Card-by-card modes: letter_demo / letter_follow / letter_trace
  return letters.map((card) => ({
    type:     mode.type,
    letter:   card.label ?? card.id,
    category: card.category ?? "consonant",
    viewBox:  card.viewBox  ?? "0 0 100 110",
    strokes:  card.strokes,
  }));
}
