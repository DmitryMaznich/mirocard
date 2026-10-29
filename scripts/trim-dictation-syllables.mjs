// «По слогам» (propis2): cuts each raw syllable clip from generate-propis-dictation-elevenlabs.mjs --only=syllables down to its first
// spoken run, so a take that says the syllable twice ("Яб, яб, яб") keeps only the first one, and trims the silence the player would
// otherwise add to the pause between syllables. Prints the clips worth a listen: too short (a swallowed "ка") or too long (the model read the
// tag aloud).
// Needs ffmpeg on PATH.
// Usage: node scripts/trim-dictation-syllables.mjs --in=<raw dir> [--out=public/audio/propis-dictation] [--only=syl_ка,syl_ко]
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
if (!args.in) throw new Error("--in=<dir with the raw syl_*.mp3> is required");
const IN_DIR = resolve(args.in);
const OUT_DIR = resolve(ROOT, args.out ?? "public/audio/propis-dictation");
const ONLY = args.only ? new Set(String(args.only).split(",")) : null;
const PRE_ROLL = 0.03; // s kept before the speech, so the attack of "к"/"т" isn't clipped
const TAIL = 0.06; // s kept after it, faded out
const MIN_SPEECH = 0.25; // s; a shorter burst is a click, a breath or a stutter ("Р-радь"), not the syllable

function silences(file) {
  const { stderr } = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=n=-40dB:d=0.12", "-f", "null", "-"], { encoding: "utf8" });
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const [, h, m, s] = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = Number(h) * 3600 + Number(m) * 60 + Number(s);
  return { duration, runs: starts.map((start, i) => [start, ends[i] ?? duration]) };
}

mkdirSync(OUT_DIR, { recursive: true });
const files = readdirSync(IN_DIR).filter((f) => /^syl_.+\.mp3$/.test(f) && (!ONLY || ONLY.has(f.slice(0, -4))));
const suspicious = [];
let repeated = 0;
for (const name of files) {
  const file = join(IN_DIR, name);
  const { duration, runs } = silences(file);
  // the sound between the silences, without the bursts too short to be the syllable
  const edges = [0, ...runs.flat(), duration];
  const speech = [];
  for (let i = 0; i < edges.length; i += 2) if (edges[i + 1] - edges[i] >= MIN_SPEECH) speech.push([edges[i], edges[i + 1]]);
  const [start, end] = speech[0] ?? [0, duration];
  const moreSpeech = speech.length > 1; // the take said it again after a pause
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-af",
    `atrim=${Math.max(0, start - PRE_ROLL)}:${end + TAIL},asetpts=PTS-STARTPTS,afade=t=out:st=${end - Math.max(0, start - PRE_ROLL)}:d=${TAIL}`,
    "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", join(OUT_DIR, name)]);
  const length = end - start;
  if (length < 0.25 || length > 1.0) suspicious.push(`${name.slice(0, -4)}\t${length.toFixed(2)}s`);
  if (moreSpeech) repeated += 1;
}
console.log(`${files.length} trimmed → ${OUT_DIR.slice(ROOT.length + 1)} (${repeated} said more than once, only the first kept)`);
if (suspicious.length) console.log(`worth a listen:\n${suspicious.join("\n")}`);
