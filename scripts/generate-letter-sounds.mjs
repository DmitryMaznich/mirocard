// Generates sing-check audio for vowel_consonant renderer.
// Vowels  → slow sustained sound (аааааааааааа)
// Consonants → fast stumbling (б б б)
// Output: public/sounds/letters/<LETTER>.mp3
import { createSign } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const SA_PATH   = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const OUT_DIR   = join(ROOT, "public/sounds/letters");
const VOICE       = "ru-RU-Wavenet-D";
const VOICE_VOWEL = "ru-RU-Wavenet-A"; // female — sounds more musical for sustained vowels

const VOWELS = new Set(["А","Е","Ё","И","О","У","Ы","Э","Ю","Я"]);

const LETTERS = [
  "А","Б","В","Г","Д","Е","Ё","Ж","З","И",
  "Й","К","Л","М","Н","О","П","Р","С","Т",
  "У","Ф","Х","Ц","Ч","Ш","Щ","Ъ","Ы","Ь",
  "Э","Ю","Я",
];

function buildRequest(letter) {
  const lo = letter.toLowerCase();
  if (VOWELS.has(letter)) {
    return {
      input: { ssml: `<speak><prosody rate="8%" pitch="+8st">${lo}</prosody></speak>` },
      voice: { languageCode: "ru-RU", name: VOICE_VOWEL },
      audioConfig: { audioEncoding: "MP3" },
    };
  }
  // Signs (Ъ, Ь) → neutral single pronunciation
  if (letter === "Ъ" || letter === "Ь") {
    return {
      input: { text: lo },
      voice: { languageCode: "ru-RU", name: VOICE },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.85 },
    };
  }
  // Consonants → stumbling repetition
  return {
    input: { text: `${lo} ${lo} ${lo}` },
    voice: { languageCode: "ru-RU", name: VOICE },
    audioConfig: { audioEncoding: "MP3", speakingRate: 1.65, pitch: -1.5 },
  };
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
  _token = data.access_token;
  _tokenExpiry = now + (data.expires_in || 3600);
  return _token;
}

async function synthesize(sa, req) {
  const token = await getToken(sa);
  const resp = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
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
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const force = process.argv.includes("--force");
let generated = 0;
let skipped   = 0;

for (const letter of LETTERS) {
  const outPath = join(OUT_DIR, `${letter}.mp3`);
  if (!force && existsSync(outPath)) {
    console.log(`  skip  ${letter}`);
    skipped++;
    continue;
  }
  process.stdout.write(`  gen   ${letter} (${VOWELS.has(letter) ? "vowel" : "consonant"})... `);
  const buf = await synthesize(sa, buildRequest(letter));
  writeFileSync(outPath, buf);
  console.log(`${buf.length} bytes`);
  generated++;
}

console.log(`\ndone: ${generated} generated, ${skipped} skipped`);
console.log(`output: ${OUT_DIR}`);
