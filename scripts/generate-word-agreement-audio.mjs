// Synthesizes one .wav per word_agreement card (its full, correctly-filled
// sentence) via Gemini's native TTS. Output feeds build-word-agreement-deck.mjs,
// which bundles any file it finds here into the deck zip.
//
// Uses GEMINI_API_KEY via scripts/lib/gemini-key.mjs — the same key the
// project's other generate-*.mjs scripts use for Gemini image generation.
//
// Gemini TTS returns raw PCM (16-bit signed LE, mono, 24kHz) as base64 —
// there's no MP3/WAV encoding on the API side, so we wrap it in a minimal
// WAV header ourselves (pcmToWav below) rather than pull in ffmpeg.
//
// The free/paid-Tier-1 key for this model is hard-capped at 100
// CreateVoice requests/day (GenerateRequestsPerDayPerProjectPerModel) —
// not a raisable quota, only lifted by a Tier 2 upgrade. Once that daily
// cap is hit, every further request fails the same way ("retry in ~18h"),
// so this script detects that specific error and stops the run instead of
// burning through the rest of the card list retrying a wall that won't
// move today. Re-running the next day (still without --force) picks up
// exactly where it left off, since already-written files are skipped.
//
// Usage: node scripts/generate-word-agreement-audio.mjs [--force] [--voice=Kore]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import { ALL_CARDS } from "./word-agreement-content.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, "..");
const OUT_DIR  = join(ROOT, "public/decks/_audio_src/word_agreement_ru");
const MODEL    = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000;

// Stay comfortably under the 10 requests/min pacing limit alongside the
// daily cap.
const MIN_DELAY_MS = 6500;
const MAX_RETRIES  = 4;

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.find((a) => a.startsWith("--voice="));
// Prebuilt Gemini voice name. Pick something warm/clear for a child app;
// swap freely — this is the only place it's set.
const VOICE = voiceArg ? voiceArg.split("=")[1] : "Kore";

const apiKey = getGeminiApiKey();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wrap raw 16-bit PCM in a minimal 44-byte WAV (RIFF) header.
function pcmToWav(pcmBytes, sampleRate = SAMPLE_RATE, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + pcmBytes.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + pcmBytes.length, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);            // subchunk1 size (PCM)
  buf.writeUInt16LE(1, 20);             // audio format = 1 (PCM)
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(pcmBytes.length, 40);
  pcmBytes.copy(buf, 44);
  return buf;
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
    // Per-day cap ("PerDay" in the violated quota's id, or Google's own
    // "retry in ~Nh" phrasing) vs. an ordinary per-minute rate limit that's
    // just worth a short backoff.
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
  return pcmToWav(Buffer.from(part.data, "base64"));
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

let generated = 0;
let skipped   = 0;
let failed    = 0;
let stoppedOnQuota = false;

for (const card of ALL_CARDS) {
  const outPath = join(OUT_DIR, `${card.id}.wav`);
  if (!force && existsSync(outPath)) {
    skipped++;
    continue;
  }
  process.stdout.write(`  gen   ${card.id}  "${card.label}"... `);
  try {
    const wav = await synthesize(card.label);
    writeFileSync(outPath, wav);
    console.log(`${wav.length} bytes`);
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
