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

// Whole phrases in the same voice, for «Считаем десятками» (CountTensTask).
// «Десять десятков — это сотня» deliberately has no «сто» in it: «сто десять»
// and «сто десятков» sound almost alike, so the word «сто» is only ever heard
// on its own, when the number 100 appears.
export const PHRASE_AUDIO = {
  full: "Десять десятков! Сложи сотню.",
  fold: "Десять десятков — это сотня.",
  ask: "Сколько стало?",
};
export const phraseAudioUrl = (key) => `/audio/place-value-numbers/p-${key}.mp3`;

// Plays the words of `n` back to back; returns { done, stop }. The clips are
// trimmed of their silence (scripts/trim-place-value-numbers.mjs) and played
// through Web Audio: all parts are fetched and decoded first, then scheduled
// on one clock with a fixed short gap (PART_GAP_SECONDS), not a loading delay, so «восемьдесят»
// + «четыре» sound as one number. Where Web Audio isn't usable (no
// AudioContext, or it stays suspended before a user gesture) the parts are
// preloaded as <audio> elements and chained on «ended».
// A short breath between the words of one number («восемьдесят · четыре»):
// end to end with no gap sounded unnatural (the owner's ear, 2026-10-12).
export const PART_GAP_SECONDS = 0.12;
const buffers = new Map();
let context = null;
function audioContext() {
  const Ctx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  return context;
}
async function decoded(ctx, url) {
  if (!buffers.has(url)) {
    buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((data) => ctx.decodeAudioData(data))
      .catch((err) => { buffers.delete(url); throw err; }));
  }
  return buffers.get(url);
}
async function running(ctx) {
  if (ctx.state === "running") return true;
  try { await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]); } catch { /* fall back */ }
  return ctx.state === "running";
}

export const playNumber = (n) => playUrls(numberAudioParts(n).map(numberAudioUrl));
export const playPhrase = (key) => playUrls([phraseAudioUrl(key)]);

function playUrls(urls) {
  let stopped = false;
  const stops = [];
  const viaWebAudio = async () => {
    const ctx = audioContext();
    if (!ctx || !(await running(ctx))) return false;
    const list = await Promise.all(urls.map((url) => decoded(ctx, url)));
    if (stopped) return true;
    let at = ctx.currentTime + 0.02;
    let last = null;
    for (const buffer of list) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(at);
      at += buffer.duration + PART_GAP_SECONDS;
      stops.push(() => { try { source.stop(); } catch { /* already ended */ } });
      last = source;
    }
    await new Promise((resolve) => { last.onended = resolve; stops.push(resolve); });
    return true;
  };
  const viaElements = async () => {
    const clips = urls.map((url) => { const a = new Audio(url); a.preload = "auto"; return a; });
    for (const [i, clip] of clips.entries()) {
      if (stopped) return;
      if (i) await new Promise((r) => setTimeout(r, PART_GAP_SECONDS * 1000));
      stops.push(() => clip.pause());
      await new Promise((resolve) => {
        clip.onended = resolve;
        clip.onerror = resolve;
        stops.push(resolve);
        // play() rejects when autoplay is blocked; jsdom has no playback at all.
        try { const started = clip.play(); if (started?.catch) started.catch(resolve); else resolve(); } catch { resolve(); }
      });
    }
  };
  const done = viaWebAudio().catch(() => false).then((ok) => (ok || stopped ? undefined : viaElements()));
  return { done, stop: () => { stopped = true; stops.forEach((f) => f()); } };
}
