// Routine pictograms for daily_orientation's Время суток card: one picture
// per part of the day, each showing what a child typically does then
// (washing up / playing outside / dinner / sleeping) with the sky of that
// time of day, rather than an abstract sun/moon symbol -- the routine
// activity is what makes "утро"/"вечер" concrete for a young child.
//
// Raw generations land in scripts/_daypart_drafts/ for review; the adapted
// versions (square crop, 512px WebP) go to public/daily-orientation/.
//
// Usage:
//   node scripts/generate-daily-orientation-dayparts.mjs              # generate + adapt all
//   node scripts/generate-daily-orientation-dayparts.mjs --ids=night  # regenerate one
//   node scripts/generate-daily-orientation-dayparts.mjs --adapt-only # re-run the sharp step
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DRAFT_DIR = join(ROOT, "scripts", "_daypart_drafts");
const OUT_DIR = join(ROOT, "public", "daily-orientation");
const MODEL = "gemini-3.1-flash-image";
const OUTPUT_SIZE = 512;
const IDS = process.argv.find((a) => a.startsWith("--ids="))?.split("=")[1]?.split(",") ?? null;
const ADAPT_ONLY = process.argv.includes("--adapt-only");
// --variant=b writes <id>.b.raw.png so several candidates can be compared;
// --pick=b copies that candidate over <id>.raw.png before adapting.
const VARIANT = process.argv.find((a) => a.startsWith("--variant="))?.split("=")[1] ?? null;
const PICK = process.argv.find((a) => a.startsWith("--pick="))?.split("=")[1] ?? null;

// v2 style: calm single-colour pictograms (AAC / ISO 7001 public-sign
// language), not a coloured cartoon scene -- the first full-colour set pulled
// the eye away from every other card on the screen. One ink colour matching
// the screen's text (#073d4f) on white; white is keyed out to transparency in
// the adapt step so the card's own pastel shows through.
const STYLE =
  "Minimalist pictogram in the style of an AAC communication symbol or an ISO " +
  "7001 public information sign: smooth solid single-colour silhouettes, flat " +
  "fill, dark teal-navy colour (#073d4f) only, on a plain pure white background. " +
  "A simple child figure made of a round head and rounded body shapes, no face, " +
  "no eyes, no hair detail, no clothing detail, no outlines inside shapes, no " +
  "shading, no gradients, no second colour. Few, large, simple shapes, calm and " +
  "clear, readable at small size. Everything centred with generous white margin " +
  "on all sides, nothing touching the edges. No text, letters or numbers. " +
  "No border, no frame. Square 1:1.";

const TARGETS = [
  {
    id: "morning",
    label: "утро",
    // Waking up, not washing/eating: those happen at other times of day too,
    // and sitting up in bed pairs visually with the night picture (same bed,
    // asleep vs awake).
    prompt: `${STYLE} MORNING: the child figure has just woken up and sits ` +
      "upright in a simple bed with the blanket over the legs, both arms " +
      "stretched straight up above the head in a big wake-up stretch. In the top " +
      "corner, a small half-sun rising over a horizon line with short rays.",
  },
  {
    id: "day",
    label: "день",
    prompt: `${STYLE} DAYTIME: the child figure running and kicking a ball ` +
      "(simple circle) on a flat ground line. In the top corner, a small full " +
      "round sun with short rays.",
  },
  {
    id: "evening",
    label: "вечер",
    // Bath time, not dinner: a meal says nothing about which part of the day
    // it is, a bath before bed is the typical evening-only routine.
    prompt: `${STYLE} EVENING: the child figure sits in a simple bathtub, ` +
      "head and shoulders above the rim, a few round soap bubbles floating " +
      "above the water. In the top corner, a small half-sun setting below a " +
      "horizon line, no rays.",
  },
  {
    id: "night",
    label: "ночь",
    prompt: `${STYLE} NIGHT: the child figure lying asleep in a simple bed ` +
      "under a blanket, head on a pillow. In the top corner, a small crescent " +
      "moon and two small stars.",
  },
].filter((target) => !IDS || IDS.includes(target.id));

mkdirSync(DRAFT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

if (!ADAPT_ONLY) {
  const apiKey = getGeminiApiKey();
  for (const target of TARGETS) {
    process.stdout.write(`  gen   ${target.id} (${target.label})… `);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: target.prompt }] }],
          generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
        }),
      },
    );
    const body = await response.json();
    if (!response.ok) { console.log(`FAILED: ${JSON.stringify(body?.error).slice(0, 300)}`); continue; }
    const image = (body?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!image) { console.log("NO IMAGE"); continue; }
    const buffer = Buffer.from(image.inlineData.data, "base64");
    writeFileSync(join(DRAFT_DIR, `${target.id}${VARIANT ? `.${VARIANT}` : ""}.raw.png`), buffer);
    console.log(`${buffer.length} bytes`);
  }
}

// Adapt: key the white background out to transparency (alpha from how far
// each pixel is from white) and recolour every remaining pixel to the exact
// ink colour, so antialiased edges stay smooth and the card's own pastel
// background shows through. Then trim to the figure, pad back to a centred
// square and export a small WebP.
const INK = { r: 7, g: 61, b: 79 };
const OUTPUT_PADDING = 0.06;

if (VARIANT && !ADAPT_ONLY) process.exit(0); // candidates only; adapt after --pick

for (const target of TARGETS) {
  const rawPath = join(DRAFT_DIR, `${target.id}.raw.png`);
  if (PICK) copyFileSync(join(DRAFT_DIR, `${target.id}.${PICK}.raw.png`), rawPath);
  if (!existsSync(rawPath)) continue;
  const { data, info } = await sharp(rawPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const darkness = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
    const alpha = darkness < 24 ? 0 : Math.min(255, Math.round(((darkness - 24) / (255 - 24 - 60)) * 255));
    rgba[o] = INK.r; rgba[o + 1] = INK.g; rgba[o + 2] = INK.b; rgba[o + 3] = alpha;
  }
  const keyed = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  const trimmed = await sharp(keyed).trim({ threshold: 1 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const inner = Math.round(OUTPUT_SIZE * (1 - 2 * OUTPUT_PADDING));
  const scale = inner / Math.max(meta.width, meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const resized = await sharp(trimmed).resize(w, h).toBuffer();
  const outPath = join(OUT_DIR, `daypart_${target.id}.webp`);
  await sharp({ create: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((OUTPUT_SIZE - w) / 2), top: Math.round((OUTPUT_SIZE - h) / 2) }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(outPath);
  console.log(`  adapt ${target.id} -> ${outPath}`);
}
