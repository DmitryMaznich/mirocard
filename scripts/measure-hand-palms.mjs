/**
 * measure-hand-palms.mjs
 * Measures the palm width in each hand image (bottom 35% of content).
 * Outputs scale factors so all palms appear the same width on screen.
 *
 * Usage: node scripts/measure-hand-palms.mjs
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const ROOT      = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDS_DIR = path.join(ROOT, "public", "hands");

async function measure(file) {
  const { data, info } = await sharp(path.join(HANDS_DIR, file))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Find content bounding box (non-transparent pixels)
  let minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const contentH = maxY - minY + 1;
  // Palm region = bottom 35% of content height
  const palmStartY = maxY - Math.round(contentH * 0.35);

  let palmMinX = width, palmMaxX = 0;
  for (let y = palmStartY; y <= maxY; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < palmMinX) palmMinX = x;
        if (x > palmMaxX) palmMaxX = x;
      }
    }
  }

  const palmW = palmMaxX - palmMinX + 1;
  return { file, imageW: width, imageH: height, contentH, palmW, palmFrac: palmW / width };
}

const COUNTS = [0, 1, 2, 3, 4, 5];
const results = {};

for (const n of COUNTS) {
  const r = await measure(`hand_right_${n}.png`);
  results[n] = r;
  console.log(`right_${n}: imageSize=${r.imageW}×${r.imageH}  contentH=${r.contentH}  palmW=${r.palmW}  palmFrac=${r.palmFrac.toFixed(3)}`);
}

// Reference = median palm fraction
const fracs = COUNTS.map(n => results[n].palmFrac).sort((a,b) => a-b);
const medianFrac = fracs[Math.floor(fracs.length / 2)];
console.log(`\nMedian palm fraction: ${medianFrac.toFixed(3)}`);
console.log("\nScale factors (reference / measured):");
for (const n of COUNTS) {
  const scale = medianFrac / results[n].palmFrac;
  console.log(`  count ${n}: ${scale.toFixed(4)}  (palmFrac=${results[n].palmFrac.toFixed(3)})`);
}
