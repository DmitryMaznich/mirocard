import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { NUMBER_WORDS } from "../src/topics/renderers/addition_subtraction/audioNumbers.js";
import { PHRASE_ENTRIES } from "../src/topics/renderers/addition_subtraction/audioPhraseBank.js";
import { AUDIO_ENTRIES } from "../src/topics/renderers/daily_orientation/audioBank.js";
import { splitIntoSentences, textSentenceDictationKey, wordDictationKey } from "../src/topics/renderers/propis/dictationAudio.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const labels = new Map();
const setLabel = (path, label, category) => labels.set(path, { label, category });
for (const [number, word] of Object.entries(NUMBER_WORDS)) {
  setLabel(`audio/addition-subtraction/n${number}.mp3`, `${number} — ${word}`, "Числа");
}
for (const [key, word] of [["plus", "плюс"], ["minus", "минус"]]) {
  setLabel(`audio/addition-subtraction/${key}.mp3`, word, "Знаки");
}
for (const { key, text } of PHRASE_ENTRIES) setLabel(`audio/addition-subtraction/phrases/${key}.mp3`, text, "Фразы");
for (const { key, text } of AUDIO_ENTRIES) setLabel(`audio/daily-orientation/${key}.mp3`, text, "Слова и фразы");
const propis = JSON.parse(readFileSync(join(root, "tools/propis/topic.json"), "utf8"));
for (const word of propis.words) setLabel(`audio/propis-dictation/${wordDictationKey(word)}.mp3`, word.word, "Слова");
for (const entry of propis.texts) {
  splitIntoSentences(entry.text).forEach((text, index) => setLabel(`audio/propis-dictation/${textSentenceDictationKey(entry, index)}.mp3`, text, "Предложения"));
}
const names = {
  "audio/addition-subtraction": "Плюс / минус — слушаем и считаем",
  "audio/daily-orientation": "Ориентировка во времени",
  "audio/propis-dictation": "Прописи — диктант",
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
  group.items.sort((a, b) => {
    const categoryRank = (item) => { const i = categoryOrder.indexOf(item.category); return i < 0 ? 3 : i; };
    return categoryRank(a) - categoryRank(b) || a.path.localeCompare(b.path, "ru", { numeric: true });
  });
}
const playlists = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(publicDir, "audio-review-manifest.json"), `${JSON.stringify({ playlists }, null, 2)}\n`);
console.log(`Audio review: ${playlists.length} playlists, ${playlists.reduce((sum, group) => sum + group.items.length, 0)} recordings`);
