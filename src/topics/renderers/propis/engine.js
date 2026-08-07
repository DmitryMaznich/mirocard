export function generateTasks(mode, cards) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const withStrokes = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);
  const letters = withStrokes.filter((c) => c.type === "letter");
  const connectors = withStrokes.filter((c) => c.type === "connector");

  if (mode.type === "practice") {
    return [{ type: "practice", items: letters }];
  }

  if (mode.type === "show") {
    return [{ type: "show", items: letters }];
  }

  if (mode.type === "write_words") {
    return [{ type: "write_words", letters, connectors }];
  }

  return [];
}
