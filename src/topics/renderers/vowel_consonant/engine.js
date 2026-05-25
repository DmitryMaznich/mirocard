export function generateTasks(mode, cards) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const letters = allCards
    .filter((c) => c.params?.category)
    .map((c) => ({
      id:       c.id,
      letter:   c.params.letter ?? c.id,
      category: c.params.category,
    }));

  if (mode.type === "sort_letters") {
    const shuffled = [...letters].sort(() => Math.random() - 0.5);
    return [{ type: "sort_letters", letters: shuffled }];
  }
  return [];
}
