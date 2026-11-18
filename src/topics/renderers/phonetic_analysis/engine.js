// «Буквы и звуки» (phonetic_analysis) — docs/letters-and-sounds.md.
// Cards are letters ({ conceptId: "М", letter: "М" }): the adult picks the
// letters the child has learned, every task is built from them. Words with
// pictures come from mode.words (tools/phonetic_analysis/words.json):
//   targets [{ letter, position }] — letters whose SOUND equals the letter here
//   aligned — one letter = one sound, so the sound scheme's cells can show the word
//   only "letter" | "lotto" — usable only for «which letter does it start with»
import { shuffle } from "@/shared/utils/shuffle";
import { pickDistractorLetters } from "./phoneticDistractors";

const DEFAULT_COUNT = 10;
const LOTTO_BOARDS = 3;
const LOTTO_SIZE = 9;
const LOTTO_LETTERS = 4;
// Words that name the same picture: never on one lotto board.
const SAME_PICTURE = [["кот", "кошка"], ["мяч", "футбол"], ["шуба", "пальто"], ["чай", "чашка"]];

const needMore = (text) => [{ type: "pa_need_more", text }];
const hasPicture = (w) => Boolean(w.image || w.emoji);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

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

// Step 1 «Звук в начале?»: a cell and a bar; the chip goes into the cell
// (the sound starts the word) or into the bar (it is further on).
function soundStartTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && targetOf(w, L)).map((w) => ({ w, L, start: targetOf(w, L).position === "start" })));
  const yes = pool.filter((p) => p.start);
  const no = pool.filter((p) => !p.start);
  if (!yes.length || !no.length) return needMore("Для этой ступени нужны слова с выбранными буквами. Добавьте буквы в «Изменить».");
  const half = Math.ceil(count / 2);
  const chosen = shuffle([...cycle(yes, half), ...cycle(no, count - half)]);
  return chosen.map(({ w, L, start }) => schemeTask(1, "chip", w, L, { layout: "bar", answer: start ? 0 : "bar" }));
}

// «Какая картинка на эту букву?»: one letter card and 3 pictures, the card
// goes onto the picture whose word starts with it (owner, 2026-11-18 — the old
// «drag the first letter into the only slot» was a choice of 1 of 3 letters,
// not analysis). Drawn by LottoTask. A tap on a picture says its word; one of
// the other two starts with a letter easily confused with this one (б/п, с/ш).
function letterPicturesTasks(words, learned, count) {
  const byLetter = new Map();
  for (const w of words) byLetter.set(w.firstLetter, [...(byLetter.get(w.firstLetter) ?? []), w]);
  const targets = learned.filter((L) => byLetter.has(L));
  if (!targets.length) return needMore("Нет слов на выбранные буквы. Добавьте буквы в «Изменить».");
  const clash = (a, b) => SAME_PICTURE.some((g) => g.includes(a.word) && g.includes(b.word));
  return cycle(targets, count).map((L) => {
    const right = pick(byLetter.get(L));
    const board = [right];
    const close = pickDistractorLetters(L.toLowerCase(), 3).map((l) => l.toUpperCase());
    const others = [...shuffle(close), ...shuffle([...byLetter.keys()])].filter((l, i, a) => l !== L && byLetter.has(l) && a.indexOf(l) === i);
    for (const l of others) {
      if (board.length === 3) break;
      const w = shuffle(byLetter.get(l)).find((c) => !board.some((b) => b.firstLetter === c.firstLetter || clash(b, c)));
      if (w) board.push(w);
    }
    return { type: "pa_lotto", size: 3, conceptId: L, letter: L, board: shuffle(board), pairs: [{ letter: L, wordId: right.id }] };
  });
}

// Step 3 «Какой буквой кончается?»: the last cell only.
function lastLetterTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && targetOf(w, L)?.position === "end").map((w) => ({ w, L })));
  if (!pool.length) return needMore("Нет слов, которые кончаются на выбранные буквы. Добавьте буквы в «Изменить».");
  return cycle(pool, count).map(({ w, L }) => schemeTask(3, "letter", w, L, {
    layout: "cells", answer: w.word.length - 1, closed: "inner", tray: shuffle([L, ...distractors(L, learned, 2)]),
  }));
}

// Step 4 «Начало или конец?»: chip, inner cells closed.
function startEndTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && ["start", "end"].includes(targetOf(w, L)?.position)).map((w) => ({ w, L })));
  const starts = pool.filter((p) => targetOf(p.w, p.L).position === "start");
  const ends = pool.filter((p) => targetOf(p.w, p.L).position === "end");
  if (!starts.length || !ends.length) return needMore("Для этой ступени нужны слова, где выбранные буквы и в начале, и в конце. Добавьте буквы в «Изменить».");
  const half = Math.ceil(count / 2);
  return shuffle([...cycle(starts, half), ...cycle(ends, count - half)]).map(({ w, L }) => schemeTask(4, "chip", w, L, {
    layout: "cells", answer: indexOf(w, L), closed: "inner",
  }));
}

// Step 5 «Где звук?»: chip, any cell; half of the words have the sound inside.
function whereTasks(words, learned, count) {
  const pool = learned.flatMap((L) => words.filter((w) => w.aligned && targetOf(w, L)).map((w) => ({ w, L })));
  if (!pool.length) return needMore("Нет слов с выбранными буквами. Добавьте буквы в «Изменить».");
  const middle = pool.filter((p) => targetOf(p.w, p.L).position === "middle");
  const edge = pool.filter((p) => targetOf(p.w, p.L).position !== "middle");
  const half = middle.length ? Math.ceil(count / 2) : 0;
  const chosen = shuffle([...cycle(middle, half), ...cycle(edge.length ? edge : middle, count - half)]);
  return chosen.map(({ w, L }) => schemeTask(5, "chip", w, L, { layout: "cells", answer: indexOf(w, L) }));
}

// Step 6 «Все буквы по порядку»: short words made only of learned letters.
function allLettersTasks(words, learned, count) {
  const pool = words.filter((w) => w.aligned && w.word.length <= 5 && [...w.word.toUpperCase()].every((c) => learned.includes(c)));
  if (!pool.length) return needMore("Нет коротких слов только из выбранных букв. Добавьте буквы в «Изменить».");
  return cycle(pool, Math.min(count, 8)).map((w) => {
    const letters = [...w.word.toUpperCase()];
    const extra = distractors(letters[0], learned, 4).filter((l) => !letters.includes(l)).slice(0, 2);
    return schemeTask(6, "all", w, letters[0], { layout: "cells", tray: shuffle([...letters, ...extra]) });
  });
}

// Lotto: a 3×3 board of pictures and 4 letter cards; each letter goes on the
// picture that starts with it. More pictures than letters, so the last card
// can't be placed by elimination.
export function lottoBoard(words, learned) {
  const byLetter = new Map();
  for (const w of words) if (learned.includes(w.firstLetter)) byLetter.set(w.firstLetter, [...(byLetter.get(w.firstLetter) ?? []), w]);
  const letters = shuffle([...byLetter.keys()]).slice(0, LOTTO_LETTERS);
  if (letters.length < 2) return null;
  const clash = (a, b) => SAME_PICTURE.some((g) => g.includes(a.word) && g.includes(b.word));
  const chosen = [];
  const pairs = letters.map((L) => {
    const w = pick(byLetter.get(L));
    chosen.push(w);
    return { letter: L, wordId: w.id };
  });
  const fillers = shuffle(words.filter((w) => !letters.includes(w.firstLetter)));
  for (const w of fillers) {
    if (chosen.length >= LOTTO_SIZE) break;
    if (chosen.some((c) => c.id === w.id || clash(c, w))) continue;
    chosen.push(w);
  }
  return { board: shuffle(chosen), pairs: shuffle(pairs) };
}

function lottoTasks(words, learned) {
  const boards = [];
  for (let i = 0; i < LOTTO_BOARDS; i += 1) {
    const b = lottoBoard(words, learned);
    if (b) boards.push({ type: "pa_lotto", conceptId: b.pairs[0].letter, ...b });
  }
  return boards.length ? boards : needMore("Для лото нужно хотя бы 2 буквы. Добавьте буквы в «Изменить».");
}

// «Найди букву»: the letter is shown, find it — «Легко» among 3 unlike letters,
// «Средне» among 6 with lookalikes, «Трудно» every copy on a 5×5 field (the
// former mode «Найди все», merged in as a level by the owner, 2026-11-18).
function findLetterTasks(learned, count, difficulty) {
  if (difficulty === "hard") return findAllTasks(learned, count);
  const hard = difficulty === "medium";
  return cycle(learned, count).map((L) => {
    const options = shuffle([L, ...(hard
      ? distractors(L, learned, 5)
      : shuffle(learned.filter((l) => l !== L)).concat(shuffle("АМСОУХШЛНК".split("").filter((l) => l !== L))).filter((l, i, a) => a.indexOf(l) === i).slice(0, 2))]);
    return { type: "pa_find_letter", conceptId: L, letter: L, options };
  });
}

// «Найди все»: a 5×5 field, find every copy of the letter.
function findAllTasks(learned, count) {
  return cycle(learned, Math.min(count, 5)).map((L) => {
    const n = 4 + Math.floor(Math.random() * 2);
    const others = distractors(L, learned, 4);
    const field = shuffle([...Array(n).fill(L), ...Array.from({ length: 25 - n }, (_, i) => others[i % others.length])]);
    return { type: "pa_find_all", conceptId: L, letter: L, field, total: n };
  });
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const learned = lettersOf(cards);
  if (!learned.length) return [];
  const count = Number(params.taskCount) || DEFAULT_COUNT;
  const words = (mode?.words ?? []).filter(hasPicture);
  const tasks = build(mode?.type, words, learned, count, params);
  const run = Math.random().toString(36).slice(2, 7);
  return tasks.map((t, i) => ({ ...t, taskId: `${t.type}_${run}_${i}` }));
}

function build(type, words, learned, count, params) {
  switch (type) {
    case "pa_sound_start": return soundStartTasks(words, learned, count);
    case "pa_first_letter": return letterPicturesTasks(words, learned, count);
    case "pa_last_letter": return lastLetterTasks(words, learned, count);
    case "pa_start_end": return startEndTasks(words, learned, count);
    case "pa_where": return whereTasks(words, learned, count);
    case "pa_all_letters": return allLettersTasks(words, learned, count);
    case "pa_lotto": return lottoTasks(words, learned);
    case "pa_find_letter": return findLetterTasks(learned, count, params.difficulty);
    case "pa_find_all": return findAllTasks(learned, count);
    default: return [];
  }
}
