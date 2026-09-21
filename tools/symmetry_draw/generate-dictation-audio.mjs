// Creates the high-quality prerecorded command bank for Graphic Dictation.
// Usage:
//   node tools/symmetry_draw/generate-dictation-audio.mjs [--dry-run] [--force] [--voice=Kore]
// The run is resumable: existing MP3s are preserved, and Gemini's daily
// CreateVoice cap stops the script cleanly so it can continue tomorrow.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "../../scripts/lib/gemini-key.mjs";
import { collectDictationAudioEntries } from "./dictation-audio.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const TOPIC = JSON.parse(readFileSync(join(DIR, "topic.json"), "utf8"));
const MODEL = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000;
const MP3_KBPS = 64;
const MIN_DELAY_MS = 6500;
const MAX_RETRIES = 4;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const voiceArg = args.find((arg) => arg.startsWith("--voice="));
const VOICE = voiceArg ? voiceArg.slice("--voice=".length) : "Kore";
const entries = collectDictationAudioEntries(TOPIC);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pcmToMp3(pcmBytes) {
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.length / 2);
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, MP3_KBPS);
  const parts = [];
  for (let index = 0; index < samples.length; index += 1152) {
    const encoded = encoder.encodeBuffer(samples.subarray(index, index + 1152));
    if (encoded.length) parts.push(Buffer.from(encoded));
  }
  const final = encoder.flush();
  if (final.length) parts.push(Buffer.from(final));
  return Buffer.concat(parts);
}

class DailyQuotaExhausted extends Error {}
class InvalidApiKey extends Error {}

function promptFor(text) {
  return `Прочитай короткую команду графического диктанта по-русски. Спокойно, чётко и дружелюбно, как для ребёнка. Не добавляй вступление или пояснение. Команда: ${text}`;
}

async function synthesizeOnce(apiKey, text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFor(text) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
    },
  );

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    const message = JSON.stringify(body);
    if (/PerDay|retry in \d+h/i.test(message)) throw new DailyQuotaExhausted(message.slice(0, 300));
    const error = new Error(`rate limited: ${message.slice(0, 300)}`);
    error.retryable = true;
    throw error;
  }

  const data = await response.json();
  if (response.status === 400 && data?.error?.details?.some((detail) => detail?.reason === "API_KEY_INVALID")) {
    throw new InvalidApiKey("Gemini API key is invalid");
  }
  const audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audio) throw new Error(`Gemini TTS error: ${JSON.stringify(data).slice(0, 500)}`);
  return pcmToMp3(Buffer.from(audio, "base64"));
}

async function synthesize(apiKey, text) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await synthesizeOnce(apiKey, text);
    } catch (error) {
      if (error instanceof DailyQuotaExhausted || !error.retryable || attempt === MAX_RETRIES) throw error;
      const delay = 5000 * attempt;
      console.log(`    retry ${attempt}/${MAX_RETRIES - 1} after ${delay}ms (${error.message.slice(0, 80)})`);
      await sleep(delay);
    }
  }
}

if (dryRun) {
  console.log(`${entries.length} unique dictation command recording(s):`);
  for (const entry of entries) console.log(`  ${entry.path}  —  ${entry.text}`);
  process.exit(0);
}

const apiKey = getGeminiApiKey();
let generated = 0;
let skipped = 0;
let failed = 0;
let stoppedOnQuota = false;

for (const entry of entries) {
  const output = join(DIR, entry.path);
  if (!force && existsSync(output)) {
    skipped += 1;
    continue;
  }
  mkdirSync(dirname(output), { recursive: true });
  process.stdout.write(`  gen   ${entry.path}  \"${entry.text}\"... `);
  try {
    const mp3 = await synthesize(apiKey, entry.text);
    writeFileSync(output, mp3);
    console.log(`${mp3.length} bytes`);
    generated += 1;
  } catch (error) {
    if (error instanceof DailyQuotaExhausted) {
      console.log("DAILY QUOTA EXHAUSTED — stopping here; rerun tomorrow to continue.");
      stoppedOnQuota = true;
      break;
    }
    if (error instanceof InvalidApiKey) {
      console.log("INVALID API KEY — stopping without further requests.");
      failed += 1;
      break;
    }
    console.log(`FAILED: ${error.message}`);
    failed += 1;
  }
  await sleep(MIN_DELAY_MS);
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})${stoppedOnQuota ? " — stopped on daily quota" : ""}`);
if (failed && !stoppedOnQuota) process.exit(1);
