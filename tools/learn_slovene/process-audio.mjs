// Post-processing for «Учим словенский» word clips (audio/sl/*.mp3 in Ana's
// voice, audio/ru/*.mp3 in the owner's cloned voice). The clips are generated
// through the ElevenLabs MCP connector, not a script: api.elevenlabs.io is
// closed to cloud sessions (proxy 403), see docs/learn-slovene.md.
//
// Same treatment as tools/verbs_v2/generate-audio-elevenlabs.mjs: trim the
// silence (50 ms kept before the voice, 180 ms after with a 60 ms fade-out),
// cut a leading click, bring every clip to one mean level, and flag a clip that
// holds more than one stretch of speech (v4 sometimes says a short word twice).
//
// The click cut is opt-in (--clicks): on hruška, груша and чай it fired on the
// opening fricative/affricate itself, which a listener must not lose.
//
// Usage: node tools/learn_slovene/process-audio.mjs [sl|ru] [--keys=voda,sok] [--clicks] [--dir=<folder with sl/ ru/>]
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const dirArg = args.find((a) => a.startsWith("--dir="));
const DIR = dirArg ? dirArg.slice(6) : join(dirname(fileURLToPath(import.meta.url)), "audio");
const langs = args.filter((a) => !a.startsWith("--"));
const keysArg = args.find((a) => a.startsWith("--keys="));
const KEYS = keysArg ? new Set(keysArg.slice(7).split(",")) : null;
const CLICKS = args.includes("--clicks");

function ffmpegTo(file, ffArgs) {
  const tmp = join(dirname(file), `.tmp-${Date.now()}.mp3`);
  execFileSync("ffmpeg", ["-y", "-v", "error", ...ffArgs(tmp)]);
  renameSync(tmp, file);
}

const edge = (keep) => `silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB:start_silence=${keep}`;
function trim(file) {
  ffmpegTo(file, (tmp) => ["-i", file, "-af", `${edge(0.05)},areverse,${edge(0.18)},afade=t=in:d=0.06,areverse`, "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
}

// A burst ending by 0.15 s and followed by 60+ ms of silence is a click, not a
// word: no Russian or Slovenian word in this topic starts with a sound and then a pause.
function dropLeadingClick(file) {
  const log = spawnSync("ffmpeg", ["-v", "info", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.06", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const start = Number(log.match(/silence_start: ([\d.]+)/)?.[1]);
  const end = Number(log.match(/silence_end: ([\d.]+)/)?.[1]);
  if (!(start > 0.02 && start <= 0.15 && end > start)) return false;
  ffmpegTo(file, (tmp) => ["-ss", (end - 0.03).toFixed(3), "-i", file, "-af", "afade=t=in:d=0.012,adelay=30:all=1", "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
  return true;
}

const TARGET_MEAN_DB = -15;
function level(file) {
  const log = spawnSync("ffmpeg", ["-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const mean = Number(log.match(/mean_volume: (-?[\d.]+)/)[1]);
  const peak = Number(log.match(/max_volume: (-?[\d.]+)/)[1]);
  const gain = Math.min(TARGET_MEAN_DB - mean, -1 - peak);
  if (Math.abs(gain) >= 0.5) ffmpegTo(file, (tmp) => ["-i", file, "-af", `volume=${gain.toFixed(1)}dB`, "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
}

function innerPauses(file) {
  const log = spawnSync("ffmpeg", ["-v", "info", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return (log.match(/silence_end/g) ?? []).length;
}

function duration(file) {
  const out = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout;
  return Number(out).toFixed(2);
}

for (const lang of langs.length ? langs : ["sl", "ru"]) {
  for (const name of readdirSync(join(DIR, lang)).filter((n) => n.endsWith(".mp3")).sort()) {
    const key = name.replace(/\.mp3$/, "");
    if (KEYS && !KEYS.has(key)) continue;
    const file = join(DIR, lang, name);
    trim(file);
    const clicked = CLICKS && dropLeadingClick(file);
    level(file);
    const pauses = innerPauses(file);
    console.log(`${lang}/${key}\t${duration(file)} s${clicked ? "\tclick cut" : ""}${pauses ? `\t⚠ ${pauses} inner pause(s) — listen` : ""}`);
  }
}
