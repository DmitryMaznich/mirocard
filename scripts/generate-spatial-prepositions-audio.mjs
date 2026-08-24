// Creates compact MP3 prompts and language models for «Где предмет?».
// Identical constructions share one file across core and transfer cards.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import { ALL_CARDS } from "./spatial-prepositions-content.mjs";

const OUT_DIR = "public/decks/_audio_src/spatial_prepositions_ru";
const MODEL = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000;
const MP3_KBPS = 64;
const MIN_DELAY_MS = 6500;
const MAX_RETRIES = 4;
const VOICE = process.argv.find((arg) => arg.startsWith("--voice="))?.split("=")[1] ?? "Kore";
const force = process.argv.includes("--force");

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

async function synthesizeOnce(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Прочитай спокойно, чётко и дружелюбно, как для ребёнка: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
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
  const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    // Gemini occasionally returns finishReason OTHER without audio for an
    // otherwise valid short prompt. Retrying produces a normal response.
    const error = new Error(`Gemini TTS error: ${JSON.stringify(data).slice(0, 500)}`);
    error.retryable = true;
    throw error;
  }
  return pcmToMp3(Buffer.from(inlineData.data, "base64"));
}

async function synthesize(text) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await synthesizeOnce(text);
    } catch (error) {
      const isNetworkTimeout = /fetch failed|UND_ERR_CONNECT_TIMEOUT/i.test(
        `${error?.message ?? ""} ${error?.cause?.code ?? ""}`,
      );
      if (error instanceof DailyQuotaExhausted || (!error.retryable && !isNetworkTimeout) || attempt === MAX_RETRIES) throw error;
      await sleep(5000 * attempt);
    }
  }
  throw new Error("Unreachable");
}

const entriesByPath = new Map();
for (const card of ALL_CARDS) {
  entriesByPath.set(card.questionAudio, card.question);
  entriesByPath.set(card.modelAudio, card.model);
  entriesByPath.set(card.recognizeAudio, card.recognizePrompt);
}

mkdirSync(OUT_DIR, { recursive: true });
let generated = 0;
let skipped = 0;
for (const [path, text] of entriesByPath) {
  const outPath = join(OUT_DIR, path.split("/").at(-1));
  if (!force && existsSync(outPath)) {
    skipped++;
    continue;
  }
  process.stdout.write(`  gen ${path}… `);
  try {
    const mp3 = await synthesize(text);
    writeFileSync(outPath, mp3);
    generated++;
    console.log(`${mp3.length} bytes`);
  } catch (error) {
    if (error instanceof DailyQuotaExhausted) {
      console.log("daily quota exhausted; re-run tomorrow to continue");
      break;
    }
    throw error;
  }
  await sleep(MIN_DELAY_MS);
}

console.log(`✓ Audio: ${generated} generated, ${skipped} already present, ${entriesByPath.size} total (voice: ${VOICE}).`);
