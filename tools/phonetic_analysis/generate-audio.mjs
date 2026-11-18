// Word voice for «Буквы и звуки»: tools/phonetic_analysis/audio/<word>.mp3,
// picked up by build.mjs. The same voice and delivery as the approved «Диктант»
// words (scripts/generate-propis-dictation-elevenlabs.mjs, docs/testing/propis-phoneme-review.md):
// the owner's cloned voice, eleven_v4, «[calm, clear, like a teacher dictating to a class] Кот.»
// A word the dictation already has is copied from public/audio/propis-dictation
// (word_<id>.mp3), so a word sounds the same in both topics; the rest are synthesized.
// Then every file is checked for a pause inside (the model sometimes says a
// one-syllable word twice: «Суп. Суп») — such files are listed, not kept silently.
//
// Auth: the cloud proxy's network secret for api.elevenlabs.io (adds xi-api-key).
// Usage: NODE_USE_ENV_PROXY=1 node tools/phonetic_analysis/generate-audio.mjs [--words=кот,дом] [--force] [--dry-run]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const OUT = join(DIR, "audio");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const TAG = "[calm, clear, like a teacher dictating to a class]";
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const ONLY = arg("words") ? new Set(arg("words").split(",")) : null;
const FORCE = args.includes("--force");
const DRY = args.includes("--dry-run");
const CHECK = args.includes("--check"); // only re-check the files for a pause inside

// What to send instead of the plain word, where the plain word came out wrong:
// «Аист.» merged into «айст» (heard as «Iced»); the stress mark keeps two vowels.
// «замок»: the picture is a padlock — замо́к, while «Диктант» says за́мок, so it is not copied.
const SAY = { аист: "Аи́ст.", замок: "Замо́к." };
// After synthesis each file was checked by speech recognition (ElevenLabs scribe_v1);
// «лыжи», «вагон» came out stuttered («Л-лыжи», «В вагон») and were redone.
const words = JSON.parse(readFileSync(join(DIR, "words.json"), "utf8")).words.filter((w) => !ONLY || ONLY.has(w.id));
const dictation = new Map(JSON.parse(readFileSync(join(ROOT, "tools/propis2/topic.json"), "utf8")).words
  .map((w) => [w.word.toLowerCase(), join(ROOT, "public/audio/propis-dictation", `word_${w.id}.mp3`)]));

async function synth(text) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": process.env.ELEVENLABS_API_KEY || "via-proxy" },
      body: JSON.stringify({ text: `${TAG} ${text}`, model_id: MODEL_ID }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    if (attempt === 4 || res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

// A silence of ≥ 0.25 s at -40 dB that is not at the very start or end = the word said twice.
function hasInnerPause(file) {
  // silencedetect reports on stderr
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return starts.some((s, i) => s > 0.15 && (ends[i] ?? dur) < dur - 0.1); // trailing silence ends ~0.05 s before the end
}

mkdirSync(OUT, { recursive: true });
let copied = 0, made = 0;
const suspicious = [];
for (const w of CHECK ? [] : words) {
  const file = join(OUT, `${w.id}.mp3`);
  if (existsSync(file) && !FORCE) continue;
  const from = dictation.get(w.word.toLowerCase());
  if (from && existsSync(from) && !SAY[w.id]) {
    if (!DRY) copyFileSync(from, file);
    copied += 1;
    console.log(`copy ${w.word}`);
    continue;
  }
  const text = SAY[w.id] ?? `${w.word[0].toUpperCase()}${w.word.slice(1)}.`;
  if (DRY) { console.log(`synth ${text}`); made += 1; continue; }
  writeFileSync(file, await synth(text));
  made += 1;
  console.log(`made ${w.word}`);
}
for (const w of words) {
  const file = join(OUT, `${w.id}.mp3`);
  if (!DRY && existsSync(file) && hasInnerPause(file)) suspicious.push(w.word);
}
console.log(`copied ${copied}, synthesized ${made}`);
if (suspicious.length) console.log(`pause inside (said twice?): ${suspicious.join(", ")}`);
