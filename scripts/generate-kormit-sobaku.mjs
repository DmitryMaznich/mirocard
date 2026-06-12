/**
 * generate-kormit-sobaku.mjs
 * Generates a printable A5 step-by-step guide "Как кормить Дюшу" for children.
 *
 * Usage:
 *   node scripts/generate-kormit-sobaku.mjs          # generate all icons
 *   node scripts/generate-kormit-sobaku.mjs --skip   # use cached icons
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.resolve(__dirname, "..");
const OUT_DIR  = path.join(ROOT, "output", "kormit-icons");
const HTML_OUT = path.join(ROOT, "output", "kormit_sobaku.html");

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

if (!API_KEY) { console.error("GEMINI_API_KEY not found"); process.exit(1); }
console.log(`Model: ${MODEL}\n`);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(ROOT, "output"), { recursive: true });

// ── White background removal (BFS flood-fill from edges) ─────────────────────

async function removeWhiteBg(buf, tolerance = 38) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

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
    if (idx >= 0 && idx < width * height && !visited[idx]) {
      visited[idx] = 1; queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueue(x); enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width); enqueue(y * width + width - 1);
  }

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
    .png()
    .toBuffer();
}

const CORGI_PROMPT = "Flat clean illustration for children, simple bold shapes, no text, no shadows, no gradients, pure white background, centered in square. Cute friendly Corgi dog face, front view, big ears, warm tan and white fur, happy expression, round eyes. Simple cartoon style for children.";

// ── Gemini API call ───────────────────────────────────────────────────────────

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

// ── Generate corgi icon ───────────────────────────────────────────────────────

const icons = {};
const corgiPath = path.join(OUT_DIR, "corgi.png");
let corgiRaw;
if (SKIP && fs.existsSync(corgiPath)) {
  console.log("  ↩ corgi (cached)");
  corgiRaw = fs.readFileSync(corgiPath);
} else {
  console.log("▶ corgi…");
  const buf = await callGemini(CORGI_PROMPT);
  corgiRaw = await sharp(buf).resize(256, 256).png().toBuffer();
  fs.writeFileSync(corgiPath, corgiRaw);
  console.log("  ✓");
}
icons.corgi = `data:image/png;base64,${(await removeWhiteBg(corgiRaw)).toString("base64")}`;

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { n:1, color:"#FF6B6B", dark:false, text:"Возьми банку с кормом и мерный стакан" },
  { n:2, color:"#FF9F43", dark:false, text:"Насыпь полный стакан корма в собачью миску" },
  { n:3, color:"#22A6B3", dark:false, text:"Замени воду — вымой миску и налей свежей воды" },
  { n:4, color:"#6AB04C", dark:false, text:"Позови Дюшу есть" },
  { n:5, color:"#A29BFE", dark:false, text:"Вымыть руки с мылом и вытереть насухо" },
];

// ── HTML builder ──────────────────────────────────────────────────────────────

function stepHTML(step) {
  const numColor = step.dark ? "#2C2C2C" : "#fff";
  return `
  <div class="step">
    <div class="num" style="background:${step.color};color:${numColor}">${step.n}</div>
    <div class="txt">${step.text}</div>
  </div>`;
}

const stepsHTML = STEPS.map(stepHTML).join("\n");

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Как кормить Дюшу</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#F0F7FF;font-family:'Nunito',Arial,sans-serif;padding:16px}
  .page{width:100%;max-width:460px;margin:0 auto}
  .header{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:6px}
  .header-dog{width:64px;height:64px;object-fit:contain;flex-shrink:0}
  .header-text{text-align:left}
  h1{font-size:26px;font-weight:900;color:#1A1A2E;line-height:1.1}
  .when{font-size:13px;font-weight:700;color:#5A7A9A;margin-top:2px}
  .steps{display:flex;flex-direction:column;gap:9px;margin-top:10px}
  .step{
    display:flex;align-items:center;gap:12px;
    background:#fff;border-radius:16px;
    padding:10px 14px;
    box-shadow:0 2px 8px rgba(0,0,0,.07)
  }
  .num{
    min-width:48px;height:48px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:24px;font-weight:900;flex-shrink:0
  }
  .txt{font-size:22px;font-weight:700;color:#1A1A2E;line-height:1.35;flex:1}
  .footer{text-align:center;margin-top:10px;font-size:11px;color:#ccc;font-weight:700}
  @media print{
    body{background:#fff;padding:0}
    .step{break-inside:avoid;box-shadow:none;border:1px solid #eee}
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <img class="header-dog" src="${icons.corgi}" alt="Дюша">
    <div class="header-text">
      <h1>Как кормить собаку</h1>
      <div class="when">Каждый день перед завтраком и перед ужином</div>
    </div>
  </div>
  <div class="steps">
${stepsHTML}
  </div>
  <div class="footer">kaplieva.help</div>
</div>
</body>
</html>`;

fs.writeFileSync(HTML_OUT, html, "utf8");
console.log(`\n✓ HTML saved: ${HTML_OUT}`);
