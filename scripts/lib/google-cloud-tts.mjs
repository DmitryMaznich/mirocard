import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

// Credentials stay outside the repository. Never log tokens or signed assertions.
export function createGoogleCloudTts() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
  const serviceAccount = JSON.parse(readFileSync(credentialPath, "utf8"));
  let accessToken;
  let expiresAt = 0;
  async function getToken() {
    const now = Math.floor(Date.now() / 1000);
    if (accessToken && now < expiresAt - 60) return accessToken;
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })).toString("base64url");
    const signer = createSign("RSA-SHA256"); signer.update(`${header}.${payload}`);
    const assertion = `${header}.${payload}.${signer.sign(serviceAccount.private_key, "base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(60_000) });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error(`Google authorization failed (${response.status}): ${data.error ?? "no token"}`);
    accessToken = data.access_token; expiresAt = now + Number(data.expires_in ?? 3600);
    return accessToken;
  }
  return {
    async synthesize(input, { voice = "ru-RU-Wavenet-A", rate = 0.95, encoding = "MP3" } = {}) {
      const token = await getToken();
      const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ input, voice: { languageCode: "ru-RU", name: voice }, audioConfig: { audioEncoding: encoding, speakingRate: rate } }), signal: AbortSignal.timeout(60_000) });
      const data = await response.json();
      if (!response.ok || !data.audioContent) throw new Error(`Google TTS failed (${response.status}): ${data.error?.message ?? "no audio"}`);
      return Buffer.from(data.audioContent, "base64");
    },
  };
}
