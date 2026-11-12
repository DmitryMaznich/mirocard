// Every recorded phrase of «Плюс и минус», in the owner's ElevenLabs voice
// (2026-11-11, docs/addition-subtraction-audio-review.md). Shared by the
// voice generator, the pronunciation review playlist and audioPhrases.js.
//
// Modes 2–3 («Что изменилось?», «Назови действие») only ever use quantities
// 1..5 and a change of 1..3 (engine.js: maxNumber is 3 or 5,
// NAME_ACTION_COUNT_MAX = 3), so each sentence with a number in it is
// recorded whole — «Было два, стало три.» — instead of being glued from a
// word «было» and a number clip: a lone word is read as its own sentence
// (the old «Было» came out as «Белла?») and the glue changed voice mid-sentence.
export const VOICE_AUDIO_DIR = "/audio/addition-subtraction-voice";
export const voiceAudioUrl = (key) => `${VOICE_AUDIO_DIR}/${key}.mp3`;

export const PHRASE_MAX_NUMBER = 5;
export const PHRASE_MAX_DELTA = 3;

const WORDS = ["ноль", "один", "два", "три", "четыре", "пять"];

export const wasKey = (n) => `was_${n}`;
export const wasBecameKey = (start, result) => `was_became_${start}_${result}`;
export const correctCountKey = (operation, delta) => `correct_${operation === "add" ? "added" : "removed"}_${delta}`;

// Every start→result pair modes 2–3 can produce.
function changePairs() {
  const pairs = [];
  for (let delta = 1; delta <= PHRASE_MAX_DELTA; delta += 1) {
    for (let start = 1; start + delta <= PHRASE_MAX_NUMBER; start += 1) pairs.push([start, start + delta]);
    for (let start = delta + 1; start <= PHRASE_MAX_NUMBER; start += 1) pairs.push([start, start - delta]);
  }
  return pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const PHRASE_ENTRIES = [
  ...[1, 2, 3, 4, 5].map((n) => ({ key: wasKey(n), text: `Было ${WORDS[n]}.` })),
  { key: "more_or_less", text: "Стало больше или меньше?" },
  { key: "correct_more", text: "Правильно! Стало больше." },
  { key: "correct_less", text: "Правильно! Стало меньше." },
  { key: "wrong_look_again", text: "Неправильно. Посмотри ещё раз." },
  { key: "what_was_done", text: "Что сделали?" },
  { key: "what_was_done_say", text: "Что сделали? Скажи." },
  { key: "how_many_added", text: "Сколько прибавили?" },
  { key: "how_many_removed", text: "Сколько убрали?" },
  { key: "correct_added", text: "Правильно! Прибавили." },
  { key: "correct_removed", text: "Правильно! Убрали." },
  ...[1, 2, 3].map((d) => ({ key: correctCountKey("add", d), text: `Правильно! Прибавили ${WORDS[d]}.` })),
  ...[1, 2, 3].map((d) => ({ key: correctCountKey("subtract", d), text: `Правильно! Убрали ${WORDS[d]}.` })),
  ...changePairs().map(([a, b]) => ({ key: wasBecameKey(a, b), text: `Было ${WORDS[a]}, стало ${WORDS[b]}.` })),
  { key: "look_again", text: "Посмотри ещё раз." },
  { key: "count_again", text: "Посчитай ещё раз." },
];

// «Плюс» / «минус» for «Слушай и посчитай», recorded as single words and
// trimmed like the number clips they are played between.
export const SIGN_ENTRIES = [
  { key: "plus", text: "Плюс." },
  { key: "minus", text: "Минус." },
];

export const RECORDED_PHRASE_KEYS = new Set(PHRASE_ENTRIES.map(({ key }) => key));
