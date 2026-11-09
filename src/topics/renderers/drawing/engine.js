// Lesson data is delivered by the topic ZIP, never imported by the app engine.
export function generateTasks(_mode, cards) {
  return (Array.isArray(cards) ? cards : []).filter(card => card.lesson?.steps?.length).map(card => ({
    type: "drawing_lesson",
    id: `drawing:${card.id}`,
    cardId: card.id,
    conceptId: card.conceptId ?? card.id,
    lesson: card.lesson,
  }));
}
