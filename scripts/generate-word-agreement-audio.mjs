// Synthesizes one mp3 per word_agreement card (its full, correctly-filled
// sentence) via Google Cloud TTS (WaveNet), same approach as
// scripts/generate-letter-sounds.mjs. Output feeds build-word-agreement-deck.mjs,
// which bundles any file it finds here into the deck zip.
//
// Credentials, in priority order:
//   1. GOOGLE_TTS_SA_JSON  — full service-account JSON as a string (for cloud
//      sessions: set this as an environment secret, no local file needed)
//   2. GOOGLE_TTS_SA_PATH  — path to the service-account JSON file
//   3. the same local path the rest of this project's generate-*.mjs scripts use
//
// Usage: node scripts/generate-word-agreement-audio.mjs [--force]
import { createSign } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CARDS } from "./word-agreement-content.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, "..");
const FALLBACK_SA_PATH = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const OUT_DIR     = join(ROOT, "public/decks/_audio_src/word_agreement_ru");
const VOICE       = "ru-RU-Wavenet-D";

function loadServiceAccount() {
  if (process.env.GOOGLE_TTS_SA_JSON) {
    return JSON.parse(process.env.GOOGLE_TTS_SA_JSON);
  }
  const path = process.env.GOOGLE_TTS_SA_PATH || FALLBACK_SA_PATH;
  if (!existsSync(path)) {
    console.error("No Google TTS credentials found.");
    console.error("Set GOOGLE_TTS_SA_JSON (full JSON as a string) or GOOGLE_TTS_SA_PATH,");
    console.error(`or place the key at ${FALLBACK_SA_PATH}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

let _token = null;
let _tokenExpiry = 0;

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExpiry - 60) return _token;
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${sign.sign(sa.private_key, "base64url")}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("OAuth error: " + JSON.stringify(data));
  _token = data.access_token;
  _tokenExpiry = now + (data.expires_in || 3600);
  return _token;
}

async function synthesize(sa, text) {
  const token = await getToken(sa);
  const resp = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ru-RU", name: VOICE },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.92 },
    }),
  });
  const data = await resp.json();
  if (!data.audioContent) throw new Error("TTS error: " + JSON.stringify(data));
  return Buffer.from(data.audioContent, "base64");
}

const sa = loadServiceAccount();
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const force = process.argv.includes("--force");
let generated = 0;
let skipped   = 0;
let failed    = 0;

for (const card of ALL_CARDS) {
  const outPath = join(OUT_DIR, `${card.id}.mp3`);
  if (!force && existsSync(outPath)) {
    skipped++;
    continue;
  }
  process.stdout.write(`  gen   ${card.id}  "${card.label}"... `);
  try {
    const buf = await synthesize(sa, card.label);
    writeFileSync(outPath, buf);
    console.log(`${buf.length} bytes`);
    generated++;
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped, ${failed} failed`);
console.log(`output: ${OUT_DIR}`);
if (failed > 0) process.exit(1);
