// «Плюс и минус» phrases and the signs «плюс» / «минус», in the owner's
// ElevenLabs voice (same voice, model and delivery family as
// scripts/generate-place-value-numbers-elevenlabs.mjs, whose number clips this
// topic reuses). Texts: src/topics/renderers/addition_subtraction/audioPhraseBank.js.
// Each clip is then trimmed of silence and brought to -16 LUFS (ffmpeg), so the
// player sets the pauses and no clip is louder than the next.
// Output: public/audio/addition-subtraction-voice/<key>.mp3
//
// The 2026-11-11 bank was made through the ElevenLabs connector with the same
// voice, model, tag and processing (two takes per phrase, take A shipped unless
// the owner picked B) — this script reproduces it outside that session.
//
// Auth: ELEVENLABS_API_KEY from the environment, sent as `xi-api-key`.
// Resumable: existing files are skipped unless --force.
// Usage: node scripts/generate-addition-subtraction-voice-elevenlabs.mjs [--keys=was_2,plus] [--force]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PHRASE_ENTRIES, SIGN_ENTRIES } from "../src/topics/renderers/addition_subtraction/audioPhraseBank.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const TAG = "[calm, clear, like a teacher talking to a young child]";
const TARGET_LUFS = -16;
const OUT_DIR = resolve(ROOT, "public/audio/addition-subtraction-voice");
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const KEYS = args.keys ? new Set(String(args.keys).split(",")) : null;
const apiKey = process.env.ELEVENLABS_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synthesize(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg", ...(apiKey ? { "xi-api-key": apiKey } : {}) },
      body: JSON.stringify({ text: `${TAG} ${text}`, model_id: MODEL_ID }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    if (attempt >= 4 || ![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    await sleep(2000 * 2 ** attempt);
  }
}

const edge = (keep) => `silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:start_silence=${keep}`;
function measure(file) {
  // ebur128 prints its summary on stderr; spawnSync keeps it even on success.
  const { stderr } = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const integrated = Number([...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]);
  const peak = Number([...stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)[1]);
  return { integrated, peak };
}
// Single words sit between number clips: keep as little silence as those (20 / 60 ms).
function finish(raw, out, isWord) {
  const [lead, tail] = isWord ? [0.02, 0.06] : [0.05, 0.12];
  const trimmed = `${out}.trim.wav`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", `${edge(lead)},areverse,${edge(tail)},areverse`, trimmed]);
  const { integrated, peak } = measure(trimmed);
  const gain = Math.min(TARGET_LUFS - integrated, -1 - peak);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", trimmed, "-af", `volume=${gain.toFixed(2)}dB`, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", `${out}.tmp.mp3`]);
  renameSync(`${out}.tmp.mp3`, out);
  rmSync(trimmed);
}

mkdirSync(OUT_DIR, { recursive: true });
const signKeys = new Set(SIGN_ENTRIES.map(({ key }) => key));
for (const { key, text } of [...PHRASE_ENTRIES, ...SIGN_ENTRIES]) {
  if (KEYS && !KEYS.has(key)) continue;
  const file = join(OUT_DIR, `${key}.mp3`);
  if (existsSync(file) && !args.force) continue;
  const raw = `${file}.raw.mp3`;
  writeFileSync(raw, await synthesize(text));
  finish(raw, file, signKeys.has(key));
  rmSync(raw);
  console.log(`${key}  ←  ${text}`);
}
