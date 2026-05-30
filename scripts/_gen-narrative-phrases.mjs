import { createSign } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";

const SA_PATH = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const OUT_DIR = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/projects/first_then/zip_build/audio";

const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${sign.sign(sa.private_key, "base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` });
  return (await r.json()).access_token;
}

async function synth(token, text, outFile, rate = 0.88) {
  const req = {
    input: { text },
    voice: { languageCode: "ru-RU", name: "ru-RU-Wavenet-D" },
    audioConfig: { audioEncoding: "MP3", speakingRate: rate },
  };
  const resp = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  const data = await resp.json();
  if (!data.audioContent) throw new Error(JSON.stringify(data));
  writeFileSync(`${OUT_DIR}/${outFile}`, Buffer.from(data.audioContent, "base64"));
  console.log(`  ✓ ${outFile}`);
}

const token = await getToken();

// Connector phrases
await synth(token, "Сначала я",  "phrase_first.mp3", 0.85);
await synth(token, "потом",      "phrase_then.mp3",  0.85);

// Full sentences per scenario
await synth(token,
  "Сначала я просыпаюсь, потом иду в школу, потом иду в бассейн, потом занимаюсь, потом ложусь спать.",
  "sentence_my_day_pool.mp3");
await synth(token,
  "Сначала я просыпаюсь, потом иду в школу, потом иду на спорт, потом занимаюсь, потом ложусь спать.",
  "sentence_my_day_sport.mp3");
await synth(token,
  "Сначала я просыпаюсь, потом иду в школу, потом иду гулять, потом занимаюсь, потом ложусь спать.",
  "sentence_my_day_walk.mp3");
await synth(token,
  "Сначала я просыпаюсь, потом иду в школу, потом прихожу домой, потом занимаюсь, потом ложусь спать.",
  "sentence_my_day_home_arrive.mp3");
await synth(token,
  "Сначала я беру щётку, потом выдавливаю пасту, потом чищу зубы, потом полощу рот, потом вытираюсь.",
  "sentence_teeth_brushing.mp3");
await synth(token,
  "Сначала я раздеваюсь, потом включаю воду, потом моюсь, потом вытираюсь, потом одеваюсь.",
  "sentence_shower.mp3");

console.log("\ndone — 8 files");
