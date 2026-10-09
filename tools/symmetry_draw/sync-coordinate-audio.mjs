// Reuse approved source recordings byte-for-byte; never synthesize coordinates.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COLUMN_LETTERS, coordinateLetterAudioPath, coordinateNumberAudioPath } from "./dictation-audio.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
export function coordinateAudioSources() {
  return [
    ...COLUMN_LETTERS.map((letter, index) => ({ path: coordinateLetterAudioPath(index), source: `public/audio/propis-dictation/sound_${letter.toLowerCase()}.mp3` })),
    ...Array.from({ length: 20 }, (_, index) => ({ path: coordinateNumberAudioPath(index + 1), source: `public/audio/addition-subtraction/n${index + 1}.mp3` })),
  ];
}
export function syncCoordinateAudio() {
  for (const { path, source } of coordinateAudioSources()) {
    const target = join(directory, path);
    mkdirSync(dirname(target), { recursive: true });
    const bytes = readFileSync(join(root, source));
    if (!existsSync(target) || !readFileSync(target).equals(bytes)) writeFileSync(target, bytes);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncCoordinateAudio();
  console.log("Coordinates: reused 20 human letter sounds and 20 approved number recordings");
}
