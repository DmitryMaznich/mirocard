export function generateTasks(mode, cards, _sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const letters  = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);

  if (mode?.type === "screen_write") return screenWriteTasks(letters, sessionParams);

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
