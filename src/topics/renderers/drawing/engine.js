import { SHAPE_KINDS, SHAPE_TITLES } from './firstLines/shapes.js';
// Lesson data is delivered by the topic ZIP, never imported by the app engine.
export function generateTasks(mode, cards, _sessionSize, params = {}) {
  if (mode?.type === 'drawing_first_lines') {
    const card = (Array.isArray(cards) ? cards : []).find(card => card.firstLines?.kind === 'short_line');
    if (!card) return [];
    // Shared enum_multi encodes «Все» as an empty array. Missing params retain the old single-line lesson.
    const requested = Array.isArray(params.exercises) ? params.exercises : ['short_line'];
    const selected = requested.length ? SHAPE_KINDS.filter(kind => requested.includes(kind)) : SHAPE_KINDS;
    const kinds = selected.length ? selected : ['short_line'];
    return Array.from({ length: 15 }, (_, index) => ({
      type: 'drawing_first_line', id: `first_lines:${index}`, cardId: card.id,
      conceptId: card.conceptId, number: index + 1,
      exerciseKind: kinds[index % kinds.length], title: SHAPE_TITLES[kinds[index % kinds.length]],
      sheetPage: Math.floor(index / 4), sheetSlot: index % 4,
      sheetKinds: Array.from({ length: Math.min(4, 15 - Math.floor(index / 4) * 4) }, (_, slot) => kinds[(Math.floor(index / 4) * 4 + slot) % kinds.length]),
      breakBefore: index > 0 && index % (params.workSurface === 'sheet' ? 4 : 5) === 0,
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
