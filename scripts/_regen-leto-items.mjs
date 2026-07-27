/**
 * Regenerates all 6 summer (leto) item images with pure white background.
 * Updates the deck ZIP with new images.
 * Usage: node scripts/_regen-leto-items.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import JSZip from "jszip";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS = path.join(__dirname, "..", "public", "decks");

const API_KEY = getGeminiApiKey();
const MODEL = "gemini-3.1-flash-image";

// Style: children's book illustration on PURE white background
const S =
  "soft children's book illustration, warm natural colors, gentle shading and subtle depth, " +
  "clean outlines, PURE WHITE BACKGROUND, no sky gradient, no ground, no scene, no backdrop, " +
  "isolated subject floating on pure white, no text, no people, child-friendly, " +
  "main subject large and centered, easily recognizable at small size, square 1:1 composition";

const ITEMS = [
  {
    file: "item_leto_futbolka.webp",
    prompt: `${S}, a bright yellow short-sleeved children's t-shirt laid flat with sleeves spread out, a small cheerful sun as a printed graphic on the chest`,
  },
  {
    file: "item_leto_shorty.webp",
    prompt: `${S}, a pair of bright blue children's shorts, front view, laid flat with the waistband at the top, simple and clean`,
  },
  {
    file: "item_leto_kepka.webp",
    prompt: `${S}, a bright orange children's baseball cap, shown at a slight 3/4 angle so both dome and brim are clearly visible`,
  },
  {
    file: "item_leto_solnce.webp",
    prompt: `${S}, a single large cheerful summer sun with rounded triangular rays radiating outward, vivid warm yellow-orange, simple flat illustration, NO sky or background — just the sun shape on pure white`,
  },
  {
    file: "item_leto_yagody.webp",
    prompt: `${S}, a small wicker basket filled with bright red strawberries, two loose strawberries with green leaves beside it, juicy and vivid`,
  },
  {
    file: "item_leto_nebo.webp",
    prompt: `${S}, a large cheerful yellow sun with rounded rays on the left, and two big fluffy white cloud shapes outlined in soft gray on the right, both illustrated as flat shapes, clearly separate objects — NOT a sky scene, pure white background`,
  },
];

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart) throw new Error("No image in response");
  return imgPart.inlineData.data;
}

async function generate(item) {
  console.log(`  ${item.file} ...`);
  const data = await callGemini(item.prompt);
  const buf = Buffer.from(data, "base64");
  return await sharp(buf)
    .resize(512, 512, { fit: "cover", position: "center" })
    .webp({ quality: 87, effort: 5 })
    .toBuffer();
}

// Find latest deck ZIP
const zips = fs.readdirSync(DECKS)
  .filter(f => f.startsWith("word_formation_soup_v") && f.endsWith(".zip"))
  .sort((a, b) => {
    const ver = f => f.match(/v(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? [0,0,0];
    const [a1,a2,a3] = ver(a), [b1,b2,b3] = ver(b);
    return a1-b1 || a2-b2 || a3-b3;
  });

const srcName = zips[zips.length - 1];
console.log(`Source: ${srcName}`);
const raw = fs.readFileSync(path.join(DECKS, srcName));
const zip = await JSZip.loadAsync(raw);
const data = JSON.parse(await zip.file("topic.json").async("text"));

// Bump version
const [maj, min, pat] = data.version.split(".").map(Number);
const newVer = `${maj}.${min}.${pat + 1}`;
data.version = newVer;
data.meta.version = newVer;

console.log(`\n=== Generating ${ITEMS.length} summer images ===`);
for (const item of ITEMS) {
  try {
    const imgBuf = await generate(item);
    zip.file(`media/${item.file}`, imgBuf);
    console.log(`    ✓ ${Math.round(imgBuf.length / 1024)} KB`);
    await new Promise(r => setTimeout(r, 1200));
  } catch (e) {
    console.error(`    ✗ ${item.file}: ${e.message}`);
    process.exit(1);
  }
}

zip.file("topic.json", JSON.stringify(data, null, 2));

const outName = `word_formation_soup_v${newVer}.zip`;
const outBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(path.join(DECKS, outName), outBuf);
console.log(`\nWrote ${outName} (${Math.round(outBuf.length / 1024)} KB)`);

// Update catalog.json
const catPath = path.join(DECKS, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
const entry = catalog.decks.find(d => d.id === "word_formation_soup");
entry.version = newVer;
entry.file = outName;
entry.url = `/decks/${outName}`;
entry.zipUrl = `/decks/${outName}`;
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2));

// Remove old ZIP
fs.unlinkSync(path.join(DECKS, srcName));
console.log(`Removed ${srcName}`);
console.log(`Updated catalog → v${newVer}`);
console.log("Done");
