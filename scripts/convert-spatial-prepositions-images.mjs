// Creates device-friendly WebP copies of the approved PNG masters.
// Masters stay untouched in _assets; the deck builder packages only WebP.
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const ASSET_DIR = "public/decks/_assets/spatial_prepositions";
const MAX_WIDTH = 1200;

if (!existsSync(ASSET_DIR)) throw new Error(`Missing asset folder: ${ASSET_DIR}`);
mkdirSync(ASSET_DIR, { recursive: true });

const masters = readdirSync(ASSET_DIR)
  .filter((name) => name.toLowerCase().endsWith(".png"))
  .sort();

if (masters.length !== 40) {
  throw new Error(`Expected 40 approved PNG masters, found ${masters.length}`);
}

for (const name of masters) {
  const source = join(ASSET_DIR, name);
  const destination = join(ASSET_DIR, `${basename(name, ".png")}.webp`);
  await sharp(source)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(destination);
}

console.log(`✓ Converted ${masters.length} photographs to WebP (max ${MAX_WIDTH}px wide).`);
