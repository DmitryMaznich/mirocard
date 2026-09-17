// Synthesizes one .mp3 per "Диктант" dictation item (letters, words, text
// sentences) via Gemini's native TTS. Output feeds dictationAudioUrl() in
// src/topics/renderers/propis/dictationAudio.js -- these are static assets
// shipped with the app itself (like addition_subtraction's number words),
// NOT part of propis's deck zip, so nothing here touches build-propis-deck.mjs.
//
// Same pipeline as generate-word-agreement-audio.mjs: raw PCM from Gemini TTS,
// encoded to MP3 via @breezystack/lamejs, GEMINI_API_KEY via lib/gemini-key.mjs,
// resumable (already-written files skipped without --force), and the same
// daily-CreateVoice-quota detection that stops the run cleanly instead of
// retrying into a wall.
//
// Content is read straight from tools/propis/topic.json -- the same source
// dictationAudio.js's key functions and engine.js's dictation branch use, so
// there's no separate content list to keep in sync:
//   - letters: every `cards[]` entry with type "letter" and captured strokes
//     (73 total -- uppercase/lowercase are separate cards, each with its own
//     clip). The SPOKEN TEXT is "заглавная <letter>" / "строчная <letter>",
//     not the bare character -- a lone Cyrillic letter with nothing else
//     around it makes Gemini TTS read garbage, not a clean letter name
//     (reported 2026-09-17, this script originally sent card.label alone).
//   - words: every `words[]` entry (249), spoken as-is.
//   - texts: every `texts[]` entry (24), split into sentences the same way
//     engine.js does (dictationAudio.js's splitIntoSentences) -- one clip per
//     SENTENCE, not per whole text, matching the session view's sentence-by-
//     sentence playback with pauses between them.
//
// Usage: node scripts/generate-propis-dictation-audio.mjs [--force] [--voice=Kore] [--only=letters|words|texts]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import {
  letterDictationKey,
  isUpperCaseLetterCard,
  wordDictationKey,
  textSentenceDictationKey,
  splitIntoSentences,
} from "../src/topics/renderers/propis/dictationAudio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, "..");
const OUT_DIR  = join(ROOT, "public/audio/propis-dictation");
const TOPIC_JSON_PATH = join(ROOT, "tools/propis/topic.json");
const MODEL    = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000;
const MP3_KBPS = 64;

const MIN_DELAY_MS = 6500;
const MAX_RETRIES  = 4;

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.find((a) => a.startsWith("--voice="));
const VOICE = voiceArg ? voiceArg.split("=")[1] : "Kore";
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1] : null; // "letters" | "words" | "texts" | null (all)

const apiKey = getGeminiApiKey();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pcmToMp3(pcmBytes, sampleRate = SAMPLE_RATE) {
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.length / 2);
  const encoder = new Mp3Encoder(1, sampleRate, MP3_KBPS);
  const chunkSize = 1152;
  const parts = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    const chunk = samples.subarray(i, i + chunkSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) parts.push(Buffer.from(mp3buf));
  }
  const end = encoder.flush();
  if (end.length > 0) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

class DailyQuotaExhausted extends Error {}

async function synthesizeOnce(text) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Прочитай спокойно, чётко и дружелюбно, как для ребёнка: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
          },
        },
      }),
    }
  );

  if (resp.status === 429) {
    const body = await resp.json().catch(() => ({}));
    const msg = JSON.stringify(body);
    if (/PerDay|retry in \d+h/i.test(msg)) {
      throw new DailyQuotaExhausted(msg.slice(0, 300));
    }
    const err = new Error("rate limited: " + msg.slice(0, 300));
    err.retryable = true;
    throw err;
  }

  const data = await resp.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) {
    throw new Error("Gemini TTS error: " + JSON.stringify(data).slice(0, 500));
  }
  return pcmToMp3(Buffer.from(part.data, "base64"));
}

async function synthesize(text) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await synthesizeOnce(text);
    } catch (err) {
      if (err instanceof DailyQuotaExhausted) throw err;
      if (!err.retryable || attempt === MAX_RETRIES) throw err;
      const backoffMs = 5000 * attempt;
      console.log(`    retry ${attempt}/${MAX_RETRIES - 1} after ${backoffMs}ms (${err.message.slice(0, 80)})`);
      await sleep(backoffMs);
    }
  }
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const topic = JSON.parse(readFileSync(TOPIC_JSON_PATH, "utf8"));

function buildEntries() {
  const entries = [];
  if (!ONLY || ONLY === "letters") {
    const letters = topic.cards.filter((c) => c.type === "letter" && Array.isArray(c.strokes) && c.strokes.length > 0);
    for (const card of letters) {
      // Bare `card.label` (a single character like "а") was the actual bug reported
      // 2026-09-17: Gemini TTS handed a lone Cyrillic letter with no other words around
      // it produces garbage, not a clean letter-name reading. The spoken text needs the
      // case word said out loud -- "заглавная А" / "строчная а" -- matching the user's
      // original design call (dictationAudio.js's own header comment already said this;
      // this script just wasn't actually building that phrase before).
      const caseWord = isUpperCaseLetterCard(card) ? "заглавная" : "строчная";
      entries.push({ id: letterDictationKey(card), text: `${caseWord} ${card.label}` });
    }
  }
  if (!ONLY || ONLY === "words") {
    for (const w of topic.words) {
      entries.push({ id: wordDictationKey(w), text: w.word });
    }
  }
  if (!ONLY || ONLY === "texts") {
    for (const t of topic.texts) {
      const sentences = splitIntoSentences(t.text);
      sentences.forEach((sentence, i) => {
        entries.push({ id: textSentenceDictationKey(t, i), text: sentence });
      });
    }
  }
  return entries;
}

const entries = buildEntries();

let generated = 0;
let skipped   = 0;
let failed    = 0;
let stoppedOnQuota = false;

for (const entry of entries) {
  const outPath = join(OUT_DIR, `${entry.id}.mp3`);
  if (!force && existsSync(outPath)) {
    skipped++;
    continue;
  }
  process.stdout.write(`  gen   ${entry.id}  "${entry.text}"... `);
  try {
    const mp3 = await synthesize(entry.text);
    writeFileSync(outPath, mp3);
    console.log(`${mp3.length} bytes`);
    generated++;
  } catch (err) {
    if (err instanceof DailyQuotaExhausted) {
      console.log("DAILY QUOTA EXHAUSTED — stopping here, re-run tomorrow to continue.");
      stoppedOnQuota = true;
      break;
    }
    console.log(`FAILED: ${err.message}`);
    failed++;
  }
  await sleep(MIN_DELAY_MS);
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed, ${entries.length} total (voice: ${VOICE})${stoppedOnQuota ? " — stopped on daily quota" : ""}`);
console.log(`output: ${OUT_DIR}`);
if (failed > 0 && !stoppedOnQuota) process.exit(1);
