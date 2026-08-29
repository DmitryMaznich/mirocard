/**
 * generate-opposites-fixes.mjs
 * Regenerates the mismatched card pairs found in the "Противоположности"
 * audit — plan Tasks 7 and 8 (docs/superpowers/plans/2026-08-29-opposites-finalization.md):
 *
 *  - tall_short: tree_bush/mountain_hill/building_house compared different
 *    OBJECTS across the pole (dерево vs куст, гора vs холм, дом vs домик).
 *    Replaced with same-object pairs: tree/tree, tower/tower, fence/fence.
 *  - full_empty: the "bucket" pair used two different buckets (blue metal
 *    vs yellow plastic). Replaced with one bucket, water added/removed.
 *
 * Saves generated WebP images straight into public/decks/opposites_draft/media/
 * (the hand-maintained source folder every opposites_v*.zip has been zipped
 * from) so they can be inspected before the zip is rebuilt.
 *
 * Usage:
 *   node scripts/generate-opposites-fixes.mjs            # generate all 8 images
 *   node scripts/generate-opposites-fixes.mjs tree tower  # only these ids
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const MEDIA_DIR = path.join(ROOT, "public", "decks", "opposites_draft", "media");

const API_KEY = getGeminiApiKey();
const MODEL   = process.env.GEMINI_MODEL || "gemini-3.1-flash-image";

const STYLE = "photorealistic photograph, natural daylight, single subject filling most of the frame, clean simple background, no people, no hands, no text, no watermark, no logos, high resolution, square 1:1 composition";

const PAIRS = [
  {
    id: "tree",
    left:  { file: "tall_tree_1.webp",  prompt: `${STYLE}, a single tall young pine tree standing alone in a grassy clearing, straight trunk, full green needles from base to top, clear blue sky background, no other trees crowding the frame` },
    right: { file: "short_tree_1.webp", prompt: `${STYLE}, a single short young pine tree — same species, same grassy clearing, same clear blue sky background, same camera angle and framing as a taller version of this exact tree — but noticeably shorter, only about knee-to-waist height against the surrounding grass, full green needles from base to top, no other trees crowding the frame` },
  },
  {
    id: "tower",
    left:  { file: "tall_tower_1.webp",  prompt: `${STYLE}, a single tall white lighthouse-style tower standing alone against a clear blue sky, round tapering shape with a red-striped band near the top, simple grassy ground at its base, no other buildings` },
    right: { file: "short_tower_1.webp", prompt: `${STYLE}, a single short lighthouse-style tower — identical white color, red-striped band, round tapering shape and material as a taller version of this exact tower — standing alone against the same clear blue sky and simple grassy ground, same camera angle and framing, but noticeably shorter, only about as tall as a garden shed, no other buildings` },
  },
  {
    id: "fence",
    left:  { file: "tall_fence_1.webp",  prompt: `${STYLE}, a single straight wooden picket fence section filling the frame, tall pickets, natural light-brown wood color, simple green grass in front of it, clear sky above, no gate` },
    right: { file: "short_fence_1.webp", prompt: `${STYLE}, a single straight wooden picket fence section — identical light-brown wood color, picket style and material as a taller version of this exact fence — filling the frame, but noticeably low, only about knee height, same simple green grass in front of it and clear sky above, same camera angle and framing, no gate` },
  },
  {
    id: "bucket",
    left:  { file: "full_bucket_1.webp",  prompt: `${STYLE}, a single galvanized steel bucket painted matte cornflower-blue, slightly worn/weathered paint, metal handle resting down flat against the left side of the bucket, sitting on a wooden outdoor deck, filled to the brim with clear water, water surface visible and reflecting light, simple blurred green garden background, straight-on eye-level shot` },
    right: { file: "empty_bucket_1.webp", prompt: `${STYLE}, a single galvanized steel bucket painted matte cornflower-blue, slightly worn/weathered paint (identical exact shade, finish and wear pattern to a full version of this exact bucket), metal handle resting down flat against the left side of the bucket (not upright), sitting on the same wooden outdoor deck with the same blurred green garden background, same straight-on eye-level camera angle and distance — but completely empty and dry inside, no water at all` },
  },
];

async function callGemini(prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart) throw new Error("No image in response");
  return Buffer.from(imgPart.inlineData.data, "base64");
}

async function generateOne(item, label) {
  process.stdout.write(`  [img] ${label} (${item.file}) ... `);
  const raw = await callGemini(item.prompt);
  const webp = await sharp(raw).resize(512, 512, { fit: "cover", position: "center" }).webp({ quality: 90 }).toBuffer();
  const outPath = path.join(MEDIA_DIR, item.file);
  fs.writeFileSync(outPath, webp);
  console.log(`✓ ${Math.round(webp.length / 1024)} KB -> ${path.relative(ROOT, outPath)}`);
}

async function main() {
  const only = process.argv.slice(2);
  const targets = only.length ? PAIRS.filter((p) => only.includes(p.id)) : PAIRS;
  if (!targets.length) { console.error("No matching pair id(s)."); process.exit(1); }

  console.log(`Model: ${MODEL}\n`);
  for (const pair of targets) {
    console.log(`▶ ${pair.id}`);
    await generateOne(pair.left, `${pair.id} (left)`);
    await new Promise((r) => setTimeout(r, 800));
    await generateOne(pair.right, `${pair.id} (right)`);
    await new Promise((r) => setTimeout(r, 800));
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
