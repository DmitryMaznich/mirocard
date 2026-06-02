export function generateTasks(_mode, _cards, count = 15) {
  const size = Math.max(5, count);
  return Array.from({ length: size }, (_, i) => ({
    type: "streak",
    cardId: `streak_${i % 5}`,
    conceptId: `streak_${i % 5}`,
  }));
}
