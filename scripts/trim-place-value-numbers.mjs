// Trims the leading and trailing silence off the number-name clips
// (public/audio/place-value-numbers) so that «восемьдесят» + «четыре» sound
// as one number: ElevenLabs leaves ~0.1–0.2 s before and ~0.25–0.4 s after
// each word. Keeps 20 ms before and 60 ms after the voice. Needs ffmpeg.
// Run after scripts/generate-place-value-numbers-elevenlabs.mjs:
//   node scripts/trim-place-value-numbers.mjs [--keys=n80,n4]
import { execFileSync } from "node:child_process";
import { readdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public/audio/place-value-numbers");
const keysArg = process.argv.find((a) => a.startsWith("--keys="));
const KEYS = keysArg ? new Set(keysArg.slice(7).split(",")) : null;
// start_duration: a breath or click shorter than 50 ms before the word counts as silence.
const edge = (keep) => `silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:start_silence=${keep}`;
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".mp3"))) {
  if (KEYS && !KEYS.has(file.replace(".mp3", ""))) continue;
  const src = join(DIR, file), tmp = join(DIR, `.${file}`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", `${edge(0.02)},areverse,${edge(0.06)},areverse`, "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
  renameSync(tmp, src);
  console.log(`trimmed ${file}`);
}
