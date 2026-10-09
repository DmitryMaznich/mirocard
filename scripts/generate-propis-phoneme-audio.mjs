// Candidate recordings only: never overwrites the human-recorded dictation bank.
// node scripts/generate-propis-phoneme-audio.mjs [--keys=sound_к,sound_с] [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGoogleCloudTts } from "./lib/google-cloud-tts.mjs";
import { PROPIS_PHONEME_ENTRIES, phonemeInput } from "./lib/propis-phoneme-bank.mjs";
import { chromium } from "@playwright/test";
import { Mp3Encoder } from "@breezystack/lamejs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = join(root, "public/audio/propis-phoneme-review");
const keys = process.argv.find((arg) => arg.startsWith("--keys="))?.slice(7).split(",");
const voice = process.argv.find((arg) => arg.startsWith("--voice="))?.slice(8) ?? "ru-RU-Wavenet-A";
if (keys?.some((key) => !PROPIS_PHONEME_ENTRIES.some((entry) => entry.key === key))) throw new Error("Unknown audio key");
if (voice !== "ru-RU-Wavenet-A") throw new Error("Clip boundaries are verified only for the preserved WaveNet-A sources");
const tts = createGoogleCloudTts();
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
async function extractConsonant(entry) {
  const source = readFileSync(join(root, "scripts/audio-sources/propis-wavenet-a", `${entry.letter}.mp3`)).toString("base64");
  const decoded = await page.evaluate(async ({ source, clip }) => {
    const context = new globalThis.AudioContext({ sampleRate: 48000 });
    try {
      const bytes = Uint8Array.from(atob(source), (character) => character.charCodeAt(0));
      const buffer = await context.decodeAudioData(bytes.buffer);
      const samples = buffer.getChannelData(0);
      return { rate: buffer.sampleRate, samples: Array.from(samples.slice(Math.round(clip[0] * buffer.sampleRate), Math.round(clip[1] * buffer.sampleRate))) };
    } finally { await context.close(); }
  }, { source, clip: entry.clip });
  const peak = decoded.samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  if (peak < 0.001) throw new Error("Empty consonant segment");
  const gain = Math.min(20, 0.5 / peak);
  const padding = Math.round(decoded.rate * 0.04);
  const pcm = new Int16Array(padding + decoded.samples.length + Math.round(decoded.rate * 0.10));
  const fade = Math.round(decoded.rate * 0.002);
  decoded.samples.forEach((sample, index) => {
    const envelope = Math.min(1, index / fade, (decoded.samples.length - 1 - index) / fade);
    pcm[padding + index] = Math.round(Math.max(-1, Math.min(1, sample * gain * envelope)) * 32767);
  });
  const encoder = new Mp3Encoder(1, decoded.rate, 64);
  const chunks = [];
  for (let index = 0; index < pcm.length; index += 1152) chunks.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(index, index + 1152))));
  chunks.push(Buffer.from(encoder.flush()));
  return Buffer.concat(chunks);
}
let failed = 0;
try {
for (const entry of PROPIS_PHONEME_ENTRIES) {
  if (keys && !keys.includes(entry.key)) continue;
  const path = join(directory, `${entry.key}.mp3`);
  if (existsSync(path) && !process.argv.includes("--force")) { console.log(`skip ${entry.key}`); continue; }
  try {
    const bytes = entry.clip ? await extractConsonant(entry) : await tts.synthesize(phonemeInput(entry), { voice, rate: 0.95 });
    if (bytes.length < 1000) throw new Error("Unexpectedly short audio response");
    writeFileSync(path, bytes);
    console.log(`${entry.key}: ${bytes.length} bytes (${entry.phoneme ?? entry.text})`);
  } catch (error) { failed++; console.error(`${entry.key}: ${error.message}`); }
}
} finally { await browser.close(); }
if (failed) process.exitCode = 1;

