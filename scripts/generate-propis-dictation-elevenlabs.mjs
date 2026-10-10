// Synthesizes the "Диктант" word / text-sentence clips in the owner's ElevenLabs
// voice, the same voice and delivery as the approved letter clips (see
// scripts/lib/propis-elevenlabs-bank.mjs, docs/testing/propis-phoneme-review.md).
// Replaces the Gemini pipeline in generate-propis-dictation-audio.mjs for words
// and texts once the owner approves the pilot.
//
// One utterance per file ("Мама.") — the dictation screen's repeat button
// replays it. Keys come from dictationAudio.js, so files drop into
// public/audio/propis-dictation as is. Content: tools/propis/topic.json (the
// same words/texts as propis2's topic.json).
//
// Auth: ELEVENLABS_API_KEY from the environment, sent as `xi-api-key`. Without it
// the request goes out bare (in case a network secret injects the header).
// Resumable: existing files are skipped unless --force.
//
// Usage (in a cloud session Node's fetch needs NODE_USE_ENV_PROXY=1 to use the proxy):
//   NODE_USE_ENV_PROXY=1 node scripts/generate-propis-dictation-elevenlabs.mjs [--only=words|texts]
//     [--ids=w001,w006] [--takes=2] [--out=public/audio/propis-elevenlabs-words-pilot]
//     [--force] [--dry-run]
// --takes=2 writes <key>.mp3 and <key>__2.mp3 (review playlists); default 1.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitIntoSentences, textSentenceDictationKey, wordDictationKey } from "../src/topics/renderers/propis/dictationAudio.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const TAG = "[calm, clear, like a teacher dictating to a class]";
const MAX_RETRIES = 4;

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const OUT_DIR = resolve(ROOT, args.out ?? "public/audio/propis-dictation");
const TAKES = Number(args.takes ?? 1);
const IDS = args.ids ? new Set(String(args.ids).split(",")) : null;
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) console.warn("ELEVENLABS_API_KEY is not set; requests go out without a key.");

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
const sayable = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

function buildEntries() {
  const topic = JSON.parse(readFileSync(join(ROOT, "tools/propis/topic.json"), "utf8"));
  const entries = [];
  if (!args.only || args.only === "words") {
    for (const w of topic.words) {
      if (IDS && !IDS.has(w.id)) continue;
      entries.push({ key: wordDictationKey(w), text: sayable(capitalize(w.word)) });
    }
  }
  if (!args.only || args.only === "texts") {
    for (const t of topic.texts) {
      if (IDS && !IDS.has(t.id)) continue;
      splitIntoSentences(t.text).forEach((sentence, i) => entries.push({ key: textSentenceDictationKey(t, i), text: sayable(sentence) }));
    }
  }
  return entries;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synthesize(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg", ...(apiKey ? { "xi-api-key": apiKey } : {}) },
      body: JSON.stringify({ text: `${TAG} ${text}`, model_id: MODEL_ID }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    // 401/403/422 won't get better on retry; 429/5xx might.
    if (attempt >= MAX_RETRIES || ![429, 500, 502, 503, 504].includes(res.status)) {
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    await sleep(2000 * 2 ** attempt);
  }
}

const entries = buildEntries();
mkdirSync(OUT_DIR, { recursive: true });
let made = 0, skipped = 0;
for (const { key, text } of entries) {
  for (let take = 1; take <= TAKES; take++) {
    const file = join(OUT_DIR, `${key}${take > 1 ? `__${take}` : ""}.mp3`);
    if (existsSync(file) && !args.force) { skipped++; continue; }
    if (args["dry-run"]) { console.log(`${file.slice(ROOT.length + 1)}  ←  ${TAG} ${text}`); continue; }
    writeFileSync(file, await synthesize(text));
    made++;
    console.log(`✓ ${key}${take > 1 ? ` (take ${take})` : ""}  ${text}`);
  }
}
console.log(`${made} generated, ${skipped} already there, ${entries.length} entries × ${TAKES} take(s) → ${OUT_DIR.slice(ROOT.length + 1)}`);
