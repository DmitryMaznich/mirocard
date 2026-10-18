// Voice for «Глаголы» (verbs_v2) in the owner's ElevenLabs voice, same as the
// place_value number names and the propis dictation: the verb itself
// (audio/<conceptId>.mp3, «Ест.») and the command for «Покажи, как»
// (audio/imp_<conceptId>.mp3, «Прыгай!»). One voice for the whole topic: the
// earlier clips came from another TTS (24 kHz mono) and would not match.
//
// Every clip is trimmed (ffmpeg, 50 ms kept before the voice, 80 ms after) and
// checked: ElevenLabs scribe must hear the text, and the clip must hold one
// stretch of speech - eleven_v4 sometimes says a lone short word twice
// («Ест… ест»). A failed clip is generated again, up to 4 times (see FALLBACK_MODEL_ID).
// Scribe hears «ест» as «есть» (the old clip too), so that one passes on
// «есть» and is listed for a human listen, along with stress-prone words.
//
// Auth: ELEVENLABS_API_KEY from the environment, else a network secret injects it.
// Resumable: clips recorded in audio-voice.json for the same text are skipped unless --force.
// Usage (cloud session): NODE_USE_ENV_PROXY=1 node tools/verbs_v2/generate-audio-elevenlabs.mjs [--keys=eats,imp_eats] [--force] [--relevel]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const AUDIO = join(DIR, "audio");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const WORD_TAG = "[calm, clear, warm, speaking to a young child]";
const COMMAND_TAG = "[warm, encouraging, clear, speaking to a young child]";
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const KEYS = args.keys ? new Set(String(args.keys).split(",")) : null;
const apiKey = process.env.ELEVENLABS_API_KEY;
const auth = apiKey ? { "xi-api-key": apiKey } : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// What scribe may write for a clip besides its own text.
const HEARD_AS = { eats: ["есть"] };

async function request(url, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const body = await res.text();
    if (attempt >= 4 || ![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    await sleep(2000 * 2 ** attempt);
  }
}

// eleven_v4 often says a lone one- or two-syllable word twice («Бежит, бежит»)
// and acted «Смеётся» out as laughter; after two such tries the same voice is
// asked through eleven_multilingual_v2, which takes no delivery tag.
const FALLBACK_MODEL_ID = "eleven_multilingual_v2";
async function synthesize(text, tag, model) {
  const res = await request(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg", ...auth },
    body: JSON.stringify({ text: model === MODEL_ID ? `${tag} ${text}` : text, model_id: model }),
  });
  return Buffer.from(await res.arrayBuffer());
}

async function transcribe(file) {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("language_code", "rus");
  form.append("file", new Blob([readFileSync(file)], { type: "audio/mpeg" }), "clip.mp3");
  const res = await request("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: auth, body: form });
  return (await res.json()).text ?? "";
}

// Gentler than place_value's trim (50 ms minimum, -45 dB): there a short burst
// counts as a click, but here it ate the opening «п» of «Прыгай» / «Пылесосит»
// (heard as «Три гая», «Вылесосит»). Any 10 ms of sound above -50 dB is voice.
const edge = (keep) => `silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB:start_silence=${keep}`;
function trim(file) {
  const tmp = join(AUDIO, `.tmp-${Date.now()}.mp3`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", file, "-af", `${edge(0.05)},areverse,${edge(0.08)},areverse`, "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
  renameSync(tmp, file);
}

// eleven_v4 acts the word out, so «Спит» comes out whispered (-21 dB mean)
// and «Пей!» loud (-11 dB). Bring every clip to one mean level, peak kept
// under -1 dB. (loudnorm is unreliable on sub-second clips; a plain gain is not.)
const TARGET_MEAN_DB = -15;
function level(file) {
  const log = spawnSync("ffmpeg", ["-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const mean = Number(log.match(/mean_volume: (-?[\d.]+)/)[1]);
  const peak = Number(log.match(/max_volume: (-?[\d.]+)/)[1]);
  const gain = Math.min(TARGET_MEAN_DB - mean, -1 - peak);
  if (Math.abs(gain) < 0.5) return;
  const tmp = join(AUDIO, `.tmp-${Date.now()}.mp3`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", file, "-af", `volume=${gain.toFixed(1)}dB`, "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
  renameSync(tmp, file);
}

// Pauses longer than 0.25 s inside the trimmed clip = more than one stretch of speech.
function innerPauses(file) {
  const log = spawnSync("ffmpeg", ["-v", "info", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return (log.match(/silence_end/g) ?? []).length;
}

const normalize = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/[^а-я ]/g, " ").replace(/\s+/g, " ").trim();

const deck = JSON.parse(readFileSync(join(DIR, "deck.json"), "utf8"));
const clips = [];
for (const card of deck.cards.filter((c) => c.primary)) {
  const word = card.label[0].toUpperCase() + card.label.slice(1);
  clips.push({ key: card.conceptId, text: `${word}.`, tag: WORD_TAG, conceptId: card.conceptId });
  clips.push({ key: `imp_${card.conceptId}`, text: card.imperative, tag: COMMAND_TAG, conceptId: card.conceptId });
}

// Which clips are already in this voice, and for which text: older clips under
// the same file names came from the previous TTS and must be replaced.
const VOICED = join(DIR, "audio-voice.json");
const voiced = existsSync(VOICED) ? JSON.parse(readFileSync(VOICED, "utf8")) : {};

// --relevel: only re-apply level() to clips already recorded in this voice.
if (args.relevel) {
  for (const key of Object.keys(voiced)) level(join(AUDIO, `${key}.mp3`));
  console.log(`relevelled ${Object.keys(voiced).length} clips`);
  process.exit(0);
}

const failures = [];
for (const clip of clips) {
  if (KEYS && !KEYS.has(clip.key)) continue;
  const file = join(AUDIO, `${clip.key}.mp3`);
  if (existsSync(file) && voiced[clip.key]?.text === clip.text && !args.force) continue;
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    const model = attempt <= 2 ? MODEL_ID : FALLBACK_MODEL_ID;
    writeFileSync(file, await synthesize(clip.text, clip.tag, model));
    trim(file);
    level(file);
    const heard = await transcribe(file);
    const pauses = innerPauses(file);
    const accepted = [clip.text, ...(clip.key === clip.conceptId ? HEARD_AS[clip.conceptId] ?? [] : [])].map(normalize);
    // Scribe marks non-speech in brackets («[смеётся]» = the clip laughs).
    ok = !heard.includes("[") && accepted.includes(normalize(heard)) && pauses === 0;
    console.log(`${ok ? "ok  " : "FAIL"} ${clip.key.padEnd(20)} «${clip.text}» heard «${heard}» pauses=${pauses} ${model}`);
    if (ok) clip.model = model;
  }
  if (ok) voiced[clip.key] = { text: clip.text, model: clip.model };
  else failures.push(clip.key);
  writeFileSync(VOICED, `${JSON.stringify(voiced, null, 2)}\n`);
}
if (failures.length) {
  console.log(`\nStill failing after 4 tries: ${failures.join(", ")}`);
  process.exitCode = 1;
}
