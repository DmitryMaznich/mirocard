// Draft "illustrative" pictogram icons for people_names Phase 4 — a second,
// friendlier representation style alongside the restroom-sign-style
// geometric pictograms (generate-people-names-pictograms.mjs). Where the
// restroom-sign style tests transfer to a pure abstract symbol, this style
// tests transfer to a simple colored cartoon illustration - a third
// representation of the same category word, between "real photo" and
// "abstract sign".
//
// First attempt (kept only in git history/chat) had real generation defects
// (a figure missing legs, another missing its face) and unreliable relative
// child/adult scale. Same fix as the pictogram script: generate raw, then
// deterministically normalize scale/baseline in code — never trust the
// model's own relative sizing across independent generations.
//
// Usage: node scripts/generate-people-names-illustrative.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const OUT_DIR = join(ROOT, "scripts/_illustrative_drafts");
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

// v1 dressed girl/woman in a skirt and boy/man in trousers (the common
// cartoon convention) — but none of people_names' 8 real photos put anyone
// in a dress; every one of them (boy_peter, girl_olga, man_igor, woman_anna,
// etc.) wears trousers, and hair length is the one feature that's actually
// consistent across every real photo (short for boy/man, longer for
// girl/woman). A probe meant to test whether the word transfers to a new
// representation must use the visual cue the child actually learned, not a
// new one (a dress) the training photos never showed. Fixed: everyone wears
// trousers + a top; only hair length differs by gender, matching the photos.
const TARGETS = [
  {
    id: "illustrative_boy",
    label: "мальчик",
    prompt: `${STYLE}. A young child boy: short hair, a plain colorful ` +
      `t-shirt and trousers, sneakers.`,
  },
  {
    id: "illustrative_girl",
    label: "девочка",
    prompt: `${STYLE}. A young child girl: hair in two short pigtails, a ` +
      `plain colorful t-shirt and trousers (same silhouette as the boy ` +
      `icon, not a dress or skirt), sneakers.`,
  },
  {
    id: "illustrative_man",
    label: "мужчина",
    prompt: `${STYLE}. A grown adult man, clearly taller and more ` +
      `elongated than a child: short hair, a plain colorful shirt and ` +
      `trousers, shoes.`,
  },
  {
    id: "illustrative_woman",
    label: "женщина",
    prompt: `${STYLE}. A grown adult woman, clearly taller and more ` +
      `elongated than a child: shoulder-length hair, a plain colorful top ` +
      `and trousers (same silhouette as the man icon, not a dress or ` +
      `skirt), shoes.`,
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

// Same deterministic baseline/scale normalization as the pictogram script:
// trim each figure to its own content box, resize to a fixed per-age-group
// height, and composite onto a shared canvas with every figure's feet on
// the same baseline row - the model's own relative sizing across
// independent generations is not trustworthy enough to encode "child vs
// adult" on its own.
const CANVAS = 1024;
const BASELINE_Y = 960;
const HEIGHTS = { illustrative_boy: 560, illustrative_girl: 560, illustrative_man: 780, illustrative_woman: 780 };

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
