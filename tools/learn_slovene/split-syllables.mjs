// Splits a line of syllables read by Ana («Ka. Ko. Ku. Ki.», one consonant per
// clip, language_code "sl") into one clip per syllable: the four stretches of
// speech between the pauses. Each clip keeps 40 ms before and 60 ms after the
// voice, is brought to the same mean level as process-audio.mjs uses, and gets
// 250 ms of silence in front — Android's HTMLAudio swallows the start of a
// clip this short otherwise (docs/learn-slovene.md, 12).
//
// Usage: node tools/learn_slovene/split-syllables.mjs <raw dir> <out dir>
//   raw dir holds <C><take>.mp3 (K1.mp3 = «Ka. Ko. Ku. Ki.») or, for a line with
//   other vowels, <C>-<vowels><take>.mp3 (G-aio1.mp3 = «Ga. Gi. Go.» — a re-take
//   puts the syllable mid-line, where the voice doesn't fall); out gets <ca>_<take>.mp3.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_VOWELS = "aoui";
const TARGET_MEAN_DB = -15;
const [rawDir, outDir] = process.argv.slice(2);
if (!rawDir || !outDir) throw new Error("usage: split-syllables.mjs <raw dir> <out dir>");
mkdirSync(outDir, { recursive: true });

const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
const stderr = (args) => spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8" }).stderr;

function segments(file) {
  const log = stderr(["-i", file, "-af", "silencedetect=noise=-40dB:d=0.12", "-f", "null", "-"]);
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const duration = Number(log.match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((s, v) => s * 60 + Number(v), 0));
  // Speech runs from the end of one pause to the start of the next; the clip
  // begins with speech, so the first stretch starts at 0.
  const from = [0, ...ends];
  return starts.map((s, i) => [from[i], s]).filter(([a, b]) => b - a > 0.1 && a < duration);
}

for (const name of readdirSync(rawDir).sort()) {
  const match = name.match(/^([A-Z])(?:-([a-z]+))?(\d)\.mp3$/);
  if (!match) continue;
  const consonant = match[1].toLowerCase();
  const vowels = [...(match[2] ?? DEFAULT_VOWELS)];
  const take = match[3];
  const parts = segments(join(rawDir, name));
  if (parts.length !== vowels.length) {
    console.warn(`${name}: ${parts.length} stretches of speech, expected ${vowels.length} — skipped`);
    continue;
  }
  parts.forEach(([a, b], i) => {
    const out = join(outDir, `${consonant}${vowels[i]}_${take}.mp3`);
    const tmp = `${out}.tmp.wav`;
    const start = Math.max(0, a - 0.04);
    ffmpeg(["-ss", start.toFixed(3), "-t", (b + 0.06 - start).toFixed(3), "-i", join(rawDir, name), "-af", "afade=t=out:st=" + (b + 0.02 - start).toFixed(3) + ":d=0.04", tmp]);
    const log = stderr(["-i", tmp, "-af", "volumedetect", "-f", "null", "-"]);
    const mean = Number(log.match(/mean_volume: (-?[\d.]+)/)[1]);
    const peak = Number(log.match(/max_volume: (-?[\d.]+)/)[1]);
    const gain = Math.min(TARGET_MEAN_DB - mean, -1 - peak);
    ffmpeg(["-i", tmp, "-af", `volume=${gain.toFixed(1)}dB,adelay=250:all=1,apad=pad_dur=0.1`, "-c:a", "libmp3lame", "-b:a", "128k", out]);
    rmSync(tmp);
  });
  console.log(`${name}: ${parts.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`).join(" ")}`);
}
