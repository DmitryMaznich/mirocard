// Synthesizes one .wav per word_agreement card (its full, correctly-filled
// sentence) via Gemini's native TTS. Output feeds build-word-agreement-deck.mjs,
// which bundles any file it finds here into the deck zip.
//
// Needs GEMINI_API_KEY in the environment — the same key the project's other
// generate-*.mjs scripts use for Gemini image generation (see
// scripts/lib/gemini-key.mjs). No service account, no OAuth: just the key.
//
// Gemini TTS returns raw PCM (16-bit signed LE, mono, 24kHz) as base64 —
// there's no MP3/WAV encoding on the API side, so we wrap it in a minimal
// WAV header ourselves (pcmToWav below) rather than pull in ffmpeg.
//
// Usage: node scripts/generate-word-agreement-audio.mjs [--force] [--voice=Kore]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CARDS } from "./word-agreement-content.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, "..");
const OUT_DIR  = join(ROOT, "public/decks/_audio_src/word_agreement_ru");
const MODEL    = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000;

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.find((a) => a.startsWith("--voice="));
// Prebuilt Gemini voice name. Pick something warm/clear for a child app;
// swap freely — this is the only place it's set.
const VOICE = voiceArg ? voiceArg.split("=")[1] : "Kore";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Set GEMINI_API_KEY in the environment before running this script.");
  process.exit(1);
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

async function synthesize(text) {
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
  const data = await resp.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) {
    throw new Error("Gemini TTS error: " + JSON.stringify(data).slice(0, 500));
  }
  return pcmToWav(Buffer.from(part.data, "base64"));
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let generated = 0;
let skipped   = 0;
let failed    = 0;

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
    console.log(`FAILED: ${err.message}`);
    failed++;
  }
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})`);
console.log(`output: ${OUT_DIR}`);
if (failed > 0) process.exit(1);
