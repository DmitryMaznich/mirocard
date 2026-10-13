// Number names for «Разряды числа» → «Названия чисел» («Услышь и выбери»), in
// the owner's ElevenLabs voice with the same delivery as the approved propis
// dictation clips (scripts/generate-propis-dictation-elevenlabs.mjs).
// One word per file: 0–19, the round tens, the round hundreds and «тысяча» —
// any number up to 999 is spoken by playing its words back to back
// (src/topics/renderers/place_value/numberAudio.js).
// Plus the phrases of «Считаем десятками» (PHRASE_AUDIO).
// Output: public/audio/place-value-numbers/n<N>.mp3, p-<key>.mp3
//
// Auth: ELEVENLABS_API_KEY from the environment, sent as `xi-api-key`; without it
// the request goes out bare (in case a network secret injects the header).
// Resumable: existing files are skipped unless --force.
// Usage (cloud session): NODE_USE_ENV_PROXY=1 node scripts/generate-place-value-numbers-elevenlabs.mjs [--keys=n200,n90] [--force]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NUMBER_AUDIO_WORDS, PHRASE_AUDIO } from "../src/topics/renderers/place_value/numberAudio.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const TAG = "[calm, clear, like a teacher dictating to a class]";
const OUT_DIR = resolve(ROOT, "public/audio/place-value-numbers");
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const KEYS = args.keys ? new Set(String(args.keys).split(",")) : null;
const apiKey = process.env.ELEVENLABS_API_KEY;
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
    if (attempt >= 4 || ![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    await sleep(2000 * 2 ** attempt);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const clips = [
  ...Object.entries(NUMBER_AUDIO_WORDS).map(([n, word]) => [`n${n}`, `${word[0].toUpperCase()}${word.slice(1)}.`]),
  ...Object.entries(PHRASE_AUDIO).map(([key, text]) => [`p-${key}`, text]),
];
for (const [key, text] of clips) {
  if (KEYS && !KEYS.has(key)) continue;
  const file = join(OUT_DIR, `${key}.mp3`);
  if (existsSync(file) && !args.force) continue;
  writeFileSync(file, await synthesize(text));
  console.log(`${key}  ←  ${text}`);
}
