/**
 * generate-finger-hands.mjs
 * Generates 12 hand PNG images for the fingers counting mode:
 *   hand_right_0.png … hand_right_5.png
 *   hand_left_0.png  … hand_left_5.png
 *
 * Usage:
 *   node scripts/generate-finger-hands.mjs
 *   node scripts/generate-finger-hands.mjs --skip   # use cached, skip API calls
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "hands");
const SKIP    = process.argv.includes("--skip");

// ── Load env ──────────────────────────────────────────────────────────────────

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

// ── Gemini call ───────────────────────────────────────────────────────────────

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "1:1" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body?.error) || `HTTP ${res.status}`);
  const parts   = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p?.inlineData || p?.inline_data);
  const inline  = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image in response: " + JSON.stringify(body).slice(0, 300));
  return Buffer.from(inline.data, "base64");
}

// ── White background → transparent (BFS flood-fill from edges) ───────────────

async function removeWhiteBg(buf, tolerance = 30) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px          = new Uint8ClampedArray(data);
  const transparent = new Uint8Array(width * height);
  const visited     = new Uint8Array(width * height);
  const queue       = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  const isWhitish = i => {
    const b = i * 4;
    return px[b] >= 255 - tolerance && px[b+1] >= 255 - tolerance && px[b+2] >= 255 - tolerance;
  };
  const enqueue = idx => {
    if (idx >= 0 && idx < width * height && !visited[idx]) {
      visited[idx] = 1; queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    if (!isWhitish(idx)) continue;
    transparent[idx] = 1;
    const x = idx % width, y = Math.floor(idx / width);
    if (x > 0)        enqueue(idx - 1);
    if (x < width-1)  enqueue(idx + 1);
    if (y > 0)        enqueue(idx - width);
    if (y < height-1) enqueue(idx + width);
  }

  for (let i = 0; i < width * height; i++) {
    if (transparent[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % width, y = Math.floor(i / width);
    const adjT =
      (x > 0        && transparent[i-1]) ||
      (x < width-1  && transparent[i+1]) ||
      (y > 0        && transparent[i-width]) ||
      (y < height-1 && transparent[i+width]);
    if (adjT) {
      const b = i * 4;
      const w = Math.min(px[b], px[b+1], px[b+2]);
      if (w > 200) px[b+3] = Math.round(Math.max(0, 1 - (w - 200) / 55) * 255);
    }
  }

  return sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } })
    .trim({ threshold: 8 })
    .resize({ width: 256, height: 320, fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
    .png()
    .toBuffer();
}

// ── Prompt definitions ────────────────────────────────────────────────────────

const STYLE = `Flat illustration, children's educational app style.
Single hand isolated on pure white background.
Hand shown strictly front-on (palm facing directly toward the viewer), fingers pointing straight up.
Neutral warm peach skin tone, bold dark brown outline, no gradients, no shadows, no texture.
Raised fingers are fully extended straight up, clearly separated.
Folded/curled fingers are bent completely into the palm — NOT visible from the front view.
Clean minimalist style for a children's learning app, ages 4–8.
Consistent vertical front-facing perspective identical to other images in the set.`;

// Index-first counting convention:
// 1 → index
// 2 → index + middle
// 3 → index + middle + ring
// 4 → index + middle + ring + pinky
// 5 → all five

const POSES = {
  0: {
    raised: [],
    folded: ["index finger", "middle finger", "ring finger", "pinky (little finger)", "thumb"],
    desc: "Closed fist. All five fingers curled tightly into the palm. Thumb rests on the outside of the curled fingers. No fingers extended whatsoever.",
  },
  1: {
    raised: ["index finger (the pointing finger, second from the thumb)"],
    folded: ["middle finger", "ring finger", "pinky (little finger)", "thumb"],
    desc: "Only the index finger (pointing finger) extended straight up. Middle, ring, pinky, and thumb all curled into the fist.",
  },
  2: {
    raised: ["index finger", "middle finger"],
    folded: ["ring finger", "pinky (little finger)", "thumb"],
    desc: "Index finger and middle finger both extended straight up, side by side. Ring finger, pinky, and thumb curled into the palm.",
  },
  3: {
    raised: ["index finger", "middle finger", "ring finger"],
    folded: ["pinky (little finger)", "thumb"],
    desc: "Index, middle, and ring fingers extended straight up. Pinky and thumb curled into the palm.",
  },
  4: {
    raised: ["index finger", "middle finger", "ring finger", "pinky (little finger)"],
    folded: ["thumb"],
    desc: "Index, middle, ring, and pinky all extended straight up. Only the thumb is tucked/curled in.",
  },
  5: {
    raised: ["index finger", "middle finger", "ring finger", "pinky (little finger)", "thumb"],
    folded: [],
    desc: "All five fingers fully extended straight up. Completely open palm.",
  },
};

function buildPrompt(side, count) {
  const thumbSide = side === "right" ? "left" : "right";
  const pose = POSES[count];
  const handLine = `${side === "right" ? "Right" : "Left"} hand, palm facing directly toward the viewer. The thumb is on the ${thumbSide} side of the image.`;

  return `${STYLE}

${handLine}

Pose: ${pose.desc}
${pose.raised.length ? `RAISED straight up: ${pose.raised.join(", ")}.` : "No fingers raised."}
${pose.folded.length ? `CURLED into palm (not visible): ${pose.folded.join(", ")}.` : "No fingers curled."}

IMPORTANT: exactly ${count} finger${count === 1 ? "" : "s"} must be extended. Count them carefully before finalising.`;
}

// ── Generate right hand, then mirror to left ──────────────────────────────────
// Left hands are created by horizontally flipping the right hand images.
// This guarantees perfect visual symmetry when both hands are shown side by side.

async function generateRight(count) {
  const name = `hand_right_${count}`;
  const file = path.join(OUT_DIR, `${name}.png`);

  if (SKIP && fs.existsSync(file)) {
    process.stdout.write(`  ↩ ${name} (cached)\n`);
    return;
  }

  process.stdout.write(`▶ ${name}… `);
  try {
    const raw = await callGemini(buildPrompt("right", count));
    const png = await removeWhiteBg(raw);
    fs.writeFileSync(file, png);
    console.log("✓");
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 1500));
}

async function mirrorToLeft(count) {
  const src  = path.join(OUT_DIR, `hand_right_${count}.png`);
  const dest = path.join(OUT_DIR, `hand_left_${count}.png`);
  if (!fs.existsSync(src)) { console.log(`  ✗ hand_left_${count}: source missing`); return; }
  await sharp(src).flop().toFile(dest);
  console.log(`  ↔ hand_left_${count} (mirrored)`);
}

for (const n of [0, 1, 2, 3, 4, 5]) {
  await generateRight(n);
}

console.log("\nMirroring right → left…");
for (const n of [0, 1, 2, 3, 4, 5]) {
  await mirrorToLeft(n);
}

console.log(`\nDone → ${OUT_DIR}`);
