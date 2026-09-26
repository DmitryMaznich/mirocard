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
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

// Same child in all four so the set reads as one story of one day, and the
// same flat style so no picture stands out as "the odd one" on the wall
// display. No text: the card prints the word itself.
const STYLE =
  "Flat vector illustration for a children's picture schedule card. Simple " +
  "rounded shapes, soft friendly colours, clean dark outlines, no gradients " +
  "or texture, no small details, readable at small size. One small child " +
  "(about 5 years old, short brown hair, round friendly face, gender-neutral) " +
  "is the clear main subject, shown large, centred. FULL-BLEED: the scene's " +
  "background colour and objects run all the way to all four edges of the " +
  "image and are cut off by the image edge -- do NOT draw the picture as a " +
  "card, sticker, icon tile or framed picture; no outline around the image, " +
  "no rounded corners, no white margin, no drop shadow. Absolutely no text, " +
  "letters or numbers anywhere. Square 1:1.";

const TARGETS = [
  {
    id: "morning",
    label: "утро",
    prompt: `${STYLE} MORNING: the child in a yellow t-shirt washes their face ` +
      "at a bathroom sink, water splashing, a towel nearby. Through a window " +
      "behind them, a soft pink-and-peach sunrise with the sun just above the horizon.",
  },
  {
    id: "day",
    label: "день",
    prompt: `${STYLE} DAYTIME: the child in a yellow t-shirt plays outside on ` +
      "green grass with a ball, a bright blue sky with a big round yellow sun " +
      "high up and one or two white clouds.",
  },
  {
    id: "evening",
    label: "вечер",
    prompt: `${STYLE} EVENING: the child in a yellow t-shirt sits at a table ` +
      "eating dinner from a plate with a spoon, a warm lamp glowing. Through a " +
      "window behind them, an orange-and-purple sunset with the sun half below the horizon.",
  },
  {
    id: "night",
    label: "ночь",
    prompt: `${STYLE} NIGHT: the child in light blue pyjamas sleeps peacefully ` +
      "in bed under a blanket, eyes closed, head on a pillow. Through a window, a " +
      "dark navy night sky with a crescent moon and a few stars. The room is dim but " +
      "the child is still clearly visible.",
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
    writeFileSync(join(DRAFT_DIR, `${target.id}.raw.png`), buffer);
    console.log(`${buffer.length} bytes`);
  }
}

// Adapt: despite the prompt the model sometimes draws its own rounded card
// frame (white corners, a dark outline just inside the edge -- the first
// morning/evening drafts both did), which trim() can't remove because the
// corners aren't a uniform edge. So cut a fixed 5% inset off every side,
// then export a small square WebP (the card rounds its own corners and shows
// it at ~220px CSS; 512px covers 2x screens).
const INSET = 0.05;
for (const target of TARGETS) {
  const rawPath = join(DRAFT_DIR, `${target.id}.raw.png`);
  if (!existsSync(rawPath)) continue;
  const { width, height } = await sharp(rawPath).metadata();
  const side = Math.min(width, height);
  const cropSide = Math.round(side * (1 - 2 * INSET));
  const outPath = join(OUT_DIR, `daypart_${target.id}.webp`);
  await sharp(rawPath)
    .extract({
      left: Math.round((width - cropSide) / 2),
      top: Math.round((height - cropSide) / 2),
      width: cropSide,
      height: cropSide,
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toFile(outPath);
  console.log(`  adapt ${target.id} -> ${outPath}`);
}
