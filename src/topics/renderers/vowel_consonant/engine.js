export function generateTasks(mode, cards, _sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const letters = allCards
    .filter((c) => c.params?.category)
    .map((c) => ({
      id:       c.id,
      letter:   c.params.letter ?? c.id,
      category: c.params.category,
    }));

  if (mode.type === "sort_letters") {
    const shuffled   = [...letters].sort(() => Math.random() - 0.5);
    const singCheck  = Boolean(sessionParams?.singCheck);
    const hasSign    = letters.some((l) => l.category === "sign");
    const sessionKey = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return shuffled.map((l) => ({
      type:     "sort_letters",
      letter:   l.letter,
      category: l.category,
      singCheck,
      hasSign,
      sessionKey,
    }));
  }
  return [];
}
