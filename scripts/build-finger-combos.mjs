/**
 * build-finger-combos.mjs
 * Turns the owner-approved drafts of generate-finger-combos.mjs into app assets:
 * white background removed, scaled and placed so the wrist matches the existing
 * public/hands/hand_right_*.webp (256×320, wrist ≈ x 100–187 at the bottom edge).
 *
 *   node scripts/build-finger-combos.mjs
 *
 * Output: public/hands/combo_<pose>.webp (pose = raised fingers, t i m r p).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "tools", "addition_subtraction", "finger-combos");
const OUT = path.join(ROOT, "public", "hands");

// Approved by the owner on 2026-11-27 (contact sheet of 3–4 drafts per pose).
export const APPROVED = { t: "t_1", p: "p_4", ti: "ti_2", tp: "tp_3", ip: "ip_1", tim: "tim_1", mrp: "mrp_3", timr: "timr_1" };

const W = 256, H = 320, WRIST_W = 87, WRIST_CX = 144;

async function cutOut(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = new Uint8ClampedArray(data);
  const seen = new Uint8Array(width * height);
  const clear = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const whitish = i => px[i * 4] >= 225 && px[i * 4 + 1] >= 225 && px[i * 4 + 2] >= 225;
  const push = i => { if (i >= 0 && i < width * height && !seen[i]) { seen[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++];
    if (!whitish(i)) continue;
    clear[i] = 1;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    push(i - width); push(i + width);
  }
  for (let i = 0; i < width * height; i++) {
    if (clear[i]) { px[i * 4 + 3] = 0; continue; }
    // Soften the anti-aliased rim next to the removed background.
    const x = i % width;
    const rim = (x > 0 && clear[i - 1]) || (x < width - 1 && clear[i + 1]) || clear[i - width] || clear[i + width];
    if (rim) {
      const w = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      if (w > 190) px[i * 4 + 3] = Math.round(Math.max(0, 1 - (w - 190) / 65) * 255);
    }
  }
  // Wrist: the hand's lowest opaque row, a few pixels up.
  let bottom = 0;
  for (let i = 0; i < width * height; i++) if (px[i * 4 + 3] > 128) bottom = Math.floor(i / width);
  const row = bottom - 3;
  let a = width, b = 0;
  for (let x = 0; x < width; x++) if (px[(row * width + x) * 4 + 3] > 128) { a = Math.min(a, x); b = Math.max(b, x); }
  return { img: sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } }), width, height, bottom, wrist: [a, b] };
}

for (const [pose, draft] of Object.entries(APPROVED)) {
  const { img, width, height, bottom, wrist } = await cutOut(path.join(SRC, `hand_${draft}.png`));
  const k = WRIST_W / (wrist[1] - wrist[0]);
  const sw = Math.round(width * k), sh = Math.round(height * k);
  const scaled = await img.png().toBuffer().then(b => sharp(b).resize(sw, sh).png().toBuffer());
  const left = Math.round(WRIST_CX - ((wrist[0] + wrist[1]) / 2) * k);
  const top = Math.round(H - 1 - bottom * k);
  // Crop whatever falls outside the 256×320 frame, then place it.
  const cx = Math.max(0, -left), cy = Math.max(0, -top);
  const cw = Math.min(sw - cx, W - Math.max(0, left)), ch = Math.min(sh - cy, H - Math.max(0, top));
  const piece = await sharp(scaled).extract({ left: cx, top: cy, width: cw, height: ch }).png().toBuffer();
  const file = path.join(OUT, `combo_${pose}.webp`);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(file);
  console.log(`✓ ${path.basename(file)} (from ${draft}, scale ${k.toFixed(3)})`);
}
