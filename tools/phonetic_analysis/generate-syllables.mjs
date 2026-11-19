// Syllable voice for «Буквы и звуки» (syllables/<слог>.mp3, picked up by build.mjs):
// every open syllable «consonant + vowel» the engine can build (src/topics/renderers/
// phonetic_analysis/syllables.js). A syllable «Диктант» already has (public/audio/
// propis-dictation/syl_<слог>.mp3, the owner's cloned voice) is copied; the rest are
// synthesized in the same voice with the dictation's syllable tag. A take can say the
// syllable twice (docs/testing/propis-phoneme-review.md): it is cut at its first pause.
// Then every new file is checked by speech recognition (scribe_v1).
//
// Usage: NODE_USE_ENV_PROXY=1 node tools/phonetic_analysis/generate-syllables.mjs [--only=ба,бу] [--force]
import { copyFileSync, existsSync, mkdirSync, openAsBlob, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { allSyllables } from "../../src/topics/renderers/phonetic_analysis/syllables.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const OUT = join(DIR, "syllables");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const TAG = "[calm, clear, like a teacher dictating to a first-grader]";
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const ONLY = arg("only") ? new Set(arg("only").split(",")) : null;
const FORCE = args.includes("--force");
const KEY = { "xi-api-key": process.env.ELEVENLABS_API_KEY || "via-proxy" };

async function synth(text) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "Content-Type": "application/json", ...KEY },
      body: JSON.stringify({ text: `${TAG} ${text}`, model_id: MODEL_ID }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt === 4) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

async function heard(file) {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "ru");
  fd.append("file", await openAsBlob(file), "a.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: KEY, body: fd });
  return ((await res.json()).text ?? "").toLowerCase().replace(/ё/g, "е").replace(/[^а-я]/g, "");
}

// Cut at the first inner pause (≥ 0.2 s at -40 dB): «Ба. Ба.» → «Ба.»
function cutAtFirstPause(file) {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1])).filter((s) => s > 0.15);
  if (!starts.length) return false;
  const tmp = `${file}.cut.mp3`;
  spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-t", String(starts[0] + 0.05), "-af", "afade=t=out:st=" + Math.max(0, starts[0] - 0.05) + ":d=0.1", tmp]);
  renameSync(tmp, file);
  return true;
}

mkdirSync(OUT, { recursive: true });
const list = allSyllables().map((s) => s.toLowerCase()).filter((s) => !ONLY || ONLY.has(s));
const bad = [];
let copied = 0, made = 0;
for (const syl of list) {
  const file = join(OUT, `${syl}.mp3`);
  if (existsSync(file) && !FORCE) continue;
  const from = join(ROOT, "public/audio/propis-dictation", `syl_${syl}.mp3`);
  if (existsSync(from)) { copyFileSync(from, file); copied += 1; continue; }
  let ok = false;
  for (let take = 1; take <= 3 && !ok; take++) {
    writeFileSync(file, await synth(`${syl[0].toUpperCase()}${syl.slice(1)}.`));
    cutAtFirstPause(file);
    const h = await heard(file);
    ok = h === syl.replace(/ё/g, "е");
    console.log(`${syl} take ${take}: «${h}»${ok ? "" : " ✗"}`);
  }
  made += 1;
  if (!ok) bad.push(syl);
}
console.log(`copied ${copied}, synthesized ${made}`);
if (bad.length) console.log(`recognition never matched (listen): ${bad.join(", ")}`);
