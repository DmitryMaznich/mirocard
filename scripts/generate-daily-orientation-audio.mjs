// Generates the daily_orientation ("Сегодня") spoken clip bank with Gemini
// TTS / Kore. The clip list itself lives in
// src/topics/renderers/daily_orientation/audioBank.js (shared with the
// renderer, which assembles sentences from these clips at playback time).
//
// Usage:
//   node scripts/generate-daily-orientation-audio.mjs                 # missing clips only
//   node scripts/generate-daily-orientation-audio.mjs --keys=lead_now,min_35 --force
//
// Resumable: existing files are skipped unless --force, so a run stopped by
// the daily quota just continues from where it left off next time.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import { AUDIO_ENTRIES } from "../src/topics/renderers/daily_orientation/audioBank.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio", "daily-orientation");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const MODEL = arg("model") ?? "gemini-3.8-flash-tts";
const VOICE = arg("voice") ?? "Kore";
const KEYS = arg("keys")?.split(",").filter(Boolean) ?? null;
const FORCE = process.argv.includes("--force");
const SAMPLE_RATE = 24000;
const MP3_KBPS = 64;
const MIN_DELAY_MS = 6500;

// "lead" clips are the start of a sentence that keeps going ("Вчера было…",
// "двадцать шестое…"); "final" clips end it. Asking for the matching
// intonation is what keeps the assembled sentence from sounding like a list
// of separate words. The language is spelled out every time: with only one
// or two words of input the model otherwise guesses it and reads Russian
// with a foreign accent (what the 2.5-flash pilot did).
const STYLE_BASE = "Native Russian speaker, standard Moscow pronunciation, no foreign accent. Calm, clear, warm, unhurried, for a young child.";
const TONE_STYLES = {
  lead: `${STYLE_BASE} This is the beginning of a sentence that continues: unfinished, rising-level intonation, no final fall.`,
  final: `${STYLE_BASE} This is the end of a sentence: finished, falling intonation, as before a full stop.`,
};
const TONE_PROMPTS = {
  lead: "Говори на русском языке, как носитель языка, без акцента. Спокойно, чётко и дружелюбно, как для ребёнка. Это начало фразы, которая продолжается дальше, поэтому интонация незавершённая. Прочитай только эти слова:",
  final: "Говори на русском языке, как носитель языка, без акцента. Спокойно, чётко и дружелюбно, как для ребёнка. Это конец фразы, интонация завершённая. Прочитай только эти слова:",
};

function findNestedAudioData(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.data === "string" && value.data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value.data)) return value.data;
  for (const child of Object.values(value)) {
    const found = findNestedAudioData(child);
    if (found) return found;
  }
  return null;
}

const apiKey = getGeminiApiKey();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class DailyQuotaExhausted extends Error {}

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

async function synthesize({ text, tone }) {
  // Gemini 3.8 TTS reads the input text verbatim, so the delivery instruction
  // goes in speech_metadata instead of being prepended to the text.
  const usesInteractionsApi = MODEL.startsWith("gemini-3.8-") && MODEL.endsWith("-tts");
  const response = usesInteractionsApi
    ? await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          model: MODEL,
          input: [{
            type: "user_input",
            content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: TONE_STYLES[tone] }] }],
          }],
          response_format: { type: "audio", mime_type: "audio/l16", sample_rate: SAMPLE_RATE },
          generation_config: { speech_config: [{ voice: VOICE, language: "ru-RU" }] },
        }),
      })
    : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${TONE_PROMPTS[tone]} ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { languageCode: "ru-RU", voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          },
        }),
      });
  if (response.status === 429) {
    const message = JSON.stringify(await response.json().catch(() => ({})));
    if (/PerDay|retry in \d+h/i.test(message)) throw new DailyQuotaExhausted(message.slice(0, 300));
    throw new Error(`rate limited: ${message.slice(0, 300)}`);
  }
  const data = await response.json();
  const audioData = usesInteractionsApi
    ? data?.output_audio?.data ?? data?.outputAudio?.data ?? findNestedAudioData(data)
    : data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error(`Gemini TTS error: ${JSON.stringify(data).slice(0, 500)}`);
  const pcmBytes = Buffer.from(audioData, "base64");
  // Every clip here is 1-3 words; a long result means the model read the
  // instruction aloud too, so refuse it rather than ship it.
  const seconds = pcmBytes.length / (SAMPLE_RATE * 2);
  if (seconds > 4) throw new Error(`got ${seconds.toFixed(1)}s of audio for "${text}" (instruction read aloud?)`);
  return pcmToMp3(pcmBytes);
}

const entries = KEYS ? AUDIO_ENTRIES.filter((entry) => KEYS.includes(entry.key)) : AUDIO_ENTRIES;
if (KEYS && entries.length !== KEYS.length) {
  const known = new Set(AUDIO_ENTRIES.map((entry) => entry.key));
  throw new Error(`Unknown --keys: ${KEYS.filter((key) => !known.has(key)).join(", ")}`);
}

mkdirSync(OUT_DIR, { recursive: true });
let generated = 0;
let skipped = 0;
let failed = 0;
let stoppedOnQuota = false;

for (const entry of entries) {
  const outputPath = join(OUT_DIR, `${entry.key}.mp3`);
  if (!FORCE && existsSync(outputPath)) { skipped++; continue; }
  process.stdout.write(`  ${entry.key} (${entry.tone}) "${entry.text}"… `);
  try {
    const mp3 = await synthesize(entry);
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

console.log(`✓ Daily orientation audio: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})${stoppedOnQuota ? " — quota exhausted" : ""}.`);
if (failed > 0 && !stoppedOnQuota) process.exitCode = 1;
