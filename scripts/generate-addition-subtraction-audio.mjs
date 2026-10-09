// Generates the spoken-number word bank for addition_subtraction's audio
// task ("operation_audio" — a diktor reads out "два плюс одиннадцать").
// Only single words are recorded (0-20, each round ten 30-100, "плюс",
// "минус") — any two-digit number is composed from two of these at
// playback time (see src/topics/renderers/addition_subtraction/audioNumbers.js),
// so this script never needs to regenerate anything when the numbers used
// in a session change.
// Output: public/audio/addition-subtraction/<key>.mp3
import { createSign } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const SA_PATH   = process.env.GOOGLE_APPLICATION_CREDENTIALS || "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT_DIR   = resolve(ROOT, arg("out-dir") ?? "public/audio/addition-subtraction");
const VOICE     = arg("voice") ?? "ru-RU-Wavenet-D";
const RATE      = Number(arg("rate") ?? "0.9");
const KEYS      = arg("keys")?.split(",").filter(Boolean);
if (!Number.isFinite(RATE) || RATE < 0.25 || RATE > 4) throw new Error("Speaking rate must be between 0.25 and 4.");

const ONES  = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS  = { 20: "двадцать", 30: "тридцать", 40: "сорок", 50: "пятьдесят", 60: "шестьдесят", 70: "семьдесят", 80: "восемьдесят", 90: "девяносто" };

const WORDS = {
  ...Object.fromEntries(ONES.map((word, n) => [`n${n}`, word])),
  ...Object.fromEntries(TEENS.map((word, i) => [`n${10 + i}`, word])),
  ...Object.fromEntries(Object.entries(TENS).map(([n, word]) => [`n${n}`, word])),
  n100: "сто",
  plus: "плюс",
  minus: "минус",
};

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
  if (!resp.ok || !data.access_token) throw new Error(`Google authorization failed (${resp.status}): ${data.error ?? "no access token"}`);
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
      audioConfig: { audioEncoding: "MP3", speakingRate: RATE },
    }),
  });
  const data = await resp.json();
  if (!data.audioContent) throw new Error("TTS error: " + JSON.stringify(data));
  return Buffer.from(data.audioContent, "base64");
}

if (!existsSync(SA_PATH)) {
  console.error("google-tts-sa.json not found at", SA_PATH);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
if (process.argv.includes("--list-voices")) {
  const token = await getToken(sa);
  const response = await fetch("https://texttospeech.googleapis.com/v1/voices?languageCode=ru-RU", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Voice list failed (${response.status})`);
  const data = await response.json();
  console.log(JSON.stringify(data.voices?.map(({ name, ssmlGender }) => ({ name, ssmlGender })), null, 2));
  process.exit(0);
}
if (KEYS?.some((key) => !Object.hasOwn(WORDS, key))) throw new Error("Unknown --keys entry.");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const force = process.argv.includes("--force");
let generated = 0;
let skipped   = 0;

for (const [key, word] of Object.entries(WORDS)) {
  if (KEYS && !KEYS.includes(key)) continue;
  const outPath = join(OUT_DIR, `${key}.mp3`);
  if (!force && existsSync(outPath)) {
    console.log(`  skip  ${key} (${word})`);
    skipped++;
    continue;
  }
  process.stdout.write(`  gen   ${key} (${word})... `);
  const buf = await synthesize(sa, word);
  writeFileSync(outPath, buf);
  console.log(`${buf.length} bytes`);
  generated++;
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped`);
console.log(`output: ${OUT_DIR}`);
