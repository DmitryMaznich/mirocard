import { createSign } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";

const SA_PATH = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${sign.sign(sa.private_key, "base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  return (await r.json()).access_token;
}

async function synth(token, ssml, voice, outFile) {
  const req = {
    input: { ssml: `<speak>${ssml}</speak>` },
    voice: { languageCode: "ru-RU", name: voice },
    audioConfig: { audioEncoding: "MP3" },
  };
  const resp = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  const data = await resp.json();
  if (!data.audioContent) throw new Error(JSON.stringify(data));
  writeFileSync(outFile, Buffer.from(data.audioContent, "base64"));
  console.log(`  wrote ${outFile}`);
}

const token = await getToken();

// Variants to compare for letter О
await synth(token, `<prosody rate="12%" pitch="+6st">о</prosody>`,  "ru-RU-Wavenet-A", "public/sounds/letters/О_v1_ssml_A.mp3");
await synth(token, `<prosody rate="12%" pitch="+6st">о</prosody>`,  "ru-RU-Wavenet-D", "public/sounds/letters/О_v2_ssml_D.mp3");
await synth(token, `<prosody rate="8%"  pitch="+8st">о</prosody>`,  "ru-RU-Wavenet-A", "public/sounds/letters/О_v3_slower_A.mp3");
await synth(token, `<prosody rate="12%" pitch="+6st">оооо</prosody>`, "ru-RU-Wavenet-A", "public/sounds/letters/О_v4_repeat_A.mp3");

console.log("done — 4 variants in public/sounds/letters/");
