import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { NUMBER_WORDS } from "../src/topics/renderers/addition_subtraction/audioNumbers.js";
import { PHRASE_ENTRIES, SIGN_ENTRIES } from "../src/topics/renderers/addition_subtraction/audioPhraseBank.js";
import { AUDIO_ENTRIES } from "../src/topics/renderers/daily_orientation/audioBank.js";
import { LETTER_DATA } from "../src/handwriting/letters/letterData.js";
import { letterDictationKey, splitIntoSentences, syllableDictationKey, textSentenceDictationKey, wordDictationKey } from "../src/handwriting/dictationAudio.js";
import { PROPIS_PHONEME_ENTRIES } from "./lib/propis-phoneme-bank.mjs";
import { PROPIS_NATURAL_PILOT } from "./lib/propis-natural-pilot-bank.mjs";
import { PROPIS_ELEVENLABS_ALPHABET, PROPIS_ELEVENLABS_CASE_PILOT, PROPIS_ELEVENLABS_ENTRIES, PROPIS_ELEVENLABS_E_PILOT, PROPIS_ELEVENLABS_WORDS_PILOT } from "./lib/propis-elevenlabs-bank.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const labels = new Map();
const setLabel = (path, label, category) => labels.set(path, { label, category });
for (const { key, text } of PHRASE_ENTRIES) setLabel(`audio/addition-subtraction-voice/${key}.mp3`, text, "Фразы");
for (const { key, text } of SIGN_ENTRIES) setLabel(`audio/addition-subtraction-voice/${key}.mp3`, text.replace(".", ""), "Знаки");
for (const [number, word] of Object.entries(NUMBER_WORDS)) {
  setLabel(`audio/place-value-numbers/n${number}.mp3`, `${number} — ${word}`, "Числа");
}
for (const { key, text } of AUDIO_ENTRIES) setLabel(`audio/daily-orientation/${key}.mp3`, text, "Слова и фразы");
// The dictation recordings: one clip per letter (capital + small; ъ ь have only a small one — the
// recording of capital Ы exists though propis2 never asks for it), then propis2's words and texts.
// Read from propis2 since the old `propis` topic was archived (2026-11-08); its words and texts are
// propis2's except two words, kept below.
const propis = JSON.parse(readFileSync(join(root, "tools/propis2/topic.json"), "utf8"));
const letterCards = LETTER_DATA.flatMap(({ params: p }) => [...(["ъ", "ь"].includes(p.printed_lower) ? [] : [{ label: p.printed_lower.toUpperCase() }]), { label: p.printed_lower }]);
for (const card of letterCards) {
  const key = letterDictationKey(card);
  const label = key === "lo_ъ" ? "Твёрдый знак" : key === "lo_ь" ? "Мягкий знак" : `${key.startsWith("up_") ? "Заглавная" : "Строчная"} ${card.label}`;
  setLabel(`audio/propis-dictation/${key}.mp3`, label, "Буквы");
}
for (const word of propis.words) setLabel(`audio/propis-dictation/${wordDictationKey(word)}.mp3`, word.word, "Слова");
// Recorded for the old topic's dictation, dropped from propis2's bank (silent consonants, owner 2026-10-29):
// the clips are still in public/audio, so they keep their words here.
for (const word of [{ id: "w186", word: "солнце" }, { id: "w223", word: "сердце" }]) setLabel(`audio/propis-dictation/${wordDictationKey(word)}.mp3`, word.word, "Слова");
for (const entry of propis.texts) {
  splitIntoSentences(entry.text).forEach((text, index) => setLabel(`audio/propis-dictation/${textSentenceDictationKey(entry, index)}.mp3`, text, "Предложения"));
}
// «По слогам» (propis2): each syllable with the words it is in
const propis2Words = JSON.parse(readFileSync(join(root, "tools/propis2/topic.json"), "utf8")).words.filter((w) => (w.syllables?.length ?? 0) > 1);
const syllableWords = new Map();
for (const w of propis2Words) for (const syl of w.syllables.map((s) => s.toLowerCase())) syllableWords.set(syl, [...(syllableWords.get(syl) ?? []), w.syllables.join("·")]);
for (const [syl, inWords] of syllableWords) {
  const key = syllableDictationKey(syl);
  const label = `${syl} — ${inWords.slice(0, 4).join(", ")}${inWords.length > 4 ? ` и ещё ${inWords.length - 4}` : ""}`;
  setLabel(`audio/propis-dictation/${key}.mp3`, label, "Слоги");
}
for (const entry of PROPIS_PHONEME_ENTRIES) setLabel(`audio/propis-phoneme-review/${entry.key}.mp3`, entry.label, entry.category);
for (const entry of PROPIS_ELEVENLABS_ENTRIES) {
  setLabel(`audio/propis-elevenlabs-review/${entry.key}.mp3`, `${entry.label} — дубль 1`, entry.category);
  setLabel(`audio/propis-elevenlabs-review/${entry.key}__2.mp3`, `${entry.label} — дубль 2`, entry.category);
}
for (const entry of PROPIS_ELEVENLABS_E_PILOT) {
  setLabel(`audio/propis-elevenlabs-e-pilot/${entry.key}.mp3`, `${entry.label} — дубль 1`, entry.category);
  setLabel(`audio/propis-elevenlabs-e-pilot/${entry.key}__2.mp3`, `${entry.label} — дубль 2`, entry.category);
}
for (const entry of PROPIS_ELEVENLABS_ALPHABET) setLabel(`audio/propis-elevenlabs-alphabet/${entry.key}.mp3`, entry.label, entry.category);
for (const entry of PROPIS_ELEVENLABS_CASE_PILOT) {
  setLabel(`audio/propis-elevenlabs-case-pilot/${entry.key}.mp3`, `${entry.label} — дубль 1`, entry.category);
  setLabel(`audio/propis-elevenlabs-case-pilot/${entry.key}__2.mp3`, `${entry.label} — дубль 2`, entry.category);
}
for (const entry of PROPIS_ELEVENLABS_WORDS_PILOT) {
  setLabel(`audio/propis-elevenlabs-words-pilot/${entry.key}.mp3`, `${entry.label} — дубль 1`, entry.category);
  setLabel(`audio/propis-elevenlabs-words-pilot/${entry.key}__2.mp3`, `${entry.label} — дубль 2`, entry.category);
}
for (const [key, label] of [
  ["lo_zh_name_1", "Строчная «жэ» — дубль 1 (стоит в диктанте)"], ["lo_zh_name_2", "Строчная «жэ» — дубль 2"],
  ["lo_zh_plain_1", "Строчная ж — дубль 1"], ["lo_zh_plain_2", "Строчная ж — дубль 2"],
  ["up_kh_name_1", "Заглавная «ха» — дубль 1 (стоит в диктанте)"], ["up_kh_name_2", "Заглавная «ха» — дубль 2"],
  ["up_kh_plain_1", "Заглавная Х — дубль 1"], ["up_kh_plain_2", "Заглавная Х — дубль 2"],
]) setLabel(`audio/propis-letter-retake/${key}.mp3`, label, key.startsWith("lo_") ? "ж" : "Х");
for (const entry of PROPIS_NATURAL_PILOT) setLabel(`audio/propis-natural-pilot/${entry.key}.wav`, entry.label, entry.category);
const names = {
  "audio/addition-subtraction-voice": "Плюс / минус — фразы и знаки (голос владельца)",
  "audio/place-value-numbers": "Числа (голос владельца; «Разряды числа», «Плюс / минус»)",
  "audio/daily-orientation": "Ориентировка во времени",
  "audio/propis-dictation": "Прописи — диктант",
  "audio/propis-phoneme-review": "Прописи — WaveNet с обрезкой (отклонён)",
  "audio/propis-natural-pilot": "Прописи — 5 звуков без обрезки",
  "audio/propis-elevenlabs-review": "Прописи — диктант букв, ElevenLabs (2 дубля)",
  "audio/propis-elevenlabs-e-pilot": "Прописи — Б, В, Г с Э (ElevenLabs)",
  "audio/propis-elevenlabs-alphabet": "Прописи — Б, В, Г, Д как буквы алфавита (ElevenLabs)",
  "audio/propis-letter-retake": "Прописи — пересъёмка строчной ж и заглавной Х",
  "audio/propis-elevenlabs-case-pilot": "Прописи — «Заглавная Б» / «Строчная б», диктант (ElevenLabs)",
  "audio/propis-elevenlabs-words-pilot": "Прописи — диктант слов, пилот (ElevenLabs)",
  "sounds/letters": "Звуки букв",
  sounds: "Сигналы ответа",
};
const groups = new Map();
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) { walk(absolute); continue; }
    if (!/\.(mp3|wav|ogg|m4a|webm)$/i.test(entry.name)) continue;
    const path = relative(publicDir, absolute).replaceAll("\\", "/");
    const parts = path.split("/");
    const groupId = parts.slice(0, Math.min(2, parts.length - 1)).join("/");
    if (!groups.has(groupId)) groups.set(groupId, { id: groupId, title: names[groupId] ?? groupId, items: [] });
    const key = path.slice(groupId.length + 1).replace(/\.[^.]+$/, "");
    const fallback = key.startsWith("sound_") ? { label: `Звук «${key.slice(6)}»`, category: "Буквы" }
      : { label: ({ case_upper: "Заглавная", case_lower: "Строчная" })[key] ?? key, category: parts.length > 3 ? parts.slice(2, -1).join(" / ") : "Прочее" };
    groups.get(groupId).items.push({ id: path, key, path, url: `/${path.split("/").map(encodeURIComponent).join("/")}`, ...labels.get(path) ?? fallback,
      version: createHash("sha256").update(readFileSync(absolute)).digest("hex").slice(0, 16) });
  }
}
walk(join(publicDir, "audio"));
walk(join(publicDir, "sounds"));
const categoryOrder = ["Числа", "Знаки", "Фразы"];
for (const group of groups.values()) {
  if (["audio/propis-phoneme-review", "audio/propis-natural-pilot", "audio/propis-elevenlabs-review", "audio/propis-elevenlabs-e-pilot", "audio/propis-elevenlabs-alphabet", "audio/propis-elevenlabs-case-pilot", "audio/propis-elevenlabs-words-pilot"].includes(group.id)) {
    const entries = { "audio/propis-natural-pilot": PROPIS_NATURAL_PILOT, "audio/propis-elevenlabs-review": PROPIS_ELEVENLABS_ENTRIES, "audio/propis-elevenlabs-e-pilot": PROPIS_ELEVENLABS_E_PILOT, "audio/propis-elevenlabs-alphabet": PROPIS_ELEVENLABS_ALPHABET, "audio/propis-elevenlabs-case-pilot": PROPIS_ELEVENLABS_CASE_PILOT, "audio/propis-elevenlabs-words-pilot": PROPIS_ELEVENLABS_WORDS_PILOT }[group.id] ?? PROPIS_PHONEME_ENTRIES;
    const order = new Map(entries.map((entry) => [entry.key, entry.order]));
    const rank = (item) => order.get(item.key.replace(/__2$/, "")) * 2 + (item.key.endsWith("__2") ? 1 : 0);
    group.items.sort((a, b) => rank(a) - rank(b));
    continue;
  }
  group.items.sort((a, b) => {
    const categoryRank = (item) => { const i = categoryOrder.indexOf(item.category); return i < 0 ? 3 : i; };
    return categoryRank(a) - categoryRank(b) || a.path.localeCompare(b.path, "ru", { numeric: true });
  });
}
const playlists = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(publicDir, "audio-review-manifest.json"), `${JSON.stringify({ playlists }, null, 2)}\n`);
console.log(`Audio review: ${playlists.length} playlists, ${playlists.reduce((sum, group) => sum + group.items.length, 0)} recordings`);
