import { SHAPE_KINDS, SHAPE_TITLES, PRACTICE_SETS } from './firstLines/shapes.js';
// Lesson data is delivered by the topic ZIP, never imported by the app engine.
export function generateTasks(mode, cards, _sessionSize, params = {}) {
  if (mode?.type === 'drawing_first_lines') {
    const card = (Array.isArray(cards) ? cards : []).find(card => card.firstLines?.kind === 'short_line');
    if (!card) return [];
    // App and downloaded topic update separately. An older ZIP must keep tasks it can render.
    if (!mode.params?.practiceSet) {
      const supported = mode.params?.exercises?.values?.filter(kind => SHAPE_KINDS.includes(kind)) ?? ['short_line'];
      const requested = Array.isArray(params.exercises) ? params.exercises : ['short_line'];
      const selected = requested.length ? supported.filter(kind => requested.includes(kind)) : supported;
      const kinds = selected.length ? selected : ['short_line'];
      return Array.from({ length: 15 }, (_, index) => ({
        type: 'drawing_first_line', id: `first_lines:${index}`, cardId: card.id, conceptId: card.conceptId, number: index + 1,
        exerciseKind: kinds[index % kinds.length], title: SHAPE_TITLES[kinds[index % kinds.length]],
        sheetPage: Math.floor(index / 4), sheetSlot: index % 4,
        sheetKinds: Array.from({ length: Math.min(4, 15 - Math.floor(index / 4) * 4) }, (_, slot) => kinds[(Math.floor(index / 4) * 4 + slot) % kinds.length]),
        breakBefore: index > 0 && index % (params.workSurface === 'sheet' ? 4 : 5) === 0,
      }));
    }
    // An explicit focused selection is optional. The normal lesson uses a shuffled bag.
    const requested = params.preciseSelection && Array.isArray(params.exercises) ? params.exercises : null;
    const pool = requested ? (requested.length ? SHAPE_KINDS.filter(kind => requested.includes(kind)) : SHAPE_KINDS)
      : PRACTICE_SETS[params.practiceSet] ?? PRACTICE_SETS.mixed;
    const kinds = pool.length ? pool : PRACTICE_SETS.mixed;
    let bag = [], previous = null;
    const nextKind = () => {
      if (!bag.length) {
        bag = [...kinds];
        for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
        if (bag.length > 1 && bag.at(-1) === previous) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      }
      previous = bag.pop(); return previous;
    };
    const tasks = Array.from({ length: 15 }, (_, index) => {
      const exerciseKind = nextKind();
      // Generated once and stored with the session. Reload/rotation never rerolls a figure.
      const scale = Math.round((.62 + Math.random() * .43) * 100) / 100;
      const angle = ['arc', 'semicircle', 'wave', 'zigzag', 'zigzag_arc', 'arc_zigzag', 'zigzag_arc_zigzag'].includes(exerciseKind) ? [0, 90, 180, -90][Math.floor(Math.random() * 4)]
        : ['short_line','vertical_line','diagonal_up','diagonal_down','tilted_oval','rhombus'].includes(exerciseKind) ? Math.round((Math.random() - .5) * 30) : 0;
      return { type: 'drawing_first_line', id: `first_lines:${index}`, cardId: card.id, conceptId: card.conceptId, number: index + 1,
        exerciseKind, title: SHAPE_TITLES[exerciseKind], variant: { scale, angle: angle || 0, aspect: ['oval','tilted_oval','rectangle'].includes(exerciseKind) ? Math.round((.9 + Math.random() * .18) * 100) / 100 : 1 },
        sheetPage: Math.floor(index / 4), sheetSlot: index % 4,
        breakBefore: index > 0 && index % (params.workSurface === 'sheet' ? 4 : 5) === 0 };
    });
    return tasks.map((task, index) => ({ ...task, sheetKinds: tasks.slice(Math.floor(index / 4) * 4, Math.floor(index / 4) * 4 + 4).map(t => t.exerciseKind) }));
  }
  return (Array.isArray(cards) ? cards : []).filter(card => card.lesson?.steps?.length).map(card => ({
    type: "drawing_lesson",
    id: `drawing:${card.id}`,
    cardId: card.id,
    conceptId: card.conceptId ?? card.id,
    lesson: card.lesson,
  }));
}
