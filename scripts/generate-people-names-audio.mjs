// Synthesizes Gemini TTS audio for people_names: one .mp3 per card for its
// category sentence ("Это мальчик.") and, where the card names a person, a
// second .mp3 for its person-only sentence ("Это Петя."). Output feeds
// build-people-names-deck.mjs, which bundles any file it finds here into the
// deck zip and sets card.audio / card.personAudio accordingly.
//
// Same Gemini TTS pipeline as generate-word-agreement-audio.mjs (see that
// file for the API/quota notes) - PCM -> MP3 via lamejs, same daily-quota
// detection and resume-by-skipping-existing-files behavior.
//
// Usage: node scripts/generate-people-names-audio.mjs [--force] [--voice=Kore]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, "..");
const TOPIC_PATH = join(ROOT, "tools/people_names/topic.json");
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

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf8"));

// One entry per sentence to record: the category line for every card, plus
// the person-only line for cards that name a specific person (all 8 today).
function audioEntriesFor(card) {
  const entries = [];
  if (card.speech) entries.push({ id: card.id, text: card.speech });
  if (card.personSpeech) entries.push({ id: `${card.id}_person`, text: card.personSpeech });
  return entries;
}

let generated = 0;
let skipped   = 0;
let failed    = 0;
let stoppedOnQuota = false;

for (const card of topic.cards) {
  for (const entry of audioEntriesFor(card)) {
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
  if (stoppedOnQuota) break;
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})${stoppedOnQuota ? " — stopped on daily quota" : ""}`);
console.log(`output: ${OUT_DIR}`);
if (failed > 0 && !stoppedOnQuota) process.exit(1);
