// Adds a brand-new representation type per concept (boy/girl/man/woman):
// a classical-style statue. User's own idea, alongside gendered photos and
// a second illustration style - "скульптуры, потому что это тоже
// изображение полов". Pooled into the same offphoto_find_n mode as
// pictogram/illustration (engine.js's generateCardTypeFindNTasks now takes
// cardTypes ["pictogram", "illustration", "sculpture"]) - all three test
// the same thing: does the word transfer beyond a photograph.
//
// Classical marble-statue style, modestly draped (a simple tunic/toga, not
// nude classical convention) since this app is for young children. Same
// defect-prone-model mitigations as the illustration scripts: generate raw,
// then deterministically normalize scale/baseline in code.
//
// Usage: node scripts/generate-people-names-sculptures.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const OUT_DIR = join(ROOT, "scripts/_sculpture_drafts");
const API_KEY = getGeminiApiKey();
const MODEL   = "gemini-3.1-flash-image";

const STYLE =
  "a classical marble statue, museum photograph, smooth carved white " +
  "marble, matte stone texture with soft natural shadows, standing full " +
  "figure on a plain rectangular stone plinth, modestly draped in a " +
  "simple carved tunic (not nude), gentle idealized facial features with " +
  "no painted color, plain neutral grey studio background, soft even " +
  "lighting, photorealistic sculpture render, no text, no plaque, no " +
  "other statues in frame, sharp focus, high detail, square 1:1 " +
  "composition, entire statue including plinth clearly visible with " +
  "margin, no cropping";

const TARGETS = [
  {
    id: "boy_sculpture",
    label: "мальчик (скульптура)",
    prompt: `${STYLE}. A statue of a young boy, child-sized proportions ` +
      `(short, larger head-to-body ratio than an adult statue), short ` +
      `carved hair, wearing a simple short tunic, standing with arms at ` +
      `sides.`,
  },
  {
    id: "girl_sculpture",
    label: "девочка (скульптура)",
    prompt: `${STYLE}. A statue of a young girl, child-sized proportions ` +
      `(short, larger head-to-body ratio than an adult statue), long ` +
      `carved hair in a simple braid, wearing a simple ankle-length ` +
      `draped tunic dress, standing with arms at sides.`,
  },
  {
    id: "man_sculpture",
    label: "мужчина (скульптура)",
    prompt: `${STYLE}. A statue of a grown man, tall adult proportions, ` +
      `clearly taller and more elongated than a child statue, short ` +
      `carved hair, a strong athletic carved physique visible through a ` +
      `simple draped toga over one shoulder, standing in a classical ` +
      `contrapposto pose.`,
  },
  {
    id: "woman_sculpture",
    label: "женщина (скульптура)",
    prompt: `${STYLE}. A statue of a grown woman, tall adult proportions, ` +
      `clearly taller and more elongated than a child statue, long carved ` +
      `hair gathered in a classical updo, wearing a flowing ankle-length ` +
      `draped gown, standing in a graceful classical pose.`,
  },
];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const force = process.argv.includes("--force");

for (const target of TARGETS) {
  const rawPathCheck = join(OUT_DIR, `${target.id}.raw.png`);
  if (!force && existsSync(rawPathCheck)) {
    console.log(`  skip  ${target.id}  (raw already exists)`);
    continue;
  }
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

// Same deterministic baseline/scale normalization as the pictogram and
// illustration scripts: two independent generations never land on a
// reliable relative scale on their own. Trim each render to its content box
// (statue + plinth together, as one unit), resize to a fixed height per age
// group, and composite onto a shared canvas with every plinth's bottom edge
// on the same baseline row - matches the same 560px/780px convention
// already used for pictograms and illustrations, so "child" and "adult"
// read at a consistent relative scale across all three representation
// styles.
const CANVAS = 1024;
const BASELINE_Y = 980;
const HEIGHTS = {
  boy_sculpture: 620, girl_sculpture: 620,
  man_sculpture: 860, woman_sculpture: 860,
};

for (const target of TARGETS) {
  const rawPath = join(OUT_DIR, `${target.id}.raw.png`);
  if (!existsSync(rawPath)) continue;
  // Sculpture backdrops are a soft studio gradient/vignette, not a flat
  // color like the pictogram/illustration white backgrounds - sampling one
  // corner pixel for a flat canvas fill left a visible two-tone seam where
  // the flat fill met the trimmed content's own gradient edge. Fixed by
  // deriving the padding from the photo itself: a heavily blurred, cropped-
  // to-cover copy of the same raw render, so the fill color always matches
  // wherever the resized content's edge lands.
  const rawCorner = await sharp(rawPath).raw().toBuffer({ resolveWithObject: true });
  const rawBgHex = `#${[rawCorner.data[0], rawCorner.data[1], rawCorner.data[2]]
    .map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const trimmed = await sharp(rawPath).trim({ background: rawBgHex, threshold: 15 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const targetHeight = HEIGHTS[target.id];
  const targetWidth = Math.round((meta.width / meta.height) * targetHeight);
  const resized = await sharp(trimmed).resize(targetWidth, targetHeight).toBuffer();
  // A large gaussian blur alone still left a visible ghost silhouette of
  // the statue - downsampling to a tiny size first destroys all shape
  // detail (only the rough color/gradient survives), then upscaling gives
  // a smooth, shapeless backdrop with no ghosting.
  const blurredBackdrop = await sharp(rawPath)
    .resize(6, 6, { fit: "cover" })
    .resize(CANVAS, CANVAS, { fit: "cover", kernel: "cubic" })
    .blur(20)
    .toBuffer();
  const composed = await sharp(blurredBackdrop)
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

console.log("\nDone. Review each statue photo, then wire the 4 new cards into tools/people_names/topic.json.");
