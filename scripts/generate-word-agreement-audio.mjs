// Synthesizes one .wav per word_agreement card (its full, correctly-filled
// sentence) via Google Cloud Text-to-Speech (WaveNet). Output feeds
// build-word-agreement-deck.mjs, which bundles any file it finds here into
// the deck zip.
//
// Uses the same service-account-based Cloud TTS setup as cardgen-studio
// (see cardgen-studio/scripts/generate-audio.mjs) rather than the
// consumer Gemini API key: that key's TTS model is capped at 100
// requests/day on the free tier (hit that wall mid-run — 100 generated,
// 175 to go, "retry in 18h"). Cloud TTS via this service account has no
// such daily ceiling.
//
// Service account: C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json
// (override with GOOGLE_TTS_SA_PATH env var)
//
// Usage: node scripts/generate-word-agreement-audio.mjs [--force] [--voice=ru-RU-Wavenet-D] [--rate=0.9]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";
import { ALL_CARDS } from "./word-agreement-content.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const OUT_DIR   = join(ROOT, "public/decks/_audio_src/word_agreement_ru");
const DEFAULT_SA_PATH = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
// Cloud TTS has generous limits (cardgen-studio uses 200ms between calls) —
// still pace requests a little to be a good citizen, no per-day ceiling to
// worry about here.
const RATE_LIMIT_DELAY_MS = 200;

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.find((a) => a.startsWith("--voice="));
const rateArg = args.find((a) => a.startsWith("--rate="));
// ru-RU-Chirp3-HD-Kore: Google's newest Russian voice generation (same
// underlying tech family as Gemini's own TTS, and literally the same voice
// name as the original Gemini pass) — WaveNet's stress/intonation was
// noticeably worse on a live listen, this is the fix.
const VOICE = voiceArg ? voiceArg.split("=")[1] : "ru-RU-Chirp3-HD-Kore";
const SPEAKING_RATE = rateArg ? parseFloat(rateArg.slice(7)) : 0.9;

const saPath = process.env.GOOGLE_TTS_SA_PATH || DEFAULT_SA_PATH;
if (!existsSync(saPath)) {
  console.error(`Service account file not found: ${saPath}`);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(saPath, "utf8"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Service Account JWT auth (same flow as cardgen-studio/scripts/generate-audio.mjs)
// ---------------------------------------------------------------------------
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiry - 60) return cachedToken;

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(header + "." + payload);
  const jwt = header + "." + payload + "." + sign.sign(sa.private_key, "base64url");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });

  const body = await resp.json();
  if (!body.access_token) throw new Error("Failed to get access token: " + JSON.stringify(body));

  cachedToken = body.access_token;
  tokenExpiry = now + (body.expires_in || 3600);
  return cachedToken;
}

// LINEAR16 comes back as a complete WAV file (header included), so no
// manual PCM->WAV wrapping is needed here, unlike the old Gemini path.
async function synthesize(text) {
  const token = await getAccessToken();
  const resp = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ru-RU", name: VOICE },
      audioConfig: { audioEncoding: "LINEAR16", speakingRate: SPEAKING_RATE },
    }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(`Cloud TTS error ${resp.status}: ${body.error?.message || JSON.stringify(body)}`);
  if (!body.audioContent) throw new Error("No audioContent in response");
  return Buffer.from(body.audioContent, "base64");
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
  await sleep(RATE_LIMIT_DELAY_MS);
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed (voice: ${VOICE})`);
console.log(`output: ${OUT_DIR}`);
if (failed > 0) process.exit(1);
