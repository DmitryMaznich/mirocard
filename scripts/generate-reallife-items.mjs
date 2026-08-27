/**
 * generate-reallife-items.mjs
 * Generates the item icons used by the comparison topic's "Сравни в жизни"
 * mode (CompareRealLife.jsx) — flat, no-background PNGs, base64-embedded
 * into src/topics/renderers/comparison/realLifeItems.js so no extra asset
 * loading/zip-packaging is needed (the module is just JS the renderer
 * bundle already includes).
 *
 * Requires GEMINI_API_KEY (.env/.env.local — not present in a cloud
 * session, run this locally).
 *
 * Usage:
 *   node scripts/generate-reallife-items.mjs          # generate all
 *   node scripts/generate-reallife-items.mjs --skip   # reuse cached PNGs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");
const CACHE_DIR  = path.join(ROOT, "scripts", ".cache", "reallife-items");
const OUT_MODULE = path.join(ROOT, "src", "topics", "renderers", "comparison", "realLifeItems.js");

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
const MODEL   = process.env.GEMINI_MODEL || "gemini-3.1-flash-image-preview";
const SKIP    = process.argv.includes("--skip");

if (!API_KEY) { console.error("GEMINI_API_KEY not found — set it in .env (see .env.example)."); process.exit(1); }
console.log(`Model: ${MODEL}\n`);

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── White background removal (BFS flood-fill from edges) — copied as-is
// from scripts/generate-kormit-sobaku.mjs, same reasoning applies here. ──

async function removeWhiteBg(buf, tolerance = 38) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px          = new Uint8ClampedArray(data);
  const transparent = new Uint8Array(width * height);
  const visited     = new Uint8Array(width * height);
  const queue       = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  const isWhitish = (i) => {
    const b = i * 4;
    return px[b] >= 255 - tolerance && px[b+1] >= 255 - tolerance && px[b+2] >= 255 - tolerance;
  };
  const enqueue = (idx) => {
    if (idx >= 0 && idx < width * height && !visited[idx]) { visited[idx] = 1; queue[qTail++] = idx; }
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    if (!isWhitish(idx)) continue;
    transparent[idx] = 1;
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0) enqueue(idx - 1);
    if (x < width - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - width);
    if (y < height - 1) enqueue(idx + width);
  }
  for (let i = 0; i < width * height; i++) {
    if (transparent[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % width, y = (i / width) | 0;
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
  return sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } }).trim({ threshold: 8 }).png().toBuffer();
}

// ── Gemini API call ────────────────────────────────────────────────────

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts   = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p?.inlineData || p?.inline_data);
  const inline  = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image in response");
  return Buffer.from(inline.data, "base64");
}

// ── Items — matches REAL_LIFE_SCENARIOS' `item` field in engine.js ─────

const STYLE = "Flat clean illustration for children, simple bold shapes, thick soft outline, no text, no shadows, no gradients, pure white background, centered in square, single object only.";

const ITEMS = [
  { key: "яблок",       name: "apple",   prompt: `${STYLE} A single bright red apple with a small green leaf and brown stem.` },
  { key: "конфет",      name: "candy",   prompt: `${STYLE} A single round wrapped candy with twisted wrapper ends, bright pink and yellow stripes.` },
  { key: "машинок",     name: "toycar",  prompt: `${STYLE} A single simple toy car, side view, bright red body with round black wheels.` },
  { key: "шариков",     name: "balloon", prompt: `${STYLE} A single round party balloon on a short curly string, bright sky-blue color with a small white highlight.` },
  { key: "карандашей",  name: "pencil",  prompt: `${STYLE} A single yellow pencil with a pink eraser and sharpened graphite tip, drawn diagonally.` },
];

const items = {};
for (const { key, name, prompt } of ITEMS) {
  const cachePath = path.join(CACHE_DIR, `${name}.png`);
  let raw;
  if (SKIP && fs.existsSync(cachePath)) {
    console.log(`  ↩ ${name} (cached)`);
    raw = fs.readFileSync(cachePath);
  } else {
    console.log(`▶ ${name}…`);
    const buf = await callGemini(prompt);
    raw = await sharp(buf).resize(160, 160).png().toBuffer();
    fs.writeFileSync(cachePath, raw);
    console.log("  ✓");
  }
  const clean = await removeWhiteBg(raw);
  items[key] = `data:image/png;base64,${clean.toString("base64")}`;
}

// ── Write the JS module the renderer imports ────────────────────────────

const moduleSrc = `// Generated by scripts/generate-reallife-items.mjs — do not edit by hand.
// Keyed by the same "item" string engine.js's REAL_LIFE_SCENARIOS uses
// (genitive plural: "яблок", "конфет", ...), so CompareRealLife.jsx can
// look an icon up directly with task.item.
export const REAL_LIFE_ITEM_ICONS = ${JSON.stringify(items, null, 2)};
`;
fs.writeFileSync(OUT_MODULE, moduleSrc);
console.log(`\n✓ Wrote ${path.relative(ROOT, OUT_MODULE)}`);
