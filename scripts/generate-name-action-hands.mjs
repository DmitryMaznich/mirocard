/**
 * generate-name-action-hands.mjs
 * Generates the two hand pictures for addition_subtraction mode 2
 * ("Назови действие"): a hand coming down from above, fingers pointing down.
 *
 *   hand_open  — open relaxed hand, about to pick up / just let go
 *   hand_grip  — the same hand pinching (thumb + index + middle meet at the
 *                bottom) as if holding a small ball; the ball itself is NOT
 *                drawn — the renderer puts the real tray object under the
 *                fingertips, so the same picture works for circles, squares
 *                and triangles.
 *
 * Style reference: public/hands/hand_right_5.webp (the fingers-count hand the
 * children already know), so both hand sets look like one app.
 *
 * Framing contract the renderer relies on (NameActionTask.jsx):
 *   - square canvas; sleeve cuff touches the TOP edge;
 *   - hand centred horizontally;
 *   - lowest fingertip at ~92% of the height, fingertips centred.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/generate-name-action-hands.mjs
 *   node scripts/generate-name-action-hands.mjs --only=grip
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "name-action");
const REF = path.join(ROOT, "public", "hands", "hand_right_5.webp");
const SIZE = 320;

const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? ONLY_ARG.split("=")[1] : null;

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

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-image-preview";
if (!API_KEY) { console.error("GEMINI_API_KEY not found"); process.exit(1); }
console.log(`Model: ${MODEL}\n`);
fs.mkdirSync(OUT_DIR, { recursive: true });

async function callGemini(parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio: "1:1" },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body?.error) || `HTTP ${res.status}`);
  const rparts = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = rparts.find((p) => p?.inlineData || p?.inline_data);
  const inline = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image: " + JSON.stringify(body).slice(0, 300));
  return Buffer.from(inline.data, "base64");
}

// White background → transparent (flood fill from the border, same approach
// as generate-finger-hands.mjs), then trim and re-frame to the contract:
// cuff at the top edge, lowest fingertip at 92% of the height.
async function processImage(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = new Uint8ClampedArray(data);
  const transparent = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0, qTail = 0;
  const TOL = 30;
  const isWhitish = (i) => px[i * 4] >= 255 - TOL && px[i * 4 + 1] >= 255 - TOL && px[i * 4 + 2] >= 255 - TOL;
  const enqueue = (idx) => {
    if (idx >= 0 && idx < width * height && !visited[idx]) { visited[idx] = 1; queue[qTail++] = idx; }
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (qHead < qTail) {
    const idx = queue[qHead++];
    if (!isWhitish(idx)) continue;
    transparent[idx] = 1;
    const x = idx % width, y = Math.floor(idx / width);
    if (x > 0) enqueue(idx - 1);
    if (x < width - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - width);
    if (y < height - 1) enqueue(idx + width);
  }
  for (let i = 0; i < width * height; i++) {
    if (transparent[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % width, y = Math.floor(i / width);
    const adj = (x > 0 && transparent[i - 1]) || (x < width - 1 && transparent[i + 1])
      || (y > 0 && transparent[i - width]) || (y < height - 1 && transparent[i + width]);
    if (adj) {
      const w = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      if (w > 200) px[i * 4 + 3] = Math.round(Math.max(0, 1 - (w - 200) / 55) * 255);
    }
  }
  const trimmed = await sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
  const handHeight = Math.round(SIZE * 0.92);
  const fitted = await sharp(trimmed)
    .resize({ height: handHeight, width: SIZE, fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted.data, top: 0, left: Math.round((SIZE - fitted.info.width) / 2) }])
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
}

const STYLE = `You are given a STYLE REFERENCE: a cartoon hand from a children's educational app.
Match its style exactly: flat digital illustration, bold dark brown outline (3–4 px), flat warm peach skin fill,
NO gradients, NO shadows, NO skin texture, NO background elements. Pure white background.
Children's app for ages 4–8: friendly, simple, clean shapes, clearly readable at small size.`;

const COMMON = `SCENE: ONE right hand reaching DOWN from above, as if an adult's hand comes down from the top of the screen
to a tray lying below it. Fingers point DOWNWARD. We see the BACK of the hand (knuckles side, nails visible on fingertips),
slightly turned so the thumb is visible on the LEFT side.
A short light-blue sleeve cuff (#86B4E6, same flat style with dark brown outline) enters from the very TOP edge of the image
and the wrist comes out of it — the sleeve is cut off by the top edge.

FRAMING (critical):
- Square image. The hand is centred horizontally.
- The sleeve touches the TOP edge. The lowest fingertip is near the BOTTOM (about 8% above the bottom edge).
- Nothing else in the image: no ball, no tray, no table, no arms other than this one, no text.`;

const PROMPTS = {
  open: `${STYLE}

${COMMON}

POSE — OPEN HAND, RELAXED:
- All four fingers extended downward, gently spread, slightly curved like a hand about to pick something up.
- Thumb angled down-left, separated from the index finger.

VERIFY: exactly five fingers; fingers point DOWN; back of the hand visible; sleeve at the top edge; white background.`,

  grip: `${STYLE}

${COMMON}

POSE — PINCH GRIP, HOLDING A SMALL BALL (but the ball is NOT drawn):
- Thumb, index and middle fingertips come together at the bottom centre, as if holding a small ball from above
  between them. Ring and pinky fingers are softly curled.
- The fingertips must meet at the bottom centre of the image, forming a small cup shape OPEN TO THE BOTTOM.
- DO NOT draw the ball or any object. The space under the fingertips stays pure white.

VERIFY: fingers point DOWN; fingertips meet at the bottom centre; no ball drawn; sleeve at the top edge; white background.`,
};

const refPng = await sharp(REF).flatten({ background: "#ffffff" }).png().toBuffer();
const kinds = ONLY ? [ONLY] : ["open", "grip"];

for (const kind of kinds) {
  process.stdout.write(`▶ hand_${kind}… `);
  try {
    const raw = await callGemini([
      { inline_data: { mime_type: "image/png", data: refPng.toString("base64") } },
      { text: PROMPTS[kind] },
    ]);
    fs.writeFileSync(path.join(OUT_DIR, `hand_${kind}.raw.png`), raw);
    fs.writeFileSync(path.join(OUT_DIR, `hand_${kind}.webp`), await processImage(raw));
    console.log("✓");
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

console.log(`\nDone → ${OUT_DIR} (check *.raw.png, then delete them before committing)`);
