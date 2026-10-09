// A small listening trial only; the production dictation bank is never touched.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import { PROPIS_NATURAL_PILOT, naturalPilotPart } from "./lib/propis-natural-pilot-bank.mjs";

const directory = new URL("../public/audio/propis-natural-pilot/", import.meta.url);
const model = "gemini-3.8-flash-tts";
const voice = "Charon";
const keys = process.argv.find((arg) => arg.startsWith("--keys="))?.slice(7).split(",");
if (keys?.some((key) => !PROPIS_NATURAL_PILOT.some((entry) => entry.key === key))) throw new Error("Unknown pilot key");
mkdirSync(directory, { recursive: true });
for (const entry of PROPIS_NATURAL_PILOT) {
  if (keys && !keys.includes(entry.key)) continue;
  const path = new URL(`${entry.key}.wav`, directory);
  if (existsSync(path) && !process.argv.includes("--force")) { console.log(`skip ${entry.key}`); continue; }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": getGeminiApiKey() },
    body: JSON.stringify({ contents: [{ role: "user", parts: [naturalPilotPart(entry)] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice } } } }),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json();
  const audio = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!response.ok || !audio) throw new Error(`TTS failed (${response.status}): ${result.error?.message ?? result.candidates?.[0]?.finishReason ?? "no audio"}`);
  const bytes = Buffer.from(audio.data, "base64");
  if (audio.mimeType !== "audio/wav" || bytes.subarray(0, 4).toString() !== "RIFF" || bytes.length < 1000) throw new Error("Unexpected audio format");
  // Preserve the complete provider response: no clipping or postprocessing.
  writeFileSync(path, bytes);
  console.log(`${entry.key}: ${bytes.length} bytes (${model}, ${voice})`);
}
