export function generateTasks(mode, cards) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const letters  = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);

  return [{
    type: "constructor",
    letters,
  }];
}
