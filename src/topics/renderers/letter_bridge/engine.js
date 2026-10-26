// «Учим словенский» — letters of a new script learned through the script the
// child already reads (docs/learn-slovene.md, section 9). Every card is one
// letter pair, `{ conceptId: "S", sl: "S", ru: "С", group: "g2" }`, so the
// adult picks letters with the ordinary concept picker and gets progress dots
// per letter. What only some modes need lives on the mode:
//   mode.twins   { B: "В", … }  the letter a trap is misread as (traps)
//   mode.syllables { KA: "audio/…/ka.mp3" } recorded syllables (syllables)
//   mode.near    { S: "ŠZ", … } easily confused letters (syllables, tiles)
//   mode.words   [{ id, sl, ru, image, audio }] words with a picture (words, build)
import { shuffle } from "@/shared/utils/shuffle";

const DEFAULT_COUNT = 6;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// A shuffled cycle with no item twice in a row.
export function cycle(items, length) {
  const out = [];
  while (out.length < length && items.length) {
    let order = shuffle(items);
    if (order.length > 1 && order[0] === out[out.length - 1]) order = [...order.slice(1), order[0]];
    out.push(...order);
  }
  return out.slice(0, length);
}

const needMore = (text) => [{ type: "lb_need_more", text }];
const lettersOf = (word) => [...word];

// A word can be read once every one of its letters has been picked.
export function readableWords(words, cards) {
  const known = new Set(cards.map((c) => c.sl));
  return (words ?? []).filter((w) => lettersOf(w.sl).every((c) => known.has(c)));
}

function transliterate(text, cards) {
  const map = Object.fromEntries(cards.map((c) => [c.sl, c.ru]));
  return lettersOf(text).map((c) => map[c] ?? c).join("");
}

// «Слоги» by ear: the school voice says a syllable, the child picks it among
// three Slovenian syllables — one with a consonant easily misheard for it (KA /
// GA, from mode.near) and one with another vowel (KA / KO). Only syllables with
// a recording (mode.syllables: { KA: "audio/…/ka.mp3" }) whose letters are all
// picked take part. The Cyrillic spelling (KA = КА) shows after the answer.
function syllableTasks(mode, cards, count) {
  const known = new Map(cards.map((c) => [c.sl, c]));
  const pool = Object.keys(mode.syllables ?? {}).filter((syl) => lettersOf(syl).every((c) => known.has(c)));
  if (pool.length < 3) return needMore("Для слогов нужны согласные K G T D M N S Z L R и гласные A O U I. Добавьте буквы в «Изменить».");
  const inPool = new Set(pool);
  const variant = (syl, i, letters) => shuffle([...letters]).map((n) => syl.slice(0, i) + n + syl.slice(i + 1)).find((v) => v !== syl && inPool.has(v));
  const othersOf = (syl, i) => pool.map((v) => v[i]).filter((c, k, all) => all.indexOf(c) === k);
  return cycle(pool, count).map((syl) => {
    const consonant = variant(syl, 0, mode.near?.[syl[0]] ?? "") ?? variant(syl, 0, othersOf(syl, 0));
    const vowel = variant(syl, 1, mode.near?.[syl[1]] ?? "") ?? variant(syl, 1, othersOf(syl, 1));
    const wrong = [...new Set([consonant, vowel].filter(Boolean))];
    for (const other of shuffle(pool)) {
      if (wrong.length >= 2) break;
      if (other !== syl && !wrong.includes(other)) wrong.push(other);
    }
    const card = known.get(syl[0]);
    return {
      type: "lb_syll",
      conceptId: card.conceptId,
      cardId: card.id,
      syl,
      sound: mode.syllables[syl],
      translit: transliterate(syl, cards),
      options: shuffle([{ text: syl, ok: true }, ...wrong.map((w) => ({ text: w, ok: false }))]),
    };
  });
}

// The Slovenian letter a trap is misread as: B looks like В, so V.
function twinOf(card, mode, letters) {
  const ru = mode.twins?.[card.sl];
  return ru ? letters.find((c) => c.ru === ru) ?? null : null;
}

function listenTask(card, options, runId, block) {
  return { type: "lb_listen", conceptId: card.conceptId, card, runId, block, options: shuffle(options) };
}

// «Учим алфавит»: the whole alphabet, block after block (mode.blocks = the
// letter groups in teaching order). Inside a block the letters come a few at a
// time: each new letter is shown (lb_pair), then checked by ear (lb_listen:
// its sound, pick the Slovenian letter among those seen so far; a trap against
// the letter it is misread as). A block ends with lb_block_end, a screen for the adult: next
// block or finish. The video reward comes for a finished block
// (mode.rewardPerBlock + task.rewardAfter on the block's last check).
export function alphabetTasks(mode, letters, params = {}) {
  const per = [3, 4, 6].includes(Number(params.newPerStep)) ? Number(params.newPerStep) : 3;
  const check = params.check !== "off";
  const blocks = mode.blocks ?? [];
  const start = Math.max(0, blocks.findIndex((b) => b.id === params.startBlock));
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const seen = letters.filter((c) => blocks.slice(0, start).some((b) => b.id === c.group));
  const tasks = [];
  blocks.slice(start).forEach((block, bi) => {
    const blockLetters = shuffle(letters.filter((c) => c.group === block.id));
    if (!blockLetters.length) return;
    for (let i = 0; i < blockLetters.length; i += per) {
      const chunk = blockLetters.slice(i, i + per);
      chunk.forEach((card) => tasks.push({ type: "lb_pair", conceptId: card.conceptId, card, runId, block: block.id }));
      seen.push(...chunk);
      if (!check) continue;
      // The check is by ear: the school voice says the letter's sound, the
      // child picks the Slovenian letter (matching M to M on screen would test
      // nothing). Each new letter twice, never the same twice in a row.
      cycle(chunk, chunk.length * 2).forEach((card) => {
        const twin = twinOf(card, mode, letters);
        if (twin) {
          // A trap is checked against the letter a Russian reader mistakes it
          // for: [p] → P or R (P looks like Р), and back: [r] → R or P.
          tasks.push(listenTask(card, [card, twin], runId, block.id));
          if (seen.includes(twin)) tasks.push(listenTask(twin, [twin, card], runId, block.id));
          return;
        }
        const others = shuffle(seen.filter((c) => c.sl !== card.sl && c.ru !== card.ru)).slice(0, 2);
        tasks.push(listenTask(card, [card, ...others], runId, block.id));
      });
    }
    if (check) {
      // Five stars spread evenly over the block's checks; the last check
      // completes the fifth and earns the video (mode.rewardPerBlock).
      const checks = tasks.filter((t) => t.block === block.id && t.type === "lb_listen");
      checks.forEach((t, i) => {
        const stars = Math.floor(((i + 1) * 5) / checks.length) - Math.floor((i * 5) / checks.length);
        if (stars) t.blockStars = stars;
      });
      tasks[tasks.length - 1].rewardAfter = true;
    }
    const next = blocks.slice(start + bi + 1).find((b) => letters.some((c) => c.group === b.id));
    tasks.push({ type: "lb_block_end", runId, block: block.id, title: block.title, next: next?.title ?? null });
  });
  return tasks;
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const letters = (cards ?? []).filter((c) => c?.sl && c?.ru);
  const count = Number(params.taskCount) || DEFAULT_COUNT;
  if (!letters.length) return [];

  switch (mode?.type) {
    case "lb_alphabet":
      return alphabetTasks(mode, letters, params);

    case "lb_pair":
      // Shuffled each time: a fixed order would be learned instead of the letters.
      return shuffle(letters).map((card) => ({ type: "lb_pair", conceptId: card.conceptId, card }));

    case "lb_find": {
      if (letters.length < 3) return needMore("Для «Найди пару» нужно хотя бы 3 буквы. Добавьте буквы в «Изменить».");
      return cycle(letters, count).map((card) => {
        const dir = params.direction === "mix" ? pick(["sl_ru", "ru_sl"]) : (params.direction === "ru_sl" ? "ru_sl" : "sl_ru");
        const others = shuffle(letters.filter((c) => c.sl !== card.sl && c.ru !== card.ru)).slice(0, 2);
        return { type: "lb_find", conceptId: card.conceptId, card, dir, options: shuffle([card, ...others]) };
      });
    }

    // Only the trap letters. None picked → [] and the session falls back to
    // every card of the topic, so the traps are always there to practise.
    case "lb_trap": {
      const traps = letters.filter((c) => mode.twins?.[c.sl]);
      if (!traps.length) return [];
      return cycle(traps, Math.max(4, count)).map((card) => ({
        type: "lb_trap",
        conceptId: card.conceptId,
        card,
        options: shuffle([{ text: card.ru, ok: true }, { text: mode.twins[card.sl], ok: false }]),
      }));
    }

    case "lb_syll":
      return syllableTasks(mode, letters, count);

    case "lb_word": {
      const words = readableWords(mode.words, letters);
      if (!words.length) return needMore("Пока нет слов из выбранных букв. Добавьте группу 2 в «Изменить».");
      return cycle(words, count).map((word) => {
        const other = shuffle((mode.words ?? []).filter((w) => w.id !== word.id))[0];
        return {
          type: "lb_word",
          conceptId: `word:${word.id}`,
          word,
          translit: word.ru,
          // auto: bright → faint → gone as the word is read alone (the renderer counts).
          hint: ["bright", "faint", "none"].includes(params.hint) ? params.hint : "auto",
          options: shuffle([{ word, ok: true }, ...(other ? [{ word: other, ok: false }] : [])]),
        };
      });
    }

    case "lb_build": {
      const words = readableWords(mode.words, letters).filter((w) => w.sl.length <= 6);
      if (!words.length) return needMore("Пока нет слов из выбранных букв. Добавьте группу 2 в «Изменить».");
      const known = new Set(letters.map((c) => c.sl));
      return cycle(words, Math.min(count, 6)).map((word) => {
        const extra = shuffle([...new Set(lettersOf(word.sl).flatMap((c) => [...(mode.near?.[c] ?? "")]))]
          .filter((c) => known.has(c) && !word.sl.includes(c))).slice(0, 2);
        return { type: "lb_build", conceptId: `word:${word.id}`, word, tiles: shuffle([...lettersOf(word.sl), ...extra]) };
      });
    }

    default:
      return [];
  }
}
