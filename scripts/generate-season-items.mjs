/**
 * Generates item images for word_formation_soup season overview cards.
 * Style: flat vector illustration, bold outlines, white background, single subject.
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

// Base style: flat illustration, bold outline, white bg, single centered object
// Must be clearly readable at ~48-64px chip size
const S =
  "flat vector illustration, bold thick black outline, " +
  "bright saturated colors, pure white background, " +
  "single subject centered and filling most of the frame, " +
  "simple iconic shape with no tiny details, " +
  "children's educational style, no text, no people, no shadows, " +
  "easily recognizable at small size, square 1:1 composition";

const ITEMS = [
  // ── AUTUMN ──────────────────────────────────────────────────
  {
    file: "item_osen_listya.webp",
    prompt: `${S}, three large autumn leaves: one maple leaf in bright orange, one in deep red, one in golden yellow, arranged in a loose fan, clearly distinct shapes`,
  },
  {
    file: "item_osen_griby.webp",
    prompt: `${S}, two or three porcini mushrooms (белые грибы): fat brown caps, thick pale stems, mushrooms grouped together, rich earthy tones, instantly recognizable silhouette`,
  },
  // ── WINTER ──────────────────────────────────────────────────
  {
    file: "item_zima_shapka.webp",
    prompt: `${S}, a cozy knitted winter beanie hat with a fluffy pompom on top, bright red color with white snowflake pattern, round compact shape`,
  },
  {
    file: "item_zima_sapogi.webp",
    prompt: `${S}, a pair of warm winter snow boots (felt valenki style), dark blue or grey, round toe, mid-calf height, shown from the front slightly angled`,
  },
  {
    file: "item_zima_varezhki.webp",
    prompt: `${S}, a pair of bright red knitted mittens with a simple white snowflake pattern, thumbs pointing outward, compact rounded shape`,
  },
  {
    file: "item_zima_gorka.webp",
    prompt: `${S}, a simple snow slide hill seen from the side: a smooth white snowy slope going from top-right down to bottom-left, a flat platform at the top, the shape of the hill is the main subject, blue sky stripe at top, pure white snow, bold simple shape`,
  },
  {
    file: "item_zima_sanki.webp",
    prompt: `${S}, a classic children's sled with wooden slats and bright red metal rails/runners, shown at a slight angle so both the seat and runners are visible, cheerful red color, simple bold shape`,
  },
  // ── SPRING ──────────────────────────────────────────────────
  {
    file: "item_vesna_cvety.webp",
    prompt: `${S}, a small bouquet of three bright tulips in yellow and pink, green stems bundled together, flowers open and clearly visible, bold petal shapes`,
  },
  {
    file: "item_vesna_botinki.webp",
    prompt: `${S}, a pair of children's spring ankle boots in bright yellow rubber (wellies/rain boots), round toe, ankle height, shown from the front slightly angled`,
  },
  {
    file: "item_vesna_solnce.webp",
    prompt: `${S}, a bright yellow sun with 8 distinct triangular rays evenly spaced around a round disc, pale blue circular background area behind it, simple cheerful sun icon, very clear bold shape`,
  },
  {
    file: "item_vesna_ruchi.webp",
    prompt: `${S}, a small spring stream of clear blue water flowing in an S-curve from top to bottom of the frame, small patches of white melting snow on the banks, bright blue water contrasting with white snow, simple and clear`,
  },
  // ── SUMMER ──────────────────────────────────────────────────
  {
    file: "item_leto_futbolka.webp",
    prompt: `${S}, a bright yellow children's t-shirt laid flat, short sleeves spread out, simple design with no text, clear T-shape silhouette`,
  },
  {
    file: "item_leto_kepka.webp",
    prompt: `${S}, a children's baseball cap in bright blue, shown at a three-quarter front angle so the brim and dome are both visible, simple bold shape, adjustable strap at the back`,
  },
  {
    file: "item_leto_solnce.webp",
    prompt: `${S}, a blazing bright sun with many sharp pointed rays radiating outward, vivid warm yellow-orange color, round disc in the center, bright blue sky patch behind, bold energetic shape, brighter and more intense than a spring sun`,
  },
  {
    file: "item_leto_yagody.webp",
    prompt: `${S}, a handful of bright red strawberries and raspberries piled together, shiny red color, clearly recognizable berry shapes with leaves and seeds visible, juicy and vibrant`,
  },
  {
    file: "item_leto_cvety.webp",
    prompt: `${S}, two or three large sunflowers with bright yellow petals and dark brown centers, green stems, shown from the front, bold iconic sunflower shape, vivid yellow`,
  },
  // ── SHARED (дождь) ─ replace old complex photo ──────────────
  {
    file: "item_dozhd.webp",
    prompt: `${S}, rain: a simple cloud in blue-grey color with 5–6 clear blue raindrops falling straight down below it, bold simple shapes, clearly a rain cloud icon, very readable at small size`,
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
  return { data: imgPart.inlineData.data };
}

async function generate(item) {
  console.log(`  ${item.file} ...`);
  const { data } = await callGemini(item.prompt);
  const buf = Buffer.from(data, "base64");
  const webp = await sharp(buf)
    .resize(512, 512, { fit: "cover", position: "center" })
    .webp({ quality: 85, effort: 5 })
    .toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, item.file), webp);
  console.log(`    ✓ ${Math.round(webp.length / 1024)} KB`);
}

async function main() {
  console.log(`=== Season Item Generator (${ITEMS.length} items) ===\n`);
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
