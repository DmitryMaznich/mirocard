/**
 * generate-finger-hands.mjs
 * Generates 12 hand PNG images for the fingers counting mode.
 *
 * Strategy:
 *   1. Generate hand_right_5 (all fingers) as MASTER via text prompt.
 *   2. Generate hand_right_0..4 by passing the master as reference image.
 *   3. Mirror all right images → left images.
 *
 * Processing: NO trim() — consistent framing relies on the AI prompt.
 * API aspect ratio: 3:4 to match 256×320 output canvas.
 *
 * Usage:
 *   node scripts/generate-finger-hands.mjs           # full run
 *   node scripts/generate-finger-hands.mjs --only=5  # single count
 *   node scripts/generate-finger-hands.mjs --skip    # use cached
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "hands");

const SKIP     = process.argv.includes("--skip");
const ONLY_ARG = process.argv.find(a => a.startsWith("--only="));
const ONLY     = ONLY_ARG ? parseInt(ONLY_ARG.split("=")[1]) : null;

// ── Env ───────────────────────────────────────────────────────────────────────

function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const sep = l.indexOf("=");
    if (sep <= 0) continue;
    const key = l.slice(0, sep).trim();
    let val = l.slice(sep + 1).trim();
    if (/^['"].*['"]$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(ROOT, ".env.local"));
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env");
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env.local");

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL || "gemini-2.0-flash-preview-image-generation";
if (!API_KEY) { console.error("GEMINI_API_KEY not found"); process.exit(1); }
console.log(`Model: ${MODEL}\n`);

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Gemini ────────────────────────────────────────────────────────────────────

async function callGemini(parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio: "3:4" },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body?.error) || `HTTP ${res.status}`);
  const rparts  = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = rparts.find(p => p?.inlineData || p?.inline_data);
  const inline  = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image: " + JSON.stringify(body).slice(0, 300));
  return Buffer.from(inline.data, "base64");
}

// ── Processing: remove white bg, resize (NO trim) ────────────────────────────
// No trim() so all images keep the same framing that the AI drew.
// The 3:4 API aspect ratio matches our 256×320 output exactly.

async function processImage(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px          = new Uint8ClampedArray(data);
  const transparent = new Uint8Array(width * height);
  const visited     = new Uint8Array(width * height);
  const queue       = new Int32Array(width * height);
  let qHead = 0, qTail = 0;
  const TOL = 30;

  const isWhitish = i => {
    const b = i * 4;
    return px[b] >= 255-TOL && px[b+1] >= 255-TOL && px[b+2] >= 255-TOL;
  };
  const enqueue = idx => {
    if (idx >= 0 && idx < width*height && !visited[idx]) {
      visited[idx] = 1; queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height-1)*width+x); }
  for (let y = 1; y < height-1; y++) { enqueue(y*width); enqueue(y*width+width-1); }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    if (!isWhitish(idx)) continue;
    transparent[idx] = 1;
    const x = idx % width, y = Math.floor(idx / width);
    if (x > 0)        enqueue(idx-1);
    if (x < width-1)  enqueue(idx+1);
    if (y > 0)        enqueue(idx-width);
    if (y < height-1) enqueue(idx+width);
  }

  for (let i = 0; i < width*height; i++) {
    if (transparent[i]) { px[i*4+3] = 0; continue; }
    const x = i % width, y = Math.floor(i / width);
    const adjT =
      (x > 0        && transparent[i-1]) ||
      (x < width-1  && transparent[i+1]) ||
      (y > 0        && transparent[i-width]) ||
      (y < height-1 && transparent[i+width]);
    if (adjT) {
      const b = i * 4;
      const w = Math.min(px[b], px[b+1], px[b+2]);
      if (w > 200) px[b+3] = Math.round(Math.max(0, 1-(w-200)/55)*255);
    }
  }

  // NO trim — resize directly so framing is preserved
  return sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } })
    .resize({ width: 256, height: 320, fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
    .png()
    .toBuffer();
}

// ── Style constants ───────────────────────────────────────────────────────────

const STYLE = `Flat digital illustration, children's educational app (ages 4–8).
Art style: bold dark brown outline (3–4 px), flat warm peach fill (#FBBF8A), NO gradients, NO shadows, NO skin texture.
Palm lines: three clear dark brown curved lines on the inner palm — heart line (upper), head line (middle), life line (curves from between thumb and index down toward wrist). These lines make it unmistakably the INNER (palm) side, not the back.
Finger tips: the four fingers (index, middle, ring, pinky) show smooth rounded PADS at their tips — NO nails, because from the palm side only the soft pad is visible. The thumb is the exception: when the thumb is extended, its nail IS visible (a small light oval with dark outline) because the thumb naturally rotates to show its nail edge even from a palm-facing view.
Thumb proportions: the thumb must always be drawn at the same size relative to the hand — approximately 70% of the length of the index finger, and visibly shorter/wider than the other fingers. This proportion must be IDENTICAL across all 6 images (counts 0–5).`;

const FRAMING = `FRAMING (critical — must be PIXEL-IDENTICAL in position across all 6 images in this set):
- Portrait orientation, 3:4 aspect ratio.
- The hand is centered horizontally.
- The wrist bottom edge sits at the very BOTTOM of the image (within 2–3% from bottom).
- The palm top edge (the crease where fingers connect to the palm) is at EXACTLY Y=42% from the top of the image — the same in every single count.
- Fully extended fingers (count=5) reach from Y=42% all the way up to Y=5% from the top.
- For counts 0–4: the space ABOVE Y=42% is simply empty (transparent / white). The fist or partial hand occupies only the lower 58% of the image. DO NOT scale up the hand to fill the empty space.
- This fixed anchor point (palm top at Y=42%) is what creates smooth animation when switching between counts.`;

// ── Thumb position rules per count ───────────────────────────────────────────
// CRITICAL: the thumb position must be described precisely to avoid
// unnatural poses (thumb sticking up when it should be folded).

const THUMB = {
  folded: `THUMB (FOLDED): The thumb is bent at a RIGHT ANGLE at the base joint, lying HORIZONTALLY across the front of the closed fingers. The thumb points to the RIGHT (toward the pinky side). The thumb tip is near the middle knuckles of the index/middle fingers. The thumb is fully visible as a horizontal element at the front of the fist — it does NOT point upward, does NOT curl behind the fingers, and is NOT hidden.`,

  sideVisible: `THUMB (TUCKED ASIDE): The thumb is bent inward and downward, resting against the side of the index finger's base, pointing roughly TOWARD THE VIEWER and slightly to the right. It appears as a short rounded shape at the left side of the image. It does NOT extend upward at all.`,

  open: `THUMB (EXTENDED): The thumb extends at about 40–50 degrees from vertical, angling toward the upper-LEFT. It is clearly separated from the index finger. The thumb is visibly shorter than the other fingers.`,
};

// ── Master prompt (count=5, all fingers open) ─────────────────────────────────

const MASTER_PROMPT = `${STYLE}

Draw a RIGHT hand, palm side facing directly toward the viewer (inner side — NOT the back of the hand).
Isolated on a pure white background. The thumb is on the LEFT side of the image.

${FRAMING}

POSE — 5 fingers extended (ALL OPEN):
- Index, middle, ring, and pinky fingers all extend straight up, clearly separated, reaching near the top of the image.
- ${THUMB.open}

VERIFY before finishing:
□ Exactly 5 fingers visible and extended.
□ Index/middle/ring/pinky tips show smooth rounded PADS — NO nails on these.
□ Thumb has a small nail (it rotates to show its nail edge when extended).
□ Thumb is clearly shorter and wider than the other fingers (≈70% of index finger length).
□ Clear palm lines (heart, head, life lines).
□ Wrist at the very bottom of the image.
□ Palm top (finger-palm crease) at Y=42% from the top of the image.
□ Finger tips reach to Y≈5% from the top.`;

// ── Reference-based prompts (counts 0–4) ─────────────────────────────────────

const FROM_REF = {

  4: `You are given a REFERENCE image: right hand, palm side, all 5 fingers open, thumb on the left.

${STYLE}

${FRAMING}

TASK — Reproduce the reference with EXACTLY 4 fingers extended:
- Index, middle, ring, and pinky fingers extended straight up (SAME position as reference).
- ${THUMB.folded}

KEEP IDENTICAL to reference: palm size, palm position, palm lines, wrist, skin tone, outline style.

VERIFY:
□ Exactly 4 straight-up fingers (index through pinky).
□ Thumb lying HORIZONTALLY to the right — not pointing up.
□ Palm, wrist, and 4 raised fingers match reference proportions exactly.`,

  3: `You are given a REFERENCE image: right hand, palm side, all 5 fingers open, thumb on the left.

${STYLE}

${FRAMING}

TASK — Reproduce the reference with EXACTLY 3 fingers extended:
- Index, middle, and ring fingers extended straight up (SAME position as in the reference).
- Pinky: curls SMOOTHLY INWARD toward the palm, bending at all three joints so the tip rests against the lower palm near the ring finger base. The pinky must NOT stick out sideways, must NOT curl backward, and must NOT be visible as a straight or diagonal element — it should appear as a small rounded curl at the right edge of the palm.
- ${THUMB.folded}

KEEP IDENTICAL to reference: palm size, palm position, palm lines, wrist, skin tone, outline style.

VERIFY:
□ Exactly 3 straight-up fingers (index, middle, ring).
□ Pinky is a small curved shape tucked against the palm on the right side — NOT sticking out at an angle.
□ Thumb lying HORIZONTALLY to the right across the fist — not pointing up.`,

  2: `You are given a REFERENCE image: right hand, palm side, all 5 fingers open, thumb on the left.

${STYLE}

${FRAMING}

TASK — Reproduce the reference with EXACTLY 2 fingers extended:
- Index finger and middle finger extended straight up (SAME position as in the reference).
- Ring finger and pinky curled down into the palm.
- ${THUMB.folded}

KEEP IDENTICAL to reference: palm size, palm position, palm lines, wrist, skin tone, outline style.

VERIFY:
□ Exactly 2 straight-up fingers (index and middle only).
□ Ring and pinky not visible as extended fingers.
□ Thumb lying HORIZONTALLY to the right — not pointing up.`,

  1: `You are given a REFERENCE image: right hand, palm side, all 5 fingers open, thumb on the left.

${STYLE}

${FRAMING}

TASK — Reproduce the reference with EXACTLY 1 finger extended:
- ONLY the index finger (the pointing finger, second from left) extends straight up (SAME height and position as in the reference).
- Middle, ring, and pinky all curled into the palm.
- ${THUMB.folded}

KEEP IDENTICAL to reference: palm size, palm position, palm lines, wrist, skin tone, outline style.

VERIFY:
□ Exactly 1 straight-up finger (index finger only).
□ Middle, ring, pinky not visible as extended fingers.
□ Thumb lying HORIZONTALLY to the right — not pointing up. This is critical.`,

  0: `You are given a REFERENCE image: right hand, palm side, all 5 fingers open, thumb on the left.

${STYLE}

${FRAMING}

TASK — Reproduce the reference as a CLOSED FIST (0 fingers extended):
- This is a RIGHT hand shown from the PALM SIDE (inner side). The thumb is on the LEFT of the image.
- ALL four fingers (index, middle, ring, pinky) curl toward the viewer and rest against the palm — their tips touch the lower palm. The knuckles face AWAY from the viewer (not visible). What is visible is the smooth front face of the curled fingers.
- The three palm lines (heart, head, life) remain clearly visible on the palm area between the curled fingers and the wrist.
- ${THUMB.folded}

IMPORTANT — PALM SIDE, NOT BACK OF HAND: The viewer sees the same side as in the reference (inner/palm side). The fist's front face is smooth and shows the palm creases — NOT the bony knuckle ridges of the back of the hand.

CRITICAL SIZE RULE: The fist must occupy EXACTLY the same vertical space as the palm region in the reference (the lower 58% of the image). The upper 42% of the image must be EMPTY. If the fist feels "too small" — that is correct. Do NOT scale it up. A fist that looks slightly small is better than one that looks bigger than the open hand.

KEEP IDENTICAL to reference: palm size, palm position, wrist position, skin tone, outline style.

VERIFY:
□ Palm side visible (smooth front, not knuckle ridges).
□ Thumb is on the LEFT side, lying HORIZONTALLY across the fist — not pointing up.
□ Palm lines clearly visible.
□ The top of the fist (knuckle line) is at Y=42% from the top — same anchor as the reference. Upper 42% is empty.`,
};

// ── Generation ────────────────────────────────────────────────────────────────

async function generateMaster() {
  const file = path.join(OUT_DIR, "hand_right_5.png");
  if (SKIP && fs.existsSync(file)) { console.log("  ↩ hand_right_5 (cached)"); return; }
  process.stdout.write("▶ hand_right_5 (master, text-only)… ");
  try {
    const raw = await callGemini([{ text: MASTER_PROMPT }]);
    fs.writeFileSync(file, await processImage(raw));
    console.log("✓");
  } catch (e) { console.log(`✗ ${e.message}`); }
  await new Promise(r => setTimeout(r, 1500));
}

async function generateFromRef(refBuf, count) {
  const file = path.join(OUT_DIR, `hand_right_${count}.png`);
  if (SKIP && fs.existsSync(file)) { console.log(`  ↩ hand_right_${count} (cached)`); return; }
  process.stdout.write(`▶ hand_right_${count} (from master)… `);
  try {
    const b64 = refBuf.toString("base64");
    const raw = await callGemini([
      { inline_data: { mime_type: "image/png", data: b64 } },
      { text: FROM_REF[count] },
    ]);
    fs.writeFileSync(file, await processImage(raw));
    console.log("✓");
  } catch (e) { console.log(`✗ ${e.message}`); }
  await new Promise(r => setTimeout(r, 1500));
}

async function mirrorToLeft(count) {
  const src  = path.join(OUT_DIR, `hand_right_${count}.png`);
  const dest = path.join(OUT_DIR, `hand_left_${count}.png`);
  if (!fs.existsSync(src)) { console.log(`  ✗ hand_left_${count}: source missing`); return; }
  await sharp(src).flop().toFile(dest);
  console.log(`  ↔ hand_left_${count} (mirrored)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const COUNTS = ONLY !== null ? [ONLY] : [5, 4, 3, 2, 1, 0];

if (COUNTS.includes(5)) await generateMaster();

const masterFile = path.join(OUT_DIR, "hand_right_5.png");
if (!fs.existsSync(masterFile) && COUNTS.some(n => n < 5)) {
  console.error("✗ hand_right_5.png missing — run without --only first.");
  process.exit(1);
}
const masterBuf = fs.existsSync(masterFile) ? fs.readFileSync(masterFile) : null;

for (const n of COUNTS.filter(n => n < 5)) {
  await generateFromRef(masterBuf, n);
}

console.log("\nMirroring right → left…");
for (const n of COUNTS) await mirrorToLeft(n);

console.log(`\nDone → ${OUT_DIR}`);
