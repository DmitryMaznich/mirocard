// Season illustrations for daily_orientation's Время года card and the
// Времена года modal: one calm, full-bleed landscape per season. The card
// shows it on its top two thirds at reduced opacity with the season's name
// on a plain band underneath, so the pictures must be quiet enough not to
// outshout the neighbouring cards (the lesson from the first, too loud,
// daypart pictograms).
//
// Raw generations -> scripts/_season_drafts/<id>[.<variant>].raw.png,
// adapted (square crop, 640px WebP) -> public/daily-orientation/season_<id>.webp
//
// Usage:
//   node scripts/generate-daily-orientation-seasons.mjs --variant=a      # candidates only
//   node scripts/generate-daily-orientation-seasons.mjs --adapt-only --pick=a
//   node scripts/generate-daily-orientation-seasons.mjs --ids=winter --adapt-only --pick=b
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DRAFT_DIR = join(ROOT, "scripts", "_season_drafts");
const OUT_DIR = join(ROOT, "public", "daily-orientation");
const MODEL = "gemini-3.1-flash-image";
const OUTPUT_SIZE = 640;
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const IDS = arg("ids")?.split(",") ?? null;
const VARIANT = arg("variant") ?? null;
const PICK = arg("pick") ?? null;
const ADAPT_ONLY = process.argv.includes("--adapt-only");

const STYLE =
  "Soft flat vector illustration of a calm landscape for a children's calendar " +
  "card. Gentle muted pastel palette, simple rounded shapes, very few details, " +
  "no outlines, no gradients or texture, no people, no animals, no text, " +
  "letters or numbers. Unmistakable at a glance which season it is. " +
  "FULL-BLEED: the scene fills the whole square image and is cut off by all " +
  "four edges -- no frame, no border, no rounded corners, no white margin, not " +
  "a card or sticker. The main season cue sits in the upper and middle part of " +
  "the image. Square 1:1.";

const TARGETS = [
  { id: "winter", prompt: `${STYLE} WINTER: gentle snowy hills, a few snow-covered fir trees, soft falling snowflakes, pale blue-grey sky.` },
  { id: "spring", prompt: `${STYLE} SPRING: a young tree with light pink blossoms, fresh light-green grass with small white and yellow flowers, a few sprouting leaves, soft blue sky.` },
  { id: "summer", prompt: `${STYLE} SUMMER: a sunny green meadow with daisies, a round warm sun, one leafy green tree, clear light-blue sky.` },
  { id: "autumn", prompt: `${STYLE} AUTUMN: trees with orange, yellow and red leaves, a few leaves falling, fallen leaves on the ground, soft overcast warm sky.` },
].filter((target) => !IDS || IDS.includes(target.id));

mkdirSync(DRAFT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

if (!ADAPT_ONLY) {
  const apiKey = getGeminiApiKey();
  for (const target of TARGETS) {
    process.stdout.write(`  gen   ${target.id}${VARIANT ? `.${VARIANT}` : ""}… `);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: target.prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    });
    const body = await response.json();
    if (!response.ok) { console.log(`FAILED: ${JSON.stringify(body?.error).slice(0, 300)}`); continue; }
    const image = (body?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!image) { console.log("NO IMAGE"); continue; }
    const buffer = Buffer.from(image.inlineData.data, "base64");
    writeFileSync(join(DRAFT_DIR, `${target.id}${VARIANT ? `.${VARIANT}` : ""}.raw.png`), buffer);
    console.log(`${buffer.length} bytes`);
  }
  if (VARIANT) process.exit(0); // candidates only; adapt after --pick
}

// Adapt: a small fixed inset guards against the model's occasional thin
// frame (seen on the daypart drafts), then a square 640px WebP.
const INSET = 0.03;
for (const target of TARGETS) {
  const rawPath = join(DRAFT_DIR, `${target.id}.raw.png`);
  if (PICK) copyFileSync(join(DRAFT_DIR, `${target.id}.${PICK}.raw.png`), rawPath);
  if (!existsSync(rawPath)) continue;
  const { width, height } = await sharp(rawPath).metadata();
  const side = Math.round(Math.min(width, height) * (1 - 2 * INSET));
  const outPath = join(OUT_DIR, `season_${target.id}.webp`);
  await sharp(rawPath)
    .extract({ left: Math.round((width - side) / 2), top: Math.round((height - side) / 2), width: side, height: side })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .webp({ quality: 80 })
    .toFile(outPath);
  console.log(`  adapt ${target.id} -> ${outPath}`);
}
