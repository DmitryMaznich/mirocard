/**
 * find-finger-tips.mjs
 *
 * For each hand_right_N.png (N=0..5), finds the (x, y) coordinates of
 * each raised finger tip as fractions of the image canvas (256×320).
 *
 * Strategy:
 *   1. Use the approximate X positions from alpha-diff analysis to know
 *      which X columns correspond to each finger.
 *   2. For each finger's X band, scan top-to-bottom to find the topmost
 *      non-transparent pixel row — that is the finger tip Y.
 *   3. The tip X is the centroid of non-transparent pixels in the top
 *      few rows of that band.
 *
 * Usage: node scripts/find-finger-tips.mjs
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const ROOT  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDS = path.join(ROOT, "public", "hands");
const W = 256, H = 320;
const ALPHA_THRESH = 32;

// Approximate X centres of each finger (fraction 0-1) in hand_right images,
// derived from previous alpha-diff analysis (scripts/analyze-finger-positions.mjs).
// finger_x[count-1] = sorted list of X centres for an image with `count` fingers.
const APPROX_X = {
  1: [0.366],
  2: [0.266, 0.524],
  3: [0.267, 0.508, 0.710],
  4: [0.201, 0.420, 0.625, 0.810],
  5: [0.137, 0.373, 0.550, 0.712, 0.854],
};

async function loadRaw(count) {
  const { data } = await sharp(path.join(HANDS, `hand_right_${count}.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data; // RGBA, length W*H*4
}

function alpha(data, x, y) {
  return data[(y * W + x) * 4 + 3];
}

/**
 * Given approximate finger X centre (fraction 0-1) and the raw image data,
 * returns the finger tip as { x, y } fractions.
 *
 * Searches within a band of ±BAND_HALF columns around approxX.
 * Scans top-to-bottom; takes the topmost row with enough opaque pixels,
 * then computes the centroid of those pixels for the final X.
 */
function findTip(data, approxX, BAND_HALF = 24) {
  const cx = Math.round(approxX * W);
  const x0 = Math.max(0, cx - BAND_HALF);
  const x1 = Math.min(W - 1, cx + BAND_HALF);

  for (let y = 0; y < H; y++) {
    let sumX = 0, cnt = 0;
    for (let x = x0; x <= x1; x++) {
      if (alpha(data, x, y) >= ALPHA_THRESH) {
        sumX += x;
        cnt++;
      }
    }
    if (cnt >= 3) { // at least 3 opaque pixels in this row = real finger content
      return {
        x: Math.round((sumX / cnt) / W * 1000) / 1000,
        y: Math.round(y / H * 1000) / 1000,
      };
    }
  }
  return null; // nothing found
}

console.log("Analysing finger tips in hand_right_N.png images...\n");

const result = {}; // result[count] = [{x, y}, ...]

for (let count = 1; count <= 5; count++) {
  const data   = await loadRaw(count);
  const approxXs = APPROX_X[count];
  const tips   = [];

  for (const ax of approxXs) {
    const tip = findTip(data, ax);
    if (tip) {
      tips.push(tip);
      console.log(`  count=${count}  approxX=${ax}  →  tip=(${tip.x}, ${tip.y})`);
    } else {
      console.log(`  count=${count}  approxX=${ax}  →  NOT FOUND`);
    }
  }
  result[count] = tips;
  console.log();
}

// Output the constant for copy-paste into JSX.
// hand_left images are mirrors: x_left = 1 - x_right.
console.log("// ── FINGER_TIPS_R — paste into FingersCountTask.jsx ────────────────────");
console.log("//");
console.log("// FINGER_TIPS_R[count] = [{x, y}, ...] sorted left→right, fractions of");
console.log("// the 256×320 image canvas.  For hand_left, mirror: x_L = 1 - x_R.");
console.log("const FINGER_TIPS_R =", JSON.stringify(result, null, 2) + ";");
