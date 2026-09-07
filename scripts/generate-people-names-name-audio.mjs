// Synthesizes Gemini TTS audio for the 24 names used by the new
// "Мужское или женское имя?" mode - each name is read on its own (e.g.
// "Игорь."), used as the task prompt while the child taps the matching
// generic boy/girl photo. Replaces the old person_intro/find_person_by_name/
// choose_name modes, which bound a specific invented photo to a specific
// invented name - the goal now is the linguistic pattern (which names sound
// male vs. female), not memorizing 8 photo-to-name pairs.
//
// Same Gemini TTS pipeline as generate-people-names-audio.mjs and
// generate-people-names-prompt-audio.mjs.
//
// Usage: node scripts/generate-people-names-name-audio.mjs [--force] [--voice=Kore]
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

// id -> text. 12 male + 12 female, all unambiguous common Russian first
// names (no Саша/Женя/Валя-style names usable for either gender - those
// would contradict the exact pattern this mode is trying to teach).
const NAMES = [
  ["name_petya",  "Петя."],
  ["name_ilya",   "Илья."],
  ["name_igor",   "Игорь."],
  ["name_sergey", "Сергей."],
  ["name_dima",   "Дима."],
  ["name_maksim", "Максим."],
  ["name_vanya",  "Ваня."],
  ["name_kostya", "Костя."],
  ["name_misha",  "Миша."],
  ["name_artem",  "Артём."],
  ["name_denis",  "Денис."],
  ["name_grisha", "Гриша."],
  ["name_olya",   "Оля."],
  ["name_lena",   "Лена."],
  ["name_anna",   "Анна."],
  ["name_marina", "Марина."],
  ["name_katya",  "Катя."],
  ["name_masha",  "Маша."],
  ["name_nastya", "Настя."],
  ["name_dasha",  "Даша."],
  ["name_yulya",  "Юля."],
  ["name_tanya",  "Таня."],
  ["name_vera",   "Вера."],
  ["name_sonya",  "Соня."],
];

let generated = 0;
let skipped   = 0;
let failed    = 0;
let stoppedOnQuota = false;

for (const [id, text] of NAMES) {
  const outPath = join(OUT_DIR, `${id}.mp3`);
  if (!force && existsSync(outPath)) {
    skipped++;
    continue;
  }
  process.stdout.write(`  gen   ${id}  "${text}"... `);
  try {
    const mp3 = await synthesize(text);
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
