export function generateTasks(mode, cards, _sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const letters  = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);

  if (mode?.type === "screen_write") return screenWriteTasks(letters, sessionParams);
  if (mode?.type === "fix_letter") return fixLetterTasks(letters, sessionParams);

  return [{
    type: "constructor",
    letters,
  }];
}

// «Пишу на экране»: every chosen letter `copies` times in a row (one letter at a time — the child
// meets the same letter until it is done), letters in the order of the deck (by family). The set is the
// lesson (`finite`): after its last letter the summary shows «Мои буквы». Every independently written
// letter is a right answer in the usual star series, a copy with help is «assisted»; the adult can also
// switch on «Видео в конце занятия» (ParamsScreen).
export function screenWriteTasks(letters, params = {}) {
  const chosen = Array.isArray(params.letters) && params.letters.length ? new Set(params.letters) : null;
  const pool = letters.filter((c) => (chosen ? chosen.has(c.id) : true));
  const list = pool.length ? pool : letters.slice(0, 1);
  const copies = Math.max(1, Math.min(10, Number(params.copies ?? 3) || 3));
  // «Смотрю» is gone (owner, 2026-11-04: the sample card shows the letter on every screen); a saved
  // «watch» becomes «Обвожу»
  const level = ["trace", "free"].includes(params.level) ? params.level : "trace";
  const tasks = [];
  for (const c of list) {
    for (let k = 0; k < copies; k++) {
      tasks.push({
        type: "pl_screen_write",
        id: `${c.id}:${k}`,
        conceptId: c.id,
        card: { id: c.id, label: c.label ?? c.id, viewBox: c.viewBox, strokes: c.strokes },
        level,
        width: ["wide", "mid", "narrow"].includes(params.width) ? params.width : "wide",
        sound: params.sound !== false,
        frame: params.frame !== false,
        guides: params.guides !== false,
        copy: k,
        copies,
      });
    }
  }
  // under the board: the letters you go back / on to (the set ends after its last letter)
  tasks.forEach((t, i) => {
    t.prevLabel = i > 0 ? tasks[i - 1].card.label : null;
    t.nextLabel = i + 1 < tasks.length ? tasks[i + 1].card.label : null;
  });
  return tasks;
}

// «Почини букву»: a card for every letter of the deck, in random order (owner, 2026-11-05: «можно убрать
// выбор букв, это же игра. И показывать карточки в случайном порядке»); the session goes round them like
// any game of cards — a fixed letter is a right answer in the usual star series, a letter fixed after the
// idle prompt is «с помощью». How the letter breaks is decided on the screen (fixLetter/breakLetter.js).
export function fixLetterTasks(letters, params = {}, rand = Math.random) {
  const list = letters.slice();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  // one setting for the adult (owner, 2026-11-04: «нереальное количество настроек… не стоит столько»):
  // «Легко» — one part shifted; «Средне» — two, one may be tilted; «Трудно» — all, a tilt and a mirrored
  // half-oval may come. The magnet is always the strong one, the sample is always in the corner, the
  // sound follows the app's sound switch.
  const level = ["easy", "mid", "hard"].includes(params.level) ? params.level : "easy";
  const LEVELS = {
    easy: { broken: 1, tilt: false, mirror: false },
    mid: { broken: 2, tilt: true, mirror: false },
    hard: { broken: "all", tilt: true, mirror: true },
  };
  const tasks = list.map((c) => ({
    type: "pl_fix_letter",
    id: `fix:${c.id}`,
    conceptId: c.id,
    card: { id: c.id, label: c.label ?? c.id, viewBox: c.viewBox, strokes: c.strokes },
    level,
    ...LEVELS[level],
    frame: params.frame !== false,
    guides: params.guides !== false,
  }));
  tasks.forEach((t, i) => {
    t.prevLabel = tasks.length > 1 ? tasks[(i - 1 + tasks.length) % tasks.length].card.label : null;
    t.nextLabel = tasks.length > 1 ? tasks[(i + 1) % tasks.length].card.label : null;
  });
  return tasks;
}
