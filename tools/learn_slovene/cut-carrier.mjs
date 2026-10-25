// Cuts the word out of a carrier-phrase clip: Ana reads a bare SIR as the
// English "sir", but inside «To je sir. Sir.» (language_code "sl") she says it
// the Slovenian way, so the clip is generated with the carrier and only the
// last word, after the last real pause, is kept (docs/learn-slovene.md, 11).
// Run process-audio.mjs on the result afterwards for the trim and level.
//
// Usage: node tools/learn_slovene/cut-carrier.mjs <in.mp3> <out.mp3>
import { execFileSync, spawnSync } from "node:child_process";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: cut-carrier.mjs <in.mp3> <out.mp3>");

const log = spawnSync("ffmpeg", ["-hide_banner", "-i", input, "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const duration = Number(log.match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((s, v) => s * 60 + Number(v), 0));
// The trailing silence also ends (at the file end): the cut is the last pause
// that ends at least 0.3 s before the end, i.e. one followed by a word.
const cut = ends.filter((t) => t < duration - 0.3).pop();
if (cut === undefined) throw new Error(`${input}: no pause before the last word`);

execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(Math.max(0, cut - 0.05)), "-i", input, "-c:a", "libmp3lame", "-b:a", "128k", output]);
console.log(`${output}: cut at ${cut.toFixed(2)} s of ${duration.toFixed(2)} s`);
