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
// meets the same letter until it is done), letters in the order of the deck (by family).
export function screenWriteTasks(letters, params = {}) {
  const chosen = Array.isArray(params.letters) && params.letters.length ? new Set(params.letters) : null;
  const pool = letters.filter((c) => (chosen ? chosen.has(c.id) : true));
  const list = pool.length ? pool : letters.slice(0, 1);
  const copies = Math.max(1, Math.min(10, Number(params.copies ?? 3) || 3));
  const level = ["watch", "trace", "free"].includes(params.level) ? params.level : "trace";
  const tasks = [];
  for (const c of list) {
    for (let k = 0; k < (level === "watch" ? 1 : copies); k++) {
      tasks.push({
        type: "pl_screen_write",
        id: `${c.id}:${k}`,
        conceptId: c.id,
        card: { id: c.id, label: c.label ?? c.id, viewBox: c.viewBox, strokes: c.strokes },
        level,
        width: ["wide", "mid", "narrow"].includes(params.width) ? params.width : "wide",
        hidden: params.hidden === true,
        lefty: params.lefty === true,
        sound: params.sound !== false,
        copy: k,
        copies,
      });
    }
  }
  return tasks;
}
