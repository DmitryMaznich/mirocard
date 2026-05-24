export function generateTasks(mode, cards) {
  const letters = (Array.isArray(cards) ? cards : (cards?.cards ?? []))
    .filter((c) => c.type === "letter")
    .map((c) => ({ letter: c.id, category: c.category ?? "consonant" }));
  return [{ type: "magnetic_free", letters }];
}
