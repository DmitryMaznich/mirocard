// «Буквы и звуки» (phonetic_analysis) — docs/letters-and-sounds.md.
// Cards are letters ({ conceptId: "М", letter: "М" }): the adult picks the
// letters the child has learned, every task is built from them. Words with
// pictures come from mode.words (tools/phonetic_analysis/words.json):
//   targets [{ letter, position }] — letters whose SOUND equals the letter here
//   aligned — one letter = one sound, so the sound scheme's cells can show the word
//   only "letter" | "lotto" — usable only for «which letter does it start with»
import { shuffle } from "@/shared/utils/shuffle";
import { pickDistractorLetters } from "./phoneticDistractors";
import { allSyllables, lookalikeSyllables, syllablesOf } from "./syllables";

// The lesson loops until the adult ends it; a long queue keeps the round from
// coming back to the same words soon (the session cycles the queue).
const DEFAULT_COUNT = 40;
const LOTTO_BOARDS = 10;
const LOTTO_SIZE = 9;
// Words that name the same picture: never on one lotto board.
const SAME_PICTURE = [["кот", "кошка"], ["машина", "такси"], ["мяч", "футбол"], ["шуба", "пальто"], ["чай", "чашка"]];

const needMore = (text) => [{ type: "pa_need_more", text }];
const hasPicture = (w) => Boolean(w.image || w.emoji);

// A shuffled cycle of `length`, never the same item twice in a row.
export function cycle(items, length) {
  const out = [];
  while (out.length < length && items.length) {
    let order = shuffle(items);
    if (order.length > 1 && order[0] === out[out.length - 1]) order = [...order.slice(1), order[0]];
    out.push(...order);
  }
  return out.slice(0, length);
}

export function lettersOf(cards) {
  return [...new Set((cards ?? []).map((c) => c?.letter ?? c?.conceptId).filter(Boolean))];
}

// Wrong letters for a tray: one easily confused with the target (б/п, с/ш),
// the rest from the learned letters, then from the whole alphabet.
export function distractors(target, learned, count) {
  const out = [];
  const add = (l) => { if (l && l !== target && !out.includes(l) && out.length < count) out.push(l); };
  pickDistractorLetters(target.toLowerCase(), 3).map((l) => l.toUpperCase()).filter((l) => learned.includes(l)).forEach(add);
  shuffle(learned).forEach(add);
  pickDistractorLetters(target.toLowerCase(), count + 2).map((l) => l.toUpperCase()).forEach(add);
  return out;
}

const targetOf = (word, letter) => word.targets?.find((t) => t.letter === letter);
const indexOf = (word, letter) => word.word.toUpperCase().indexOf(letter);

function schemeTask(step, kind, word, letter, extra = {}) {
  return {
    type: "pa_scheme",
    step,
    kind, // "chip" — where is the sound; "letter" — which letter; "all" — every letter
    conceptId: letter,
    letter,
    word,
    letters: [...word.word.toUpperCase()],
    ...extra,
  };
}

// «Где звук?» → «Начало или конец»: a cell for every sound, all open (owner,
// 2026-11-18: a lone first cell and a bar made it a yes/no guess); the sound is
// the first or the last one — half and half — and the child taps its cell.
function edgeTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && ["start", "end"].includes(targetOf(w, L)?.position)).map((w) => ({ w, L })));
  const starts = pool.filter((p) => targetOf(p.w, p.L).position === "start");
  const ends = pool.filter((p) => targetOf(p.w, p.L).position === "end");
  if (!starts.length && !ends.length) return needMore("Нет слов, где выбранные буквы в начале или в конце. Добавьте буквы в «Изменить».");
  const half = starts.length && ends.length ? Math.ceil(count / 2) : count;
  return shuffle([...cycle(starts.length ? starts : ends, half), ...cycle(ends.length ? ends : starts, count - half)])
    .map(({ w, L }) => schemeTask(4, "chip", w, L, { layout: "cells", answer: indexOf(w, L) }));
}

// «Буквы в клетки» → «Последняя буква»: the last cell only.
function lastLetterTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && targetOf(w, L)?.position === "end").map((w) => ({ w, L })));
  if (!pool.length) return needMore("Нет слов, которые кончаются на выбранные буквы. Добавьте буквы в «Изменить».");
  return cycle(pool, count).map(({ w, L }) => schemeTask(3, "letter", w, L, {
    layout: "cells", answer: w.word.length - 1, closed: "inner", tray: shuffle([L, ...distractors(L, learned, 2)]),
  }));
}

// «Где звук?» → «Везде»: chip, any cell; half of the words have the sound inside.
function whereTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && targetOf(w, L)).map((w) => ({ w, L })));
  if (!pool.length) return needMore("Нет слов с выбранными буквами. Добавьте буквы в «Изменить».");
  const middle = pool.filter((p) => targetOf(p.w, p.L).position === "middle");
  const edge = pool.filter((p) => targetOf(p.w, p.L).position !== "middle");
  const half = middle.length ? Math.ceil(count / 2) : 0;
  const chosen = shuffle([...cycle(middle, half), ...cycle(edge.length ? edge : middle, count - half)]);
  return chosen.map(({ w, L }) => schemeTask(5, "chip", w, L, { layout: "cells", answer: indexOf(w, L) }));
}

// «Буквы в клетки» → «Всё слово»: short words made only of learned letters.
function allLettersTasks(words, learned, count) {
  const pool = words.filter((w) => w.aligned && w.word.length <= 5 && [...w.word.toUpperCase()].every((c) => learned.includes(c)));
  if (!pool.length) return needMore("Нет коротких слов только из выбранных букв. Добавьте буквы в «Изменить».");
  return cycle(pool, count).map((w) => {
    const letters = [...w.word.toUpperCase()];
    const extra = distractors(letters[0], learned, 4).filter((l) => !letters.includes(l)).slice(0, 2);
    return schemeTask(6, "all", w, letters[0], { layout: "cells", tray: shuffle([...letters, ...extra]) });
  });
}

// Lotto, like the board game (owner, 2026-11-18): a 3×3 board of pictures and
// a card for every picture — the board closes completely. The pictures are spread
// over the learned letters in turn, so with few letters a letter repeats (two
// «М» cards, two pictures on М — any «М» fits either, the check is the first letter).
export function lottoBoard(words, learned) {
  const byLetter = new Map();
  for (const w of shuffle(words)) if (learned.includes(w.firstLetter)) byLetter.set(w.firstLetter, [...(byLetter.get(w.firstLetter) ?? []), w]);
  const letters = shuffle([...byLetter.keys()]);
  if (letters.length < 2) return null;
  const clash = (a, b) => SAME_PICTURE.some((g) => g.includes(a.word) && g.includes(b.word));
  const board = [];
  for (let round = 0; board.length < LOTTO_SIZE; round += 1) {
    let added = false;
    for (const L of letters) {
      if (board.length === LOTTO_SIZE) break;
      const w = byLetter.get(L).find((c) => !board.some((b) => b.id === c.id || clash(b, c)));
      if (w) { board.push(w); added = true; }
    }
    if (!added) break;
  }
  const pairs = board.map((w) => ({ letter: w.firstLetter, wordId: w.id }));
  return { board: shuffle(board), cards: shuffle(board.map((w) => w.firstLetter)), pairs };
}

// «Картинки на буквы» — the same board turned round: 9 letter squares (one per
// picture, so a letter may repeat) and the 9 pictures to put on them.
export function reverseLottoBoard(words, learned) {
  const b = lottoBoard(words, learned);
  if (!b) return null;
  return { letters: shuffle(b.board.map((w) => w.firstLetter)), pictures: shuffle(b.board), pairs: b.pairs };
}

function lottoTasks(words, learned, direction) {
  const reverse = direction === "pictures";
  const boards = [];
  for (let i = 0; i < LOTTO_BOARDS; i += 1) {
    const b = reverse ? reverseLottoBoard(words, learned) : lottoBoard(words, learned);
    if (b) boards.push({ type: reverse ? "pa_lotto_reverse" : "pa_lotto", conceptId: b.pairs[0].letter, ...b });
  }
  return boards.length ? boards : needMore("Для лото нужно хотя бы 2 буквы. Добавьте буквы в «Изменить».");
}

// What a «Найди…» / «Что пропало?» task is made of: the learned letters, or the
// syllables built from them (syllables.js) — «Что искать: Буквы / Слоги».
function unitsOf(learned, unit) {
  return unit === "syllables" ? syllablesOf(learned) : learned;
}
const NEED_SYLLABLES = "Для слогов нужна хотя бы одна согласная и одна гласная. Добавьте буквы в «Изменить».";

// Wrong options close to the target: for a letter — easily confused letters, for a
// syllable — its reversal, the same consonant or the same vowel (lookalikeSyllables).
function lookalikes(target, learned, count) {
  return target.length > 1 ? lookalikeSyllables(target, learned, count) : distractors(target, learned, count);
}
// Wrong options unlike the target («Легко»): for a syllable, no shared letter.
function unlike(target, units, count) {
  const far = (u) => u !== target && ![...u].some((ch) => target.includes(ch));
  const pool = shuffle(units.filter(far));
  const extra = target.length > 1 ? shuffle(allSyllables().filter(far)) : shuffle("АМСОУХШЛНК".split("").filter(far));
  return [...pool, ...extra].filter((u, i, a) => a.indexOf(u) === i).slice(0, count);
}

// «Найди букву»: the letter (or syllable) is shown, find it — «Легко» among 3 unlike,
// «Средне» among 6 with lookalikes, «Трудно» every copy on a field (the former mode
// «Найди все», merged in as a level by the owner, 2026-11-18).
function findLetterTasks(learned, count, difficulty, unit) {
  const units = unitsOf(learned, unit);
  if (!units.length) return needMore(NEED_SYLLABLES);
  if (difficulty === "hard") return findAllTasks(units, learned, count);
  const medium = difficulty === "medium";
  return cycle(units, count).map((L) => ({
    type: "pa_find_letter", conceptId: L, letter: L,
    options: shuffle([L, ...(medium ? lookalikes(L, learned, 5) : unlike(L, units, 2))]),
  }));
}

// «Найди все»: a field (5×5 letters, 4×4 syllables), find every copy.
function findAllTasks(units, learned, count) {
  return cycle(units, Math.min(count, 15)).map((L) => {
    const syllable = L.length > 1;
    const size = syllable ? 16 : 25;
    const n = (syllable ? 3 : 4) + Math.floor(Math.random() * 2);
    const others = lookalikes(L, learned, 4);
    const field = shuffle([...Array(n).fill(L), ...Array.from({ length: size - n }, (_, i) => others[i % others.length])]);
    return { type: "pa_find_all", conceptId: L, letter: L, field, total: n, cols: syllable ? 4 : 5 };
  });
}

// «Что пропало?» (owner, 2026-11-19): a row of 3, 4 or 5 cards to look at, they turn over,
// one is gone — pick it among 3 options (it and two lookalikes not in the row).
const MISSING_SIZE = { easy: 3, medium: 4, hard: 5 };
function missingTasks(learned, count, difficulty, unit) {
  const units = unitsOf(learned, unit);
  if (unit === "syllables" && !units.length) return needMore(NEED_SYLLABLES);
  if (units.length < 3) return needMore("Для «Что пропало?» нужно хотя бы 3 разных карточки. Добавьте буквы в «Изменить».");
  const n = Math.min(MISSING_SIZE[difficulty] ?? 3, units.length);
  return cycle(units, count).map((gone) => {
    const row = shuffle([gone, ...shuffle(units.filter((u) => u !== gone)).slice(0, n - 1)]);
    const wrong = lookalikes(gone, learned, 8).filter((u) => !row.includes(u)).slice(0, 2);
    return { type: "pa_missing", conceptId: gone, letter: gone, row, missing: row.indexOf(gone), options: shuffle([gone, ...wrong]) };
  });
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const learned = lettersOf(cards);
  if (!learned.length) return [];
  const count = DEFAULT_COUNT; // a stored «Заданий в занятии» from deck ≤ 2.4 is ignored
  const words = (mode?.words ?? []).filter(hasPicture);
  // The letter's sound (mode.sounds: letter → file) goes with «Где звук?»: it plays
  // before the word, and a tap on the letter in the question repeats it.
  // A letter's or a syllable's recording (mode.sounds / mode.syllableSounds: text → file).
  const voiceOf = (u) => (u?.length > 1 ? mode?.syllableSounds?.[u] : mode?.sounds?.[u]);
  const tasks = build(mode?.type, words, learned, count, params).map((t) => {
    if (t.kind === "chip" || t.type === "pa_find_letter" || t.type === "pa_find_all") return voiceOf(t.letter) ? { ...t, sound: voiceOf(t.letter) } : t;
    if (t.type === "pa_missing") return { ...t, sounds: Object.fromEntries([...t.row, ...t.options].map((u) => [u, voiceOf(u)]).filter(([, f]) => f)) };
    return t;
  });
  const run = Math.random().toString(36).slice(2, 7);
  return tasks.map((t, i) => ({ ...t, taskId: `${t.type}_${run}_${i}` }));
}

function build(type, words, learned, count, params) {
  switch (type) {
    // «Где звук?» (owner, 2026-11-18): one mode, the place set before the lesson.
    case "pa_where":
      // «start»/«end» stored by deck ≤ 2.6 fall back to «Начало или конец»
      return params.position === "all" ? whereTasks(words, learned, count) : edgeTasks(words, learned, count);
    // «Буквы в клетки»: the last letter only, or the whole word.
    case "pa_all_letters":
      return params.scope === "word" ? allLettersTasks(words, learned, count) : lastLetterTasks(words, learned, count);
    case "pa_lotto": return lottoTasks(words, learned, params.direction);
    case "pa_find_letter": return findLetterTasks(learned, count, params.difficulty, params.unit);
    case "pa_missing": return missingTasks(learned, count, params.difficulty, params.unit);
    case "pa_find_all": return findAllTasks(learned, learned, count);
    default: return [];
  }
}
