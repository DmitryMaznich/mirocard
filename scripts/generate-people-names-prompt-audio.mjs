// Synthesizes Gemini TTS audio for every fixed instruction/prompt phrase
// people_names' interactive modes (2, 3, 5, 6, 10, 11, 12) currently speak
// via live browser TTS (window.speechSynthesis) with no recorded fallback -
// the one gap left after generate-people-names-audio.mjs covered the
// intro/person_intro modes. Browser TTS voice quality/prosody varies wildly
// by device and was flagged as inappropriate for this app's audience.
//
// Unlike generate-people-names-audio.mjs (one recording per *card*), these
// phrases are shared across many cards/tasks, so this generates one file per
// *phrase*: 4 category prompts ("Покажи мальчика." etc, reused by every
// photo/pictogram/illustration/probe card of that concept), 8 person-name
// prompts ("Где Петя?" etc, one per named person), 1 fixed choose_name
// prompt ("Как зовут?"), and 2 fixed sort_by_attribute instructions.
//
// Same Gemini TTS pipeline as generate-people-names-audio.mjs (PCM -> MP3
// via lamejs, same daily-quota detection and resume-by-skipping behavior).
//
// Usage: node scripts/generate-people-names-prompt-audio.mjs [--force] [--voice=Kore]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, "..");
const OUT_DIR    = join(ROOT, "public/decks/_audio_src/people_names");
const MODEL      = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000;
const MP3_KBPS   = 64;

const MIN_DELAY_MS = 6500;
const MAX_RETRIES  = 4;

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.find((a) => a.startsWith("--voice="));
const VOICE = voiceArg ? voiceArg.split("=")[1] : "Kore";

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

const ENTRIES = [
  // Category prompts — find_n family (modes 2, 10, 11, 12). File name keyed
  // by conceptId, not card id, since build-people-names-deck.mjs attaches
  // the same file to every card of that concept.
  { id: "prompt_boy",   text: "Покажи мальчика." },
  { id: "prompt_girl",  text: "Покажи девочку." },
  { id: "prompt_man",   text: "Покажи мужчину." },
  { id: "prompt_woman", text: "Покажи женщину." },
  // Person-name prompts — find_person_by_name (mode 5), one per named person.
  { id: "where_peter",  text: "Где Петя?" },
  { id: "where_ilya",   text: "Где Илья?" },
  { id: "where_olga",   text: "Где Оля?" },
  { id: "where_lena",   text: "Где Лена?" },
  { id: "where_igor",   text: "Где Игорь?" },
  { id: "where_sergey", text: "Где Сергей?" },
  { id: "where_anna",   text: "Где Анна?" },
  { id: "where_marina", text: "Где Марина?" },
  // choose_name (mode 6) — single fixed prompt, not tied to any card.
  { id: "choose_name_prompt", text: "Как зовут?" },
  // sort_by_attribute (mode 3) — two fixed instructions depending on sortBy.
  { id: "sort_category", text: "Кто это?" },
  { id: "sort_age",      text: "Ребёнок или взрослый?" },
];

let generated = 0;
let skipped   = 0;
let failed    = 0;
let stoppedOnQuota = false;

for (const entry of ENTRIES) {
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

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})${stoppedOnQuota ? " — stopped on daily quota" : ""}`);
console.log(`output: ${OUT_DIR}`);
if (failed > 0 && !stoppedOnQuota) process.exit(1);
