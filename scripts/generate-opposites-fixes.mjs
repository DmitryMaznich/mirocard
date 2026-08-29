/**
 * generate-opposites-fixes.mjs
 * Regenerates card pairs for the "Противоположности" topic wherever the two
 * poles showed genuinely different objects/scenes/people instead of one
 * object in two states — the defect the whole content-fix pass exists to
 * close. Started as plan Tasks 7-8 (tall_short's tree/tower/fence,
 * full_empty's bucket — docs/superpowers/plans/2026-08-29-opposites-finalization.md)
 * and grew, via a live full-deck visual audit, to cover 24 pairs across 9
 * concepts (see PAIRS below for the current list — this comment is not
 * re-synced automatically, PAIRS is the source of truth for scope).
 *
 * Lesson learned across the whole pass, baked into most prompts below:
 * removing people is the single biggest lever for pair consistency. Nearly
 * every prompt says "no people" — every pair that kept a person (backpack's
 * first attempt, the original clean_car) came back less consistent than the
 * people-free ones on the first try. Where a pair's target dimension is
 * itself size/scale (tree, cake), also pin an explicit frame-percentage and
 * tell the model not to zoom in to compensate — camera auto-compensation
 * for a "smaller" subject was a repeat failure mode.
 *
 * Saves generated WebP images straight into public/decks/opposites_draft/media/
 * (the hand-maintained source folder every opposites_v*.zip has been zipped
 * from) so they can be inspected before the zip is rebuilt.
 *
 * Usage:
 *   node scripts/generate-opposites-fixes.mjs             # generate every pair in PAIRS
 *   node scripts/generate-opposites-fixes.mjs tree tower   # only these ids (unknown ids are silently ignored — check PAIRS for the exact id list before running)
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
    left:  { file: "tall_tree_1.webp",  prompt: `${STYLE}, a single tall young pine tree standing alone in a grassy clearing, straight trunk, full green needles from base to top, vivid green summer grass, a soft hazy blue-green hill treeline on the horizon, clear pale-blue sky with a few thin clouds, warm midday light, camera at standing eye-level about 8 meters from the tree, no other trees crowding the frame. The tree's crown reaches approximately 85% of the frame's height, with only a small margin of grass and sky around it.` },
    right: { file: "short_tree_1.webp", prompt: `${STYLE}, a single short young pine tree — same species and needle color as a taller version of this exact tree, full green needles from base to top — but noticeably shorter, only about knee-to-waist height against the surrounding grass. Must match exactly: the same vivid green summer grass (not dry or golden), the same soft hazy blue-green hill treeline on the horizon, the same clear pale-blue sky with a few thin clouds, the same warm midday lighting and shadow direction, the same camera eye-level height and the same ~8 meter camera distance so the field of view is identical. IMPORTANT: do not zoom in or move the camera closer to compensate for the tree's short height — keep the exact same camera distance as the tall version. The short tree's crown must reach no more than 35% of the frame's height, with wide margins of grass and sky clearly visible on all sides, proving the camera did not move closer. No other trees crowding the frame.` },
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
    id: "river",
    left:  { file: "wide_river_1.webp",  prompt: `${STYLE}, a wide river flowing through a green forested landscape, calm rippling water spanning most of the frame width, tree-lined banks on both sides, overcast daylight, camera at riverbank eye-level, the river spans roughly 75% of the frame's width` },
    right: { file: "narrow_stream_1.webp", prompt: `${STYLE}, the exact same style river — identical water color, identical tree-lined banks, identical overcast daylight — but much narrower, a slim ribbon of water only about 15% of the frame's width, with much more green bank/grass visible on both sides. Same camera position and eye-level height as the wide version — only the river's width differs.` },
  },
  {
    id: "street",
    left:  { file: "wide_street_1.webp",  prompt: `${STYLE}, a wide paved street with several car-lanes and parking on both sides, lined with plain buildings and trees, eye-level view standing on the street looking down its length, daytime, the street's paved width spans most of the frame` },
    right: { file: "narrow_alley_1.webp", prompt: `${STYLE}, the exact same style of paved street — identical building style, identical trees, identical daytime lighting — but much narrower, only wide enough for a single car, same eye-level camera view looking down its length. Same architecture and framing as the wide version — only the street's width differs.` },
  },
  {
    id: "door",
    left:  { file: "wide_door_1.webp",  prompt: `${STYLE}, a single wide interior wooden door standing open in a bright hallway, the door itself notably broad (a wide barn-style single door, not a double door), simple white walls, wooden floor, camera straight-on at eye level, the open doorway spans roughly 55% of the frame's width` },
    right: { file: "narrow_door_1.webp", prompt: `${STYLE}, the exact same style interior wooden door in the exact same bright hallway with simple white walls and wooden floor — identical door color and material — but noticeably narrower, a slim door barely wide enough for one person to pass through. Same camera position, straight-on at eye level — only the door's width differs.` },
  },
  {
    id: "table",
    left:  { file: "wide_table_1.webp",  prompt: `${STYLE}, a wide wooden dining table seen from one end, the tabletop notably broad from side to side, simple dining room with a window, camera at table-eye-level, the table spans roughly 65% of the frame's width` },
    right: { file: "narrow_table_1.webp", prompt: `${STYLE}, the exact same style wooden dining table in the exact same simple dining room with a window — identical wood color and finish — but noticeably narrower, a slim table barely wider than a place setting. Same camera position at table-eye-level — only the table's width differs.` },
  },
  {
    id: "scarf",
    left:  { file: "long_scarf_1.webp",  prompt: `${STYLE}, a long knitted wool scarf in mustard-gold color, laid out in a straight line on a light wooden floor, stretching almost the full length of the frame, soft natural window light, camera directly overhead looking straight down` },
    right: { file: "short_scarf_1.webp", prompt: `${STYLE}, the exact same knitted wool scarf in the exact same mustard-gold color and knit pattern, laid out on the same light wooden floor with the same soft natural light — but a much shorter scarf, only occupying a small portion of the frame's length. Same overhead camera angle — only the scarf's length differs.` },
  },
  {
    id: "long_road",
    left:  { file: "long_road_1.webp",  prompt: `${STYLE}, a straight dirt country road stretching far into the distance under an open sky, simple grassy fields on both sides, camera low at road level looking straight down the road, the road recedes to a tiny point near the horizon showing its full long length` },
    right: { file: "short_road_1.webp", prompt: `${STYLE}, the exact same style dirt country road with the same simple grassy fields on both sides and the same open sky — but a short road that visibly ends at a closed wooden gate only a short distance away, same camera position low at road level. Same road material and framing as the long version — only the road's length differs.` },
  },
  {
    id: "rope",
    left:  { file: "long_rope_1.webp",  prompt: `${STYLE}, a long thick natural-fiber rope laid out in a winding curve on a grassy lawn, stretching almost the full length of the frame, bright daylight, camera directly overhead looking straight down, both frayed rope ends visible` },
    right: { file: "short_rope_1.webp", prompt: `${STYLE}, a short single straight piece of the exact same thick natural-fiber rope — identical color, thickness, and fiber texture as the long version — laid out in a straight line (NOT coiled, NOT looped, NOT wound into a ring or spiral — straight, like a short segment cut from the long rope) on the same grassy lawn with the same bright daylight, both frayed rope ends clearly visible at each end of this short straight piece, occupying only about 20% of the frame's width with plenty of empty grass visible around it. Same overhead camera angle as the long version — only the rope's length differs; it must contain visibly LESS rope material than the long version, not the same amount rearranged.` },
  },
  {
    id: "backpack",
    left:  { file: "full_backpack_1.webp",  prompt: `${STYLE}, a single dark green canvas backpack, fully packed and bulging, unzipped to show it stuffed with books and a water bottle, standing upright on a plain wooden floor against a simple neutral wall background, no hands, no people, straight-on camera angle` },
    right: { file: "empty_backpack_1.webp", prompt: `${STYLE}, the exact same dark green canvas backpack — identical color, shape, and style as the full version — but completely empty and flat/deflated looking, zipped closed, standing upright on the same plain wooden floor against the same simple neutral wall background, no hands, no people, same straight-on camera angle. Only the backpack's fullness differs.` },
  },
  {
    id: "plate",
    left:  { file: "full_plate_1.webp",  prompt: `${STYLE}, a single plain white ceramic dinner plate on a light wooden table, piled with colorful pasta salad (tomatoes, cucumber, olives), a fork resting beside it, simple bright kitchen background, camera at a 45-degree angle from above` },
    right: { file: "empty_plate_1.webp", prompt: `${STYLE}, the exact same plain white ceramic dinner plate — identical shape and rim style — on the same light wooden table with the same fork resting beside it in the same position and the same simple bright kitchen background, but completely empty, no food at all. Same camera angle — only the plate's fullness differs.` },
  },
  {
    id: "shoes",
    left:  { file: "clean_shoes_1.webp",  prompt: `${STYLE}, a pair of white canvas sneakers sitting neatly side by side on a light wooden floor, pristine and spotless, soft natural window light, camera straight-on at floor level` },
    right: { file: "dirty_shoes_1.webp", prompt: `${STYLE}, the exact same pair of white canvas sneakers — identical style, laces, and sole — sitting side by side on the same light wooden floor with the same soft natural window light, but covered in mud splatters and dirt stains. Same camera angle — only the shoes' cleanliness differs.` },
  },
  {
    id: "clean_car",
    left:  { file: "clean_car_1.webp",  prompt: `${STYLE}, a single dark blue Toyota Corolla sedan (this exact make and model, four-door compact sedan body shape, factory badges visible), parked facing left on a plain grey concrete driveway in front of a single-story beige stucco house with a brown tile roof, its paint gleaming clean and shiny, overcast daylight, camera at a three-quarter angle from the front-left, no people` },
    right: { file: "dirty_car_1.webp", prompt: `${STYLE}, the exact same dark blue Toyota Corolla sedan — identical make, model, four-door body shape, badges, and facing direction (facing left) as the clean version — parked on the exact same plain grey concrete driveway in front of the exact same single-story beige stucco house with the same brown tile roof, the same overcast daylight, and the same three-quarter camera angle from the front-left, but covered in mud splatters and dust across the body and wheels. No people. Only the car's cleanliness differs — same car, same house, same driveway, same angle.` },
  },
  {
    id: "bicycle",
    left:  { file: "new_bicycle_1.webp",  prompt: `${STYLE}, a single blue children's bicycle standing on its kickstand on a paved park path, bright shiny new paint, clean tires and chrome parts, daylight, camera at a three-quarter angle, no people` },
    right: { file: "old_bicycle_1.webp", prompt: `${STYLE}, the exact same style and model of blue children's bicycle — identical frame shape and blue color underneath — standing on its kickstand on the exact same paved park path with the same daylight and same three-quarter camera angle, but rusty, faded, and worn, with a cracked seat and dusty chain. No people. Only the bicycle's age/condition differs.` },
  },
  {
    id: "doll",
    left:  { file: "new_doll_1.webp",  prompt: `${STYLE}, a single soft baby doll toy with curly brown hair and a pink polka-dot outfit, sitting upright against a plain light beige background, bright clean studio lighting, camera straight-on` },
    right: { file: "old_doll_1.webp", prompt: `${STYLE}, the exact same style baby doll toy — identical curly brown hair style and pink polka-dot outfit design — sitting upright against the same plain light beige background with the same studio lighting, but faded, worn, with frayed fabric and a scuffed face. Only the doll's age/condition differs.` },
  },
  {
    id: "jacket",
    left:  { file: "new_jacket_1.webp",  prompt: `${STYLE}, a single blue children's rain jacket with an orange zipper, hanging on a wooden hook against a plain white wall, bright clean fabric with crisp folds, daylight, camera straight-on` },
    right: { file: "old_jacket_1.webp", prompt: `${STYLE}, the exact same style blue children's rain jacket with an orange zipper — identical color and design — hanging on the same wooden hook against the same plain white wall with the same daylight, but faded, worn, with a torn sleeve and frayed cuffs. Only the jacket's age/condition differs.` },
  },
  {
    id: "umbrella",
    left:  { file: "wet_umbrella_1.webp",  prompt: `${STYLE}, a single red open umbrella standing upright on a wooden floor, covered in visible water droplets and dripping wet, indoor setting with soft window light, camera straight-on` },
    right: { file: "dry_umbrella_1.webp", prompt: `${STYLE}, the exact same red open umbrella — identical size, shape, and red color — standing upright on the same wooden floor with the same soft window light, but completely dry with no water droplets. Same camera angle — only the umbrella's wetness differs.` },
  },
  {
    id: "socks",
    left:  { file: "wet_socks_1.webp",  prompt: `${STYLE}, a pair of grey socks laid flat on a light wooden table, visibly soaked and dripping with water, a small puddle forming beneath them, soft indoor light, camera directly overhead` },
    right: { file: "dry_socks_1.webp", prompt: `${STYLE}, the exact same pair of grey socks — identical color and style — laid flat on the same light wooden table with the same soft indoor light, but completely dry with no water or puddle. Same overhead camera angle — only the socks' wetness differs.` },
  },
  {
    id: "cake",
    left:  { file: "big_cake_1.webp",  prompt: `${STYLE}, a large multi-tier white buttercream-frosted cake decorated with piped pink buttercream roses, sitting on a silver cake stand on a wooden table, a window in the background, bright indoor light, camera at eye-level showing the whole cake, no people. The cake occupies about 70% of the frame's height.` },
    right: { file: "small_cake_1.webp", prompt: `${STYLE}, a small single-layer white buttercream-frosted cake decorated with the same style piped pink buttercream roses (identical icing technique and rose style to the large version, not fresh flowers), sitting on the same style silver cake stand on the same wooden table with the same window in the background and the same bright indoor light. IMPORTANT: do not zoom in to make the small cake look similar in size to the large one — use the exact same camera distance and eye-level as the large version. The small cake must occupy no more than 30% of the frame's height, with plainly visible empty table space around it, proving the camera did not move closer. No people — only the cake's size differs.` },
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
