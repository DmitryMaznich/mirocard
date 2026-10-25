// «Учим словенский» — letters of a new script learned through the script the
// child already reads (docs/learn-slovene.md, section 9). Every card is one
// letter pair, `{ conceptId: "S", sl: "S", ru: "С", group: "g2" }`, so the
// adult picks letters with the ordinary concept picker and gets progress dots
// per letter. What only some modes need lives on the mode:
//   mode.twins   { B: "В", … }  the letter a trap is misread as (traps)
//   mode.vowels  ["A", …]       vowels of the new script (syllables)
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

function syllableTasks(mode, cards, count) {
  const vowels = new Set(mode.vowels ?? []);
  const known = new Set(cards.map((c) => c.sl));
  // J+vowel reads as one Russian letter (JA = Я): left out of plain syllables.
  const consonants = cards.filter((c) => !vowels.has(c.sl) && c.sl !== "J");
  const vowelList = [...vowels].filter((v) => known.has(v));
  if (!consonants.length || !vowelList.length) return needMore("Для слогов нужны и гласные, и согласные. Добавьте буквы в «Изменить».");
  const all = consonants.flatMap((c) => vowelList.map((v) => ({ syl: c.sl + v, consonant: c })));
  return cycle(all, count).map(({ syl, consonant }) => {
    const variants = new Set();
    lettersOf(syl).forEach((ch, i) => {
      for (const n of mode.near?.[ch] ?? "") if (known.has(n)) variants.add(syl.slice(0, i) + n + syl.slice(i + 1));
    });
    const wrong = shuffle([...variants]).slice(0, 2);
    for (const other of shuffle(all.map((x) => x.syl))) {
      if (wrong.length >= 2) break;
      if (other !== syl && !wrong.includes(other)) wrong.push(other);
    }
    return {
      type: "lb_syll",
      conceptId: consonant.conceptId,
      cardId: consonant.id,
      syl,
      options: shuffle([{ text: transliterate(syl, cards), ok: true }, ...wrong.map((w) => ({ text: transliterate(w, cards), ok: false }))]),
    };
  });
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const letters = (cards ?? []).filter((c) => c?.sl && c?.ru);
  const count = Number(params.taskCount) || DEFAULT_COUNT;
  if (!letters.length) return [];

  switch (mode?.type) {
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
