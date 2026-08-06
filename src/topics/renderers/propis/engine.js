export function generateTasks(mode, cards) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const items = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);

  if (mode.type === "show") {
    return [{ type: "show", items }];
  }

  return [];
}
