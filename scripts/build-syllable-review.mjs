// «По слогам» (propis2): the review set for /audio-review.html?set=audio/propis-syllables-review — every syllable clip on its own
// (category «Слоги») and every word put together from them the way the dictation screen plays it (category «Слова по слогам»), so
// the owner can mark what is wrong with each syllable and hear it in its words. Copies of public/audio/propis-dictation, not what the
// app plays: rebuild after any syllable is retaken, delete the folder once the syllables are approved.
// Needs ffmpeg on PATH. Usage: node scripts/build-syllable-review.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syllableDictationKey } from "../src/topics/renderers/propis/dictationAudio.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "public/audio/propis-dictation");
const OUT = join(ROOT, "public/audio/propis-syllables-review");
const PAUSE_S = 0.45; // as SYLLABLE_PAUSE_MS in propis2/engine.js

const topic = JSON.parse(readFileSync(join(ROOT, "tools/propis2/topic.json"), "utf8"));
const words = topic.words.filter((w) => (w.syllables?.length ?? 0) > 1);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "slogi"), { recursive: true });
mkdirSync(join(OUT, "slova"), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "syl-review-"));
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
ffmpeg("-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(PAUSE_S), join(tmp, "pause.wav"));
const wav = new Map();
for (const syl of new Set(words.flatMap((w) => w.syllables.map((s) => s.toLowerCase())))) {
  const key = syllableDictationKey(syl);
  ffmpeg("-i", join(SOURCE, `${key}.mp3`), "-ar", "44100", "-ac", "1", join(tmp, `${key}.wav`));
  wav.set(syl, join(tmp, `${key}.wav`));
  writeFileSync(join(OUT, "slogi", `${key}.mp3`), readFileSync(join(SOURCE, `${key}.mp3`)));
}
for (const w of words) {
  const list = w.syllables.flatMap((s, i) => [...(i ? [join(tmp, "pause.wav")] : []), wav.get(s.toLowerCase())]);
  writeFileSync(join(tmp, "list.txt"), list.map((f) => `file '${f}'`).join("\n"));
  ffmpeg("-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-c:a", "libmp3lame", "-b:a", "96k", join(OUT, "slova", `${w.id}.mp3`));
}
rmSync(tmp, { recursive: true, force: true });
console.log(`${wav.size} syllables, ${words.length} words → public/audio/propis-syllables-review (then: node scripts/build-audio-review-manifest.mjs)`);
