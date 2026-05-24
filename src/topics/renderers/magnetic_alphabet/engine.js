export function generateTasks(mode, topicRecord) {
  const letters = (topicRecord.cards ?? [])
    .filter((c) => c.type === "letter")
    .map((c) => ({ letter: c.id, category: c.category ?? "consonant" }));
  return [{ type: mode?.type ?? "magnetic_free", letters }];
}
