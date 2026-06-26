/**
 * normalize-hand-images.mjs
 * Re-processes hand images so all palms appear the same width on screen.
 *
 * Strategy: scale every image DOWN to match the minimum palm width (157px,
 * count=4). No upscaling = no quality loss. Result: palm fraction 157/256
 * for all images. Re-mirrors left hand images from the normalized rights.
 *
 * Usage: node scripts/normalize-hand-images.mjs
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const ROOT      = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDS_DIR = path.join(ROOT, "public", "hands");

const CANVAS_W = 256;
const CANVAS_H = 320;
const TARGET_PALM_PX = 157;       // min measured palm width → no upscaling

// Palm widths measured by measure-hand-palms.mjs
const MEASURED_PALM_PX = { 0: 212, 1: 176, 2: 159, 3: 181, 4: 157, 5: 165 };

for (const count of [0, 1, 2, 3, 4, 5]) {
  const measuredPalm = MEASURED_PALM_PX[count];
  const scale = TARGET_PALM_PX / measuredPalm;

  if (scale >= 1.0) {
    // Count 4 is already the reference; count 2 is negligibly close — skip.
    // Re-mirror the left image to keep it in sync with the right.
    const rightBuf = await sharp(path.join(HANDS_DIR, `hand_right_${count}.png`)).toBuffer();
    await sharp(rightBuf).flop().png().toFile(path.join(HANDS_DIR, `hand_left_${count}.png`));
    console.log(`count ${count}: scale=1.000 (reference, no change) — re-mirrored left`);
    continue;
  }

  const scaledW = Math.round(CANVAS_W * scale);
  const scaledH = Math.round(CANVAS_H * scale);

  // 1. Scale the right-hand source image down
  const scaledBuf = await sharp(path.join(HANDS_DIR, `hand_right_${count}.png`))
    .resize(scaledW, scaledH, { fit: "fill" })
    .toBuffer();

  // 2. Embed in the standard 256×320 transparent canvas (centered)
  const normalized = await sharp(scaledBuf)
    .extend({
      top:    Math.floor((CANVAS_H - scaledH) / 2),
      bottom: Math.ceil( (CANVAS_H - scaledH) / 2),
      left:   Math.floor((CANVAS_W - scaledW) / 2),
      right:  Math.ceil( (CANVAS_W - scaledW) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // 3. Save right-hand image
  await sharp(normalized).png().toFile(path.join(HANDS_DIR, `hand_right_${count}.png`));

  // 4. Mirror for left-hand image
  await sharp(normalized).flop().png().toFile(path.join(HANDS_DIR, `hand_left_${count}.png`));

  const finalPalmFrac = (measuredPalm * scale) / CANVAS_W;
  console.log(`count ${count}: scale=${scale.toFixed(3)}  scaled=${scaledW}×${scaledH}  palmFrac=${finalPalmFrac.toFixed(3)}`);
}

console.log("\nAll done. Final palm fraction for all counts: ~", (TARGET_PALM_PX / CANVAS_W).toFixed(3));
