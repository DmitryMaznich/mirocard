// Candidate recordings only: never overwrites the human-recorded dictation bank.
// node scripts/generate-propis-phoneme-audio.mjs [--keys=sound_к,sound_с] [--force]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGoogleCloudTts } from "./lib/google-cloud-tts.mjs";
import { PROPIS_PHONEME_ENTRIES, phonemeInput } from "./lib/propis-phoneme-bank.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = join(root, "public/audio/propis-phoneme-review");
const keys = process.argv.find((arg) => arg.startsWith("--keys="))?.slice(7).split(",");
const voice = process.argv.find((arg) => arg.startsWith("--voice="))?.slice(8) ?? "ru-RU-Wavenet-A";
if (keys?.some((key) => !PROPIS_PHONEME_ENTRIES.some((entry) => entry.key === key))) throw new Error("Unknown audio key");
const tts = createGoogleCloudTts();
mkdirSync(directory, { recursive: true });
let failed = 0;
for (const entry of PROPIS_PHONEME_ENTRIES) {
  if (keys && !keys.includes(entry.key)) continue;
  const path = join(directory, `${entry.key}.mp3`);
  if (existsSync(path) && !process.argv.includes("--force")) { console.log(`skip ${entry.key}`); continue; }
  try {
    const bytes = await tts.synthesize(phonemeInput(entry), { voice, rate: 0.95 });
    if (bytes.length < 1000) throw new Error("Unexpectedly short audio response");
    writeFileSync(path, bytes);
    console.log(`${entry.key}: ${bytes.length} bytes (${entry.phoneme ?? entry.text})`);
  } catch (error) { failed++; console.error(`${entry.key}: ${error.message}`); }
}
if (failed) process.exitCode = 1;
