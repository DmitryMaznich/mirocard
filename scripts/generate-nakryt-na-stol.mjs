/**
 * generate-nakryt-na-stol.mjs
 * Generates 8 PNG icons via Gemini, builds self-contained HTML
 * "Как накрыть на стол" for children with ASD.
 *
 * Usage:
 *   node scripts/generate-nakryt-na-stol.mjs          # generate all
 *   node scripts/generate-nakryt-na-stol.mjs --skip   # skip existing icons
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.resolve(__dirname, "..");
const OUT_DIR  = path.join(ROOT, "output", "nakryt-icons");
const HTML_OUT = path.join(ROOT, "output", "nakryt_na_stol.html");

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

// ── White background removal (flood-fill from edges) ─────────────────────────

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

  // Seed all edge pixels
  for (let x = 0; x < width; x++) {
    enqueue(x); enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width); enqueue(y * width + width - 1);
  }

  // BFS flood fill inward
  while (qHead < qTail) {
    const idx = queue[qHead++];
    if (!isWhitish(idx)) continue;
    transparent[idx] = 1;
    const x = idx % width, y = Math.floor(idx / width);
    if (x > 0)       enqueue(idx - 1);
    if (x < width-1) enqueue(idx + 1);
    if (y > 0)       enqueue(idx - width);
    if (y < height-1) enqueue(idx + width);
  }

  // Second pass: feather semi-white edge pixels adjacent to transparent
  for (let i = 0; i < width * height; i++) {
    if (transparent[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % width, y = Math.floor(i / width);
    const adjTransparent =
      (x > 0       && transparent[i-1]) ||
      (x < width-1 && transparent[i+1]) ||
      (y > 0       && transparent[i-width]) ||
      (y < height-1 && transparent[i+width]);
    if (adjTransparent) {
      const b = i * 4;
      const whiteness = Math.min(px[b], px[b+1], px[b+2]);
      if (whiteness > 200) {
        px[b+3] = Math.round(Math.max(0, 1 - (whiteness - 200) / 55) * 255);
      }
    }
  }

  // Trim transparent border so icon fills its CSS container tightly
  return sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

// ── Icon prompts ──────────────────────────────────────────────────────────────

const BASE = "Flat clean illustration for children, simple bold shapes, no text, no shadows, no gradients, pure white background, centered in square.";

const ICON_DEFS = {
  plate:    `${BASE} White ceramic dinner plate seen from directly above (bird's eye view). Round shape, simple light gray rim, centered. Realistic but simplified.`,
  fork:     `${BASE} Silver metal dinner fork seen from directly above, lying flat. Vertical position, tines at top, handle at bottom. Clean and simple.`,
  knife:    `${BASE} Silver metal dinner knife seen from directly above, lying flat. Vertical position, blade pointing up with completely rounded safe tip, handle at bottom. No sharp edges. Clean and simple.`,
  spoon:    `${BASE} Silver metal dinner spoon seen from directly above, lying flat. Vertical position, oval bowl at top, handle at bottom. Clean and simple.`,
  glass:    `${BASE} Clear drinking glass seen from directly above (bird's eye top-down view). Shows concentric circles: outer rim, inner glass, and base. Simple and clear.`,
  napkin:   `${BASE} White cloth napkin folded into a neat rectangle, seen from above. Light shadow to show fabric. Simple and clean.`,
  count:    `${BASE} Friendly cartoon hand with all 5 fingers spread wide open, palm facing viewer. Rounded childlike shape, warm skin tone. For counting gesture.`,
  people:   `${BASE} Three simple cartoon person silhouettes standing in a row, different heights (adult, child, child). Rounded heads and bodies, cheerful colors (blue, orange, green). Representing a group of people to count.`,
  wipe:     `${BASE} Yellow kitchen sponge or cleaning cloth, simple flat shape from slight above angle. Friendly rounded corners. For wiping a table surface.`,
  placemat: `${BASE} Rectangular plastic dining placemat seen from directly above. Wide horizontal rectangle with rounded corners, creamy white / ivory color (#F5EED8), with a clear visible medium-gray border outline. Simple and clean.`,
};

// ── Gemini call ───────────────────────────────────────────────────────────────

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
  const parts    = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart  = parts.find((p) => p?.inlineData || p?.inline_data);
  const inline   = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image in response");
  return Buffer.from(inline.data, "base64");
}

// ── Generate icons ────────────────────────────────────────────────────────────

const icons = {};
for (const [name, prompt] of Object.entries(ICON_DEFS)) {
  const outPath = path.join(OUT_DIR, `${name}.png`);

  let rawBuf;
  if (SKIP && fs.existsSync(outPath)) {
    console.log(`  ↩ ${name} (cached)`);
    rawBuf = fs.readFileSync(outPath);
  } else {
    console.log(`▶ ${name}...`);
    const geminiRaw = await callGemini(prompt);
    rawBuf = await sharp(geminiRaw).resize(256, 256).png().toBuffer();
    fs.writeFileSync(outPath, rawBuf); // save original (white bg) for cache
    console.log(`  ✓`);
  }

  // Always remove white background for embedding in HTML
  const transparentBuf = await removeWhiteBg(rawBuf);
  icons[name] = `data:image/png;base64,${transparentBuf.toString("base64")}`;
}

// ── Table scene layout ────────────────────────────────────────────────────────
//
//  Placemat: 200×124 px  (golden ratio φ ≈ 1.618, 200/124 ≈ 1.613)
//
//  ┌──────────────────────────────────────────────────────┐
//  │  [fork]   [    plate    ]  [knife][spoon]  [glass]   │
//  │[napkin]                                              │
//  └──────────────────────────────────────────────────────┘
//
//  Items overlap to stay within the mat. Fork handle rests on napkin.

const PHI   = 1.618;
const MAT_W = 140;                        // 200 × 0.70
const MAT_H = Math.round(MAT_W / PHI);   // 87 px
const PAD   = 4;

const SCENE_W = MAT_W + PAD * 2;         // 148
const SCENE_H = MAT_H + PAD * 2 + 5;    // 100

// placemat CSS div (scene-relative coords)
const PLACEMAT_RECT = { l: PAD, t: PAD, w: MAT_W, h: MAT_H };

// All coords are scene-relative, scaled ×0.70 from original
const POS = {
  napkin: { l:  6, t:  6, w: 25, h: 25 },
  fork:   { l: 22, t: 41, w: 12, h: 39 },
  plate:  { l: 36, t: 19, w: 63, h: 63 },
  knife:  { l:102, t: 41, w: 10, h: 39 },
  spoon:  { l:115, t: 41, w: 10, h: 39 },
  glass:  { l:113, t:  6, w: 25, h: 25 },
};

const ALL_ITEMS = ["napkin", "fork", "plate", "knife", "glass"];

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { n:1, color:"#FF6B6B", textDark:false, icon:"count",    text:"Попросить поднять руку тех, кто будет кушать", scene: null },
  { n:2, color:"#FF9F43", textDark:false, icon:"people",   text:"Посчитать количество людей",                  scene: null },
  { n:3, color:"#F9CA24", textDark:true,  icon:null,       text:"Разложить подложки на столе",                 scene:["placemat"] },
  { n:4, color:"#6AB04C", textDark:false, icon:null,       text:"Расставить тарелки",                          scene:["placemat","plate"] },
  { n:5, color:"#22A6B3", textDark:false, icon:null,       text:"Разложить вилки — слева от тарелок",          scene:["placemat","plate","fork"] },
  { n:6, color:"#686DE0", textDark:false, icon:null,       text:"Разложить ножи — справа от тарелок",          scene:["placemat","plate","fork","knife"] },
  { n:7, color:"#A29BFE", textDark:false, icon:null,       text:"Расставить стаканы — сверху справа от тарелок",scene:["placemat","plate","fork","knife","glass"] },
  { n:8, color:"#E17055", textDark:false, icon:null,       text:"Разложить салфетки — сверху слева от тарелок", scene:["placemat","plate","fork","knife","glass","napkin"] },
  { n:9, color:"#00B894", textDark:false, icon:"people",  text:"Пригласить всех к столу",                     scene: null },
];

// ── HTML builders ─────────────────────────────────────────────────────────────

function sceneHTML(active) {
  const hasPlacemat = active.includes("placemat");
  const placematOp  = hasPlacemat ? 1 : 0.07;
  const p = PLACEMAT_RECT;
  const placematDiv = `<div style="position:absolute;left:${p.l}px;top:${p.t}px;width:${p.w}px;height:${p.h}px;background:rgba(245,238,216,${placematOp});border:2px solid rgba(190,175,145,${placematOp});border-radius:14px;box-shadow:inset 0 1px 3px rgba(0,0,0,.06);"></div>`;

  const items = ALL_ITEMS.map((name) => {
    const pos = POS[name];
    const op  = active.includes(name) ? 1 : 0.08;
    return `<img src="${icons[name]}" style="position:absolute;left:${pos.l}px;top:${pos.t}px;width:${pos.w}px;height:${pos.h}px;opacity:${op};object-fit:contain">`;
  }).join("");

  return `<div style="position:relative;width:${SCENE_W}px;height:${SCENE_H}px;flex-shrink:0">${placematDiv}${items}</div>`;
}

function actionHTML(iconName) {
  return `<div style="width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
    <img src="${icons[iconName]}" style="width:50px;height:50px;object-fit:contain">
  </div>`;
}

function stepHTML(step) {
  if (step.type === "label") {
    return `
  <div class="step-label">
    <span class="repeat-icon">↻</span>${step.text}
  </div>`;
  }
  const numColor   = step.textDark ? "#2C2C2C" : "#fff";
  const settingDiv = step.scene ? sceneHTML(step.scene) : actionHTML(step.icon);
  return `
  <div class="step">
    <div class="num" style="background:${step.color};color:${numColor}">${step.n}</div>
    ${settingDiv}
    <div class="txt">${step.text}</div>
  </div>`;
}

// ── Full HTML ─────────────────────────────────────────────────────────────────

const stepsHTML = STEPS.map(stepHTML).join("\n");

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Как накрыть на стол</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#FFF8F0;font-family:'Nunito',Arial,sans-serif;padding:10px}
  .page{max-width:700px;margin:0 auto}
  h1{font-size:26px;font-weight:900;color:#2C2C2C;text-align:center;margin-bottom:2px}
  .sub{text-align:center;font-size:12px;color:#bbb;font-weight:700;margin-bottom:12px}
  .steps{display:flex;flex-direction:column;gap:8px}
  .step{
    display:flex;align-items:center;gap:12px;
    background:#fff;border-radius:14px;
    padding:9px 14px;
    box-shadow:0 2px 8px rgba(0,0,0,.06)
  }
  .num{
    min-width:38px;height:38px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;font-weight:900;flex-shrink:0
  }
  .txt{font-size:17px;font-weight:700;color:#2C2C2C;line-height:1.25;flex:1}
  .step-label{
    display:flex;align-items:center;gap:8px;
    background:#FFF0D6;border-radius:12px;
    padding:8px 16px;
    font-size:16px;font-weight:900;color:#B07000;
    border:2px solid #FFD980;
  }
  .repeat-icon{font-size:18px}
  .footer{text-align:center;margin-top:8px;font-size:11px;color:#ccc;font-weight:700}
  @media print{
    body{background:#fff;padding:10mm}
    .page{max-width:100%}
    .step{break-inside:avoid}
  }
</style>
</head>
<body>
<div class="page">
  <h1>Сервировка стола</h1>
  <div class="steps">
${stepsHTML}
  </div>
  <div class="footer">kaplieva.help</div>
</div>
</body>
</html>`;

fs.writeFileSync(HTML_OUT, html, "utf8");
console.log(`\n✓ HTML saved: ${HTML_OUT}`);
console.log(`  Open in browser to preview, then print as A4.`);
