// Rebuilds addition_subtraction's complete spoken bank with Gemini TTS / Kore.
// Number and sign clips are intentionally generated separately from the fixed
// phrases so the renderer can compose any value from its existing word bank.
//
// Usage:
//   node scripts/generate-addition-subtraction-kore-audio.mjs --force
//   node scripts/generate-addition-subtraction-kore-audio.mjs --only=numbers --force
//   node scripts/generate-addition-subtraction-kore-audio.mjs --only=phrases --force
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import { NUMBER_WORDS, SIGN_WORDS, audioKeyForNumber } from "../src/topics/renderers/addition_subtraction/audioNumbers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "audio", "addition-subtraction");
const MODEL = process.argv.find((arg) => arg.startsWith("--model="))?.split("=")[1] ?? "gemini-2.5-flash-preview-tts";
const VOICE = process.argv.find((arg) => arg.startsWith("--voice="))?.split("=")[1] ?? "Kore";
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.split("=")[1] ?? "all";
const KEYS = process.argv.find((arg) => arg.startsWith("--keys="))?.split("=")[1]?.split(",").filter(Boolean) ?? null;
const FORCE = process.argv.includes("--force");
const SAMPLE_RATE = 24000;
const MP3_KBPS = 64;
const MIN_DELAY_MS = 6500;
// A request may already have reached Gemini even if the connection drops. Keep
// the default to one attempt so a batch never silently spends quota twice for
// the same clip. A deliberate retry can be requested explicitly after the run.
const maxRetriesArgument = process.argv.find((arg) => arg.startsWith("--max-retries="))?.split("=")[1];
const MAX_RETRIES = Number.parseInt(maxRetriesArgument ?? "1", 10);

if (!["all", "numbers", "phrases"].includes(ONLY)) {
  throw new Error(`Unsupported --only value: ${ONLY}. Use numbers or phrases.`);
}
if (!Number.isInteger(MAX_RETRIES) || MAX_RETRIES < 1) {
  throw new Error("--max-retries must be a positive integer.");
}

const NUMBER_ENTRIES = [
  ...Object.entries(NUMBER_WORDS).map(([number, text]) => ({ key: audioKeyForNumber(number), text })),
  { key: "plus", text: SIGN_WORDS.add },
  { key: "minus", text: SIGN_WORDS.subtract },
];

// Each entry is a grammatically complete fixed segment. Variable numbers are
// appended at playback time by audioPhrases.js from the same Kore word bank.
const PHRASE_ENTRIES = [
  { key: "was", text: "Было" },
  { key: "became", text: "стало" },
  { key: "more_or_less", text: "Стало больше или меньше?" },
  { key: "correct_more", text: "Правильно. Стало больше." },
  { key: "correct_less", text: "Правильно. Стало меньше." },
  { key: "wrong_look_again", text: "Неправильно. Посмотри ещё раз." },
  { key: "what_was_done", text: "Что сделали?" },
  { key: "what_was_done_say", text: "Что сделали? Скажи." },
  { key: "how_many_added", text: "Сколько прибавили?" },
  { key: "how_many_removed", text: "Сколько убрали?" },
  { key: "correct_added", text: "Правильно. Прибавили." },
  { key: "correct_removed", text: "Правильно. Убрали." },
  { key: "correct_added_count", text: "Правильно. Прибавили" },
  { key: "correct_removed_count", text: "Правильно. Убрали" },
  { key: "look_again", text: "Посмотри ещё раз." },
  { key: "count_again", text: "Посчитай ещё раз." },
];

const apiKey = getGeminiApiKey();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pcmToMp3(pcmBytes) {
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.length / 2);
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, MP3_KBPS);
  const parts = [];
  for (let start = 0; start < samples.length; start += 1152) {
    const chunk = encoder.encodeBuffer(samples.subarray(start, start + 1152));
    if (chunk.length) parts.push(Buffer.from(chunk));
  }
  const end = encoder.flush();
  if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

class DailyQuotaExhausted extends Error {}

function findNestedAudioData(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.data === "string" && value.data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value.data)) {
    return value.data;
  }
  for (const child of Object.values(value)) {
    const audioData = findNestedAudioData(child);
    if (audioData) return audioData;
  }
  return null;
}

async function synthesizeOnce(text, { isSingleWord = false } = {}) {
  const usesInteractionsApi = MODEL.startsWith("gemini-3.8-") && MODEL.endsWith("-tts");
  const spokenText = isSingleWord ? `${text}.` : text;
  // Gemini 3.8 TTS treats input text as a verbatim transcript. Its delivery
  // instruction therefore belongs in speech_metadata, never in the text to
  // be spoken. Older Gemini TTS models use the generateContent form below.
  const endpoint = usesInteractionsApi
    ? "https://generativelanguage.googleapis.com/v1beta/interactions"
    : `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const headers = usesInteractionsApi
    ? { "Content-Type": "application/json", "x-goog-api-key": apiKey }
    : { "Content-Type": "application/json" };
  const body = usesInteractionsApi
    ? {
        model: MODEL,
        input: [{
          type: "user_input",
          content: [{
            type: "text",
            text: spokenText,
            annotations: [{ type: "speech_metadata", style: "calm, clear, friendly, for a child" }],
          }],
        }],
        response_format: { type: "audio", mime_type: "audio/l16", sample_rate: SAMPLE_RATE },
        generation_config: { speech_config: [{ voice: VOICE }] },
      }
    : {
        contents: [{ parts: [{ text: `Прочитай спокойно, чётко и дружелюбно, как для ребёнка: ${spokenText}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      };
  const response = await fetch(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
  );
  if (response.status === 429) {
    const message = JSON.stringify(await response.json().catch(() => ({})));
    if (/PerDay|retry in \d+h/i.test(message)) throw new DailyQuotaExhausted(message.slice(0, 300));
    const error = new Error(`rate limited: ${message.slice(0, 300)}`);
    error.retryable = true;
    throw error;
  }
  const data = await response.json();
  const audioData = usesInteractionsApi
    ? data?.output_audio?.data ?? data?.outputAudio?.data ?? findNestedAudioData(data)
    : data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    const error = new Error(`Gemini TTS error: ${JSON.stringify(data).slice(0, 500)}`);
    error.retryable = true;
    throw error;
  }
  const pcmBytes = Buffer.from(audioData, "base64");
  if (isSingleWord && pcmBytes.length > SAMPLE_RATE * 2 * 4) {
    throw new Error(`Gemini TTS returned ${(pcmBytes.length / (SAMPLE_RATE * 2)).toFixed(1)} seconds for one word; refusing to overwrite the clip.`);
  }
  return pcmToMp3(pcmBytes);
}

async function synthesize(text, options) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await synthesizeOnce(text, options);
    } catch (error) {
      const networkTimeout = /fetch failed|UND_ERR_CONNECT_TIMEOUT/i.test(`${error?.message ?? ""} ${error?.cause?.code ?? ""}`);
      if (error instanceof DailyQuotaExhausted || (!error.retryable && !networkTimeout) || attempt === MAX_RETRIES) throw error;
      await sleep(5000 * attempt);
    }
  }
  throw new Error("Unreachable");
}

const groups = [
  ...(ONLY === "all" || ONLY === "numbers" ? [{ name: "numbers", entries: NUMBER_ENTRIES, directory: OUT_DIR }] : []),
  ...(ONLY === "all" || ONLY === "phrases" ? [{ name: "phrases", entries: PHRASE_ENTRIES, directory: join(OUT_DIR, "phrases") }] : []),
].map((group) => ({
  ...group,
  entries: KEYS ? group.entries.filter((entry) => KEYS.includes(entry.key)) : group.entries,
}));

if (KEYS && groups.flatMap((group) => group.entries).length !== KEYS.length) {
  throw new Error("At least one --keys value is not available in the selected group.");
}

let generated = 0;
let skipped = 0;
let failed = 0;
let stoppedOnQuota = false;

for (const group of groups) {
  mkdirSync(group.directory, { recursive: true });
  for (const entry of group.entries) {
    const outputPath = join(group.directory, `${entry.key}.mp3`);
    if (!FORCE && existsSync(outputPath)) {
      skipped++;
      continue;
    }
    process.stdout.write(`  ${group.name}/${entry.key}… `);
    try {
      const mp3 = await synthesize(entry.text, { isSingleWord: group.name === "numbers" });
      writeFileSync(outputPath, mp3);
      generated++;
      console.log(`${mp3.length} bytes`);
    } catch (error) {
      if (error instanceof DailyQuotaExhausted) {
        console.log("daily quota exhausted; re-run tomorrow to continue");
        stoppedOnQuota = true;
        break;
      }
      console.log(`failed: ${error.message}`);
      failed++;
    }
    await sleep(MIN_DELAY_MS);
  }
  if (stoppedOnQuota) break;
}

console.log(`✓ Addition/subtraction audio: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})${stoppedOnQuota ? " — quota exhausted" : ""}.`);
if (failed > 0 && !stoppedOnQuota) process.exitCode = 1;
