/**
 * Generates item images for word_formation_soup season overview cards.
 * Style: soft children's book illustration with seasonal context props.
 * Usage: node scripts/generate-season-items.mjs
 * Output: scripts/season_items_output/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "season_items_output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";
const MODEL = "gemini-3.1-flash-image";

const S =
  "soft children's book illustration, warm natural colors, gentle shading and subtle depth, " +
  "clean outlines but not flat, white background, no text, no people, child-friendly, " +
  "main subject large and centered filling most of the frame, " +
  "easily recognizable at small size, square 1:1 composition";

const ITEMS = [
  // ── ОСЕНЬ ───────────────────────────────────────────────────
  {
    file: "item_osen_listya.webp",
    prompt: `${S}, three large autumn maple leaves in bright orange, deep red and golden yellow arranged as a loose fan, a couple of small acorns tucked beside them, warm autumn light`,
  },
  {
    file: "item_osen_griby.webp",
    prompt: `${S}, two large porcini mushrooms (белые грибы) with fat brown caps and pale thick stems growing from a small mossy ground patch, one fallen orange autumn leaf resting beside them`,
  },
  // ── ЗИМА ────────────────────────────────────────────────────
  {
    file: "item_zima_shapka.webp",
    prompt: `${S}, a cozy bright red knitted winter beanie with a fluffy white pompom on top and white snowflake pattern, three or four delicate snowflakes drifting around it on the white background`,
  },
  {
    file: "item_zima_sapogi.webp",
    prompt: `${S}, a pair of warm felt winter boots (валенки) in soft grey-beige color with rounded toes, sitting on a small neat pile of white snow with a couple of snowflakes nearby`,
  },
  {
    file: "item_zima_varezhki.webp",
    prompt: `${S}, a pair of bright red knitted mittens with a white snowflake pattern, laid side by side, a few small snowflakes scattered around them`,
  },
  {
    file: "item_zima_gorka.webp",
    prompt: `${S}, a snowy hill slide seen from the side — a smooth white snow slope going from upper right down to lower left, a small wooden ladder on the left, soft blue sky visible above the hilltop, the snow sparkling slightly`,
  },
  {
    file: "item_zima_sanki.webp",
    prompt: `${S}, a classic children's wooden sled with cheerful red metal runners, lying on a small patch of white snow, a few snowflakes in the air around it`,
  },
  // ── ВЕСНА ───────────────────────────────────────────────────
  {
    file: "item_vesna_cvety.webp",
    prompt: `${S}, a small bouquet of three bright tulips — two pink and one yellow — tied with a light blue ribbon, a couple of small green leaves and a few petals falling gently around the bouquet`,
  },
  {
    file: "item_vesna_botinki.webp",
    prompt: `${S}, a pair of bright yellow children's rubber rain boots (резиновые сапоги) standing in a small cheerful puddle with a few tiny raindrops hitting the water surface around them`,
  },
  {
    file: "item_vesna_solnce.webp",
    prompt: `${S}, a warm smiling sun with 8 rounded rays, soft yellow-gold color, a small fluffy white cloud peeking in from one side, gentle spring mood`,
  },
  {
    file: "item_vesna_ruchi.webp",
    prompt: `${S}, a small spring stream of sparkling blue water flowing in a gentle curve, patches of melting white snow on the green-brown banks, a couple of tiny green sprouts growing at the water's edge`,
  },
  // ── ЛЕТО ────────────────────────────────────────────────────
  {
    file: "item_leto_futbolka.webp",
    prompt: `${S}, a bright yellow short-sleeved children's t-shirt laid flat with sleeves spread out, a small yellow sun drawn on the chest as a print, clean and cheerful`,
  },
  {
    file: "item_leto_kepka.webp",
    prompt: `${S}, a bright blue children's baseball cap shown from a slight front-angle so both the dome and brim are visible, a few golden sun rays radiating out from behind it`,
  },
  {
    file: "item_leto_solnce.webp",
    prompt: `${S}, a blazing bright summer sun with many sharp pointed rays radiating outward, vivid yellow-orange, no face, a small patch of bright blue sky behind it, intense and warm feeling`,
  },
  {
    file: "item_leto_yagody.webp",
    prompt: `${S}, a small wicker basket filled with bright red strawberries and raspberries, a green strawberry leaf resting beside the basket, juicy and vibrant colors`,
  },
  {
    file: "item_leto_cvety.webp",
    prompt: `${S}, two large sunflowers with bright yellow petals and rich brown centers, green stems with a leaf or two, a small bee hovering near one flower, vivid summer colors`,
  },
  // ── ДОЖДЬ (общий) ───────────────────────────────────────────
  {
    file: "item_dozhd.webp",
    prompt: `${S}, a plump blue-grey rain cloud with 5 clear blue teardrop raindrops falling below it, one or two small puddle splashes at the bottom of the frame, simple and instantly recognizable`,
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
  return imgPart.inlineData.data;
}

async function generate(item) {
  console.log(`  ${item.file} ...`);
  const data = await callGemini(item.prompt);
  const buf = Buffer.from(data, "base64");
  const webp = await sharp(buf)
    .resize(512, 512, { fit: "cover", position: "center" })
    .webp({ quality: 87, effort: 5 })
    .toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, item.file), webp);
  console.log(`    ✓ ${Math.round(webp.length / 1024)} KB`);
}

async function main() {
  console.log(`=== Season Item Generator v2 (${ITEMS.length} items) ===\n`);
  for (const item of ITEMS) {
    try {
      await generate(item);
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e) {
      console.error(`    ✗ ${item.file}: ${e.message}`);
    }
  }
  console.log(`\nDone → ${OUT_DIR}`);
}

main();
