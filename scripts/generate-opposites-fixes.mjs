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
    left:  { file: "tall_tree_1.webp",  prompt: `${STYLE}, a single tall young pine tree standing alone in a grassy clearing, straight trunk, full green needles from base to top, vivid green summer grass, a soft hazy blue-green hill treeline on the horizon, clear pale-blue sky with a few thin clouds, warm midday light, camera at standing eye-level about 8 meters from the tree, no other trees crowding the frame` },
    right: { file: "short_tree_1.webp", prompt: `${STYLE}, a single short young pine tree — same species and needle color as a taller version of this exact tree, full green needles from base to top — but noticeably shorter, only about knee-to-waist height against the surrounding grass. Must match exactly: the same vivid green summer grass (not dry or golden), the same soft hazy blue-green hill treeline on the horizon, the same clear pale-blue sky with a few thin clouds, the same warm midday lighting and shadow direction, the same camera eye-level height and the same ~8 meter camera distance so the field of view is identical — only the tree's height differs, everything else in the frame must look like the same location on the same day. No other trees crowding the frame.` },
  },
  {
    id: "tower",
    left:  { file: "tall_tower_1.webp",  prompt: `${STYLE}, a single tall white lighthouse-style tower standing alone against a clear blue sky, round tapering shape with a red-striped band near the top, simple grassy ground at its base, no other buildings` },
    right: { file: "short_tower_1.webp", prompt: `${STYLE}, a single short lighthouse-style tower — identical white color, red-striped band, round tapering shape and material as a taller version of this exact tower — standing alone against the same clear blue sky and simple grassy ground, same camera angle and framing, but noticeably shorter, only about as tall as a garden shed, no other buildings` },
  },
  {
    id: "fence",
    left:  { file: "tall_fence_1.webp",  prompt: `${STYLE}, a single straight wooden picket fence section filling the frame, tall pickets reaching about chest height on an adult, natural light-brown wood color, short mowed green grass in front of it, a row of dense green garden bushes directly behind the fence filling the upper background, soft overcast daylight, camera at standing eye-level directly facing the fence, no gate` },
    right: { file: "short_fence_1.webp", prompt: `${STYLE}, a single straight wooden picket fence section — identical light-brown wood color, picket style and material as a taller version of this exact fence — filling the frame, but noticeably low, only about knee height. Must match exactly: the same short mowed green grass in front of it, the same row of dense green garden bushes directly behind the fence filling the upper background (not an open lawn or horizon), the same soft overcast daylight, the same camera eye-level height and the same distance/framing directly facing the fence — only the fence's height differs, everything else in the frame must look like the same location. No gate.` },
  },
  {
    id: "tea",
    left:  { file: "hot_tea_1.webp",  prompt: `${STYLE}, a plain white ceramic mug with exactly ONE handle on the right side (a normal everyday coffee mug, not a two-handled cup), filled with tea, steam rising visibly from the surface, sitting on a light wooden table, a softly blurred cozy living-room background, straight-on eye-level shot, camera positioned so the mug spans exactly 55% of the frame's width with clear margin above, below, and to both sides` },
    right: { file: "cold_tea_1.webp", prompt: `${STYLE}, an identical plain white ceramic mug with exactly ONE handle on the right side (a normal everyday coffee mug, not a two-handled cup — same exact shape, size, and single handle as a hot version of this exact mug) — filled with the same tea but iced, a few ice cubes visible floating at the top, visible water-condensation droplets on the outside of the mug, sitting on the same light wooden table with the same softly blurred cozy living-room background. CRITICAL: use the exact same camera distance, height, and zoom as the hot version — the mug must span exactly 55% of the frame's width, identical to the hot version, so the mug appears exactly the same physical size in both photos, only the tea's temperature cues differ (steam vs. ice+condensation). The mug has only one handle, on the right side only.` },
  },
  {
    id: "campfire",
    left:  { file: "hot_campfire_1.webp",  prompt: `${STYLE}, a small campfire burning brightly in a ring of stones, vivid orange-yellow flames and glowing embers, a few logs, set in a forest clearing campsite, dusk lighting so the flames glow warmly against the darkening surroundings, camera at low eye-level about 3 meters away, the stone fire ring spans roughly 55% of the frame's width` },
    right: { file: "cold_campfire_1.webp", prompt: `${STYLE}, the exact same ring of stones in the exact same forest clearing campsite as a burning campfire — identical stone arrangement, identical logs laid out the same way, identical background trees — but now completely extinguished and cold: grey-white cold ash, blackened charred wood, no flame, no glow, no smoke rising. Daylight morning lighting (since there is no fire glow to see at night). Same camera distance, height and angle so the stone fire ring spans the same ~55% of the frame's width — only the fire's presence/absence differs.` },
  },
  {
    id: "boulder",
    left:  { file: "hot_rock_1.webp",  prompt: `${STYLE}, a single large smooth grey boulder sitting alone in a grassy meadow, bright hazy midsummer sunlight, visible heat-shimmer distortion rising just above the sunlit rock surface, vivid green grass around it, clear blue sky, camera at eye-level about 4 meters away, the boulder spans roughly 55% of the frame's width` },
    right: { file: "cold_rock_1.webp", prompt: `${STYLE}, the exact same large smooth grey boulder — identical shape, size, and surface texture as the sunlit version of this exact rock — sitting alone in the same grassy meadow spot, but now covered in a thin layer of white frost and a light dusting of snow on top, the surrounding grass also frosted pale white, flat pale winter daylight, no heat shimmer. Same camera distance, height and angle so the boulder spans the same ~55% of the frame's width — only the temperature/season differs.` },
  },
  {
    id: "pavement",
    left:  { file: "hot_pavement_1.webp",  prompt: `${STYLE}, a straight asphalt road stretching away into the distance, bright midsummer sun, visible heat-haze shimmer distortion rising off the dark road surface, clear blue sky, simple grassy verges on both sides, camera positioned low at road level looking straight down the road, the road fills roughly the lower half of the frame with the horizon at the midline` },
    right: { file: "cold_pavement_1.webp", prompt: `${STYLE}, the exact same straight asphalt road stretching away into the distance — identical road width, curve, and grassy verges as the summer version of this exact road — but now covered in a layer of snow and patchy ice, pale overcast winter sky, no heat haze. Same camera position, low at road level looking straight down the road, same framing with the horizon at the midline — only the season/temperature differs.` },
  },
  {
    id: "bucket",
    left:  { file: "full_bucket_1.webp",  prompt: `${STYLE}, a single galvanized steel bucket painted matte cornflower-blue, slightly worn/weathered paint, metal handle resting down flat against the left side of the bucket, sitting on a wooden outdoor deck, filled to the brim with clear water, water surface visible and reflecting light, simple blurred green garden background, straight-on eye-level shot, camera positioned so the bucket's rim spans exactly 70% of the frame's width and the whole bucket including the deck surface it sits on is visible with a small margin above and below` },
    right: { file: "empty_bucket_1.webp", prompt: `${STYLE}, a single galvanized steel bucket painted matte cornflower-blue, slightly worn/weathered paint (identical exact shade, finish and wear pattern to a full version of this exact bucket, identical size and proportions — same bucket, not a smaller or larger one), metal handle resting down flat against the left side of the bucket (not upright), sitting on the same wooden outdoor deck with the same blurred green garden background. CRITICAL: use the exact same camera distance, height, and zoom as the full version — the bucket's rim must span exactly 70% of the frame's width, identical to the full version, so the bucket appears exactly the same physical size in both photos, only the water is different. But completely empty and dry inside, no water at all.` },
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
