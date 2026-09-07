// Adds a second illustration per concept with more conventionally
// pronounced gender markers than the existing 4 illustrations (which use
// only hair length, matching the original 8 photos' one consistent cue).
// Now that gendered photos exist too (generate-people-names-gendered-photos),
// a dress-coded illustration is no longer an invented rule - it reflects
// real variation now present in the photo set. Additive: the original 4
// illustrations stay as they are.
//
// Same flat children's-book illustration style as
// generate-people-names-illustrative.mjs, with the same defect-prone-model
// mitigations (generate raw, then deterministically normalize scale/
// baseline in code).
//
// Usage: node scripts/generate-people-names-gendered-illustrations.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const OUT_DIR = join(ROOT, "scripts/_gendered_illustration_drafts");
const API_KEY = getGeminiApiKey();
const MODEL   = "gemini-3.1-flash-image";

const STYLE =
  "simple flat children's-book illustration of a full standing human " +
  "figure, clean bold black outline, flat solid color fill with a little " +
  "soft shading, a simple friendly face with two dot eyes and a small " +
  "smile (no other facial detail), plain solid white background, no text " +
  "or letters anywhere, no border, no rounded rectangle frame, no drop " +
  "shadow, the full figure (head to feet, both arms, both legs) must be " +
  "entirely visible within the frame with generous margin, centered, " +
  "symmetric standing pose facing forward, arms relaxed at sides, no " +
  "cropping, no missing limbs, square 1:1 composition, easily recognizable " +
  "at small size";

const TARGETS = [
  {
    id: "boy_illustration_cap",
    label: "мальчик (иллюстрация 2)",
    prompt: `${STYLE}. A young child boy: short hair under a baseball cap ` +
      `worn backwards, a plain colorful t-shirt and shorts, sneakers.`,
  },
  {
    id: "girl_illustration_bow",
    label: "девочка (иллюстрация 2)",
    prompt: `${STYLE}. A young child girl: hair in a high ponytail with a ` +
      `big bow, a colorful knee-length dress with a skirt, both legs and ` +
      `both shoes clearly visible below the dress hem, mary-jane shoes.`,
  },
  {
    id: "man_illustration_mustache",
    label: "мужчина (иллюстрация 2)",
    prompt: `${STYLE}. A grown adult man, clearly taller and more ` +
      `elongated than a child: short hair, a mustache, a plain colorful ` +
      `polo shirt and trousers, shoes.`,
  },
  {
    id: "woman_illustration_heels",
    label: "женщина (иллюстрация 2)",
    prompt: `${STYLE}. A grown adult woman, clearly taller and more ` +
      `elongated than a child: long hair past the shoulders with a hair ` +
      `clip, a colorful knee-length dress with a flared skirt, high ` +
      `heels clearly visible below the dress hem.`,
  },
];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  process.stdout.write(`  gen   ${target.id}  (${target.label})... `);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: target.prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );
  const body = await res.json();
  if (!res.ok) {
    console.log(`FAILED: ${JSON.stringify(body?.error).slice(0, 300)}`);
    continue;
  }
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart) {
    console.log(`NO IMAGE: ${JSON.stringify(parts).slice(0, 300)}`);
    continue;
  }
  const buf = Buffer.from(imgPart.inlineData.data, "base64");
  const rawPath = join(OUT_DIR, `${target.id}.raw.png`);
  writeFileSync(rawPath, buf);
  console.log(`${buf.length} bytes -> ${rawPath}`);
}

// Same deterministic baseline/scale normalization as the first illustration
// batch - the model's own relative sizing across independent generations is
// not trustworthy enough to encode "child vs adult" on its own.
const CANVAS = 1024;
const BASELINE_Y = 960;
const HEIGHTS = {
  boy_illustration_cap: 560, girl_illustration_bow: 560,
  man_illustration_mustache: 780, woman_illustration_heels: 780,
};

for (const target of TARGETS) {
  const rawPath = join(OUT_DIR, `${target.id}.raw.png`);
  if (!existsSync(rawPath)) continue;
  const trimmed = await sharp(rawPath).trim({ background: "#ffffff", threshold: 20 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const targetHeight = HEIGHTS[target.id];
  const targetWidth = Math.round((meta.width / meta.height) * targetHeight);
  const resized = await sharp(trimmed).resize(targetWidth, targetHeight).toBuffer();
  const composed = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: "#ffffff" },
  })
    .composite([{
      input: resized,
      left: Math.round((CANVAS - targetWidth) / 2),
      top: BASELINE_Y - targetHeight,
    }])
    .png()
    .toBuffer();
  const outPath = join(OUT_DIR, `${target.id}.png`);
  writeFileSync(outPath, composed);
  console.log(`  norm  ${target.id}  height=${targetHeight}px -> ${outPath}`);
}
