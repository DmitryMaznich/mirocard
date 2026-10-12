// Spoken number names for «Названия чисел» (NumberNamesTask). Recorded once per
// word in the owner's voice (scripts/generate-place-value-numbers-elevenlabs.mjs):
// 0–19, the round tens, the round hundreds and «тысяча». Any number up to 999
// is its words played back to back (347 = «триста» + «сорок» + «семь»).
const ONES = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

export const NUMBER_AUDIO_WORDS = {
  ...Object.fromEntries(ONES.map((w, n) => [n, w])),
  ...Object.fromEntries(TEENS.map((w, i) => [10 + i, w])),
  ...Object.fromEntries(TENS.map((w, t) => [t * 10, w]).filter(([, w]) => w)),
  ...Object.fromEntries(HUNDREDS.map((w, h) => [h * 100, w]).filter(([, w]) => w)),
  1000: "тысяча",
};

// The recorded words that make up `n` (0..1000).
export function numberAudioParts(n) {
  if (NUMBER_AUDIO_WORDS[n] !== undefined) return [n];
  const parts = [];
  const h = Math.floor(n / 100) * 100, rest = n % 100;
  if (h) parts.push(h);
  if (rest >= 10 && rest < 20) parts.push(rest);
  else {
    if (rest >= 20) parts.push(Math.floor(rest / 10) * 10);
    if (rest % 10) parts.push(rest % 10);
  }
  return parts;
}

export const numberAudioUrl = (part) => `/audio/place-value-numbers/n${part}.mp3`;

// Plays the words of `n` one after another; resolves when done (or on error).
// Returns a stop() so a new tap can cut the previous playback short.
export function playNumber(n) {
  let stopped = false, current = null;
  const urls = numberAudioParts(n).map(numberAudioUrl);
  const run = (async () => {
    for (const url of urls) {
      if (stopped) return;
      current = new Audio(url);
      await new Promise((resolve) => {
        current.onended = resolve;
        current.onerror = resolve;
        // play() rejects when autoplay is blocked; jsdom has no playback at all.
        try { const started = current.play(); if (started?.catch) started.catch(resolve); else resolve(); } catch { resolve(); }
      });
    }
  })();
  return { done: run, stop: () => { stopped = true; current?.pause(); } };
}
