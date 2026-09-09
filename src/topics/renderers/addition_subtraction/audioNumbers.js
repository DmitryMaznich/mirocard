// Word bank for the spoken-example audio task ("два плюс одиннадцать").
// Recorded once per key (see scripts/generate-addition-subtraction-audio.mjs),
// then concatenated at playback time — no phrase is pre-rendered as a whole,
// so any two-operand example up to AUDIO_MAX_NUMBER can be spoken without
// re-recording anything.
//
// Russian number names are only irregular between 0 and 20 (one word each).
// Above that, every number is just "tens-word" + "ones-word" spoken back to
// back (21 = "двадцать" + "один", 45 = "сорок" + "пять", 100 = "сто" alone) —
// so the bank only needs the teens plus one word per round ten.
export const AUDIO_MAX_NUMBER = 100;

const ONES_WORDS = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEEN_WORDS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS_WORDS = { 20: "двадцать", 30: "тридцать", 40: "сорок", 50: "пятьдесят", 60: "шестьдесят", 70: "семьдесят", 80: "восемьдесят", 90: "девяносто" };

export const NUMBER_WORDS = {
  ...Object.fromEntries(ONES_WORDS.map((word, n) => [n, word])),
  ...Object.fromEntries(TEEN_WORDS.map((word, i) => [10 + i, word])),
  ...Object.fromEntries(Object.entries(TENS_WORDS).map(([n, word]) => [Number(n), word])),
  100: "сто",
};

export const SIGN_WORDS = { add: "плюс", subtract: "минус" };

// Every distinct recorded word, keyed the same way the generator script and
// the audio files on disk are: "n0".."n20", "n30".."n90", "n100", "plus", "minus".
export function audioKeyForNumber(n) {
  return `n${n}`;
}

export const ALL_AUDIO_KEYS = [
  ...Object.keys(NUMBER_WORDS).map((n) => audioKeyForNumber(n)),
  "plus",
  "minus",
];

// Splits a number into the 1-2 recorded words needed to say it aloud.
export function numberToAudioKeys(n) {
  if (n <= 20 || NUMBER_WORDS[n] != null) return [audioKeyForNumber(n)];
  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  const keys = [audioKeyForNumber(tens)];
  if (ones > 0) keys.push(audioKeyForNumber(ones));
  return keys;
}

export function numberToWords(n) {
  return numberToAudioKeys(n).map((key) => NUMBER_WORDS[Number(key.slice(1))]).join(" ");
}

// Ordered list of audio keys for the whole spoken example, e.g.
// start=2, operation="add", delta=11 -> ["n2", "plus", "n11"].
export function taskAudioKeys(task) {
  return [
    ...numberToAudioKeys(task.start),
    task.operation === "subtract" ? "minus" : "plus",
    ...numberToAudioKeys(task.delta),
  ];
}

// Same order as taskAudioKeys, but each entry also says whether it should be
// glued tightly to the previous word (the "ones" half of a tens+ones number,
// e.g. "двадцать"|"четыре" for 24) so playback can trim the gap there — a
// full pause reads as two separate numbers instead of one.
export function taskAudioItems(task) {
  const items = [];
  const pushNumber = (n) => {
    numberToAudioKeys(n).forEach((key, i) => items.push({ key, tight: i > 0 }));
  };
  pushNumber(task.start);
  items.push({ key: task.operation === "subtract" ? "minus" : "plus", tight: false });
  pushNumber(task.delta);
  return items;
}

export function audioKeyUrl(key) {
  return `/audio/addition-subtraction/${key}.mp3`;
}
