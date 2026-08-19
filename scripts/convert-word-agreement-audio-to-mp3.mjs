// One-off: re-encodes every already-generated word_agreement .wav (raw PCM,
// 16-bit/24kHz/mono, from the pre-MP3 version of generate-word-agreement-audio.mjs)
// into .mp3 in place, then removes the .wav. Doesn't touch Gemini/quota at
// all — this is purely a local re-encode of audio already paid for.
//
// Usage: node scripts/convert-word-agreement-audio-to-mp3.mjs
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const DIR     = join(ROOT, "public/decks/_audio_src/word_agreement_ru");
const MP3_KBPS = 64;

function pcmToMp3(pcmBytes, sampleRate) {
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.length / 2);
  const encoder = new Mp3Encoder(1, sampleRate, MP3_KBPS);
  const chunkSize = 1152;
  const parts = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    const mp3buf = encoder.encodeBuffer(samples.subarray(i, i + chunkSize));
    if (mp3buf.length > 0) parts.push(Buffer.from(mp3buf));
  }
  const end = encoder.flush();
  if (end.length > 0) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

// Minimal WAV parser — just enough to pull sampleRate + raw PCM data out of
// the 44-byte canonical header these files all share.
function parseWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  const sampleRate = buf.readUInt32LE(24);
  const dataSize = buf.readUInt32LE(40);
  return { sampleRate, pcm: buf.subarray(44, 44 + dataSize) };
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".wav"));
let converted = 0, totalWavBytes = 0, totalMp3Bytes = 0, failed = 0;

for (const f of files) {
  const wavPath = join(DIR, f);
  const mp3Path = wavPath.replace(/\.wav$/, ".mp3");
  try {
    const wavBuf = readFileSync(wavPath);
    const { sampleRate, pcm } = parseWav(wavBuf);
    const mp3 = pcmToMp3(pcm, sampleRate);
    writeFileSync(mp3Path, mp3);
    unlinkSync(wavPath);
    totalWavBytes += statSync(mp3Path).size > 0 ? wavBuf.length : 0;
    totalMp3Bytes += mp3.length;
    converted++;
  } catch (err) {
    console.log(`  FAILED ${f}: ${err.message}`);
    failed++;
  }
}

console.log(`\nconverted: ${converted}, failed: ${failed}`);
console.log(`total: ${(totalWavBytes / 1024 / 1024).toFixed(1)}MB wav -> ${(totalMp3Bytes / 1024 / 1024).toFixed(1)}MB mp3 (${(totalMp3Bytes / totalWavBytes * 100).toFixed(0)}%)`);
