// Lesson data is delivered by the topic ZIP, never imported by the app engine.
export function generateTasks(mode, cards) {
  if (mode?.type === 'drawing_first_lines') {
    const card = (Array.isArray(cards) ? cards : []).find(card => card.firstLines?.kind === 'short_line');
    if (!card) return [];
    return Array.from({ length: 15 }, (_, index) => ({
      type: 'drawing_first_line', id: `first_lines:${index}`, cardId: card.id,
      conceptId: card.conceptId, number: index + 1, breakBefore: index === 5 || index === 10,
    }));
  }
  return (Array.isArray(cards) ? cards : []).filter(card => card.lesson?.steps?.length).map(card => ({
    type: "drawing_lesson",
    id: `drawing:${card.id}`,
    cardId: card.id,
    conceptId: card.conceptId ?? card.id,
    lesson: card.lesson,
  }));
}
