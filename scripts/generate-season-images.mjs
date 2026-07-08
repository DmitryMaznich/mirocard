/**
 * Generates 4 season background images for word_formation_soup deck.
 * Usage: node scripts/generate-season-images.mjs
 * Output: scripts/season_output/season_*.webp
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "season_output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";

const STYLE =
  "vibrant children's book flat illustration, bold highly saturated colors, " +
  "thick clean outlines, simple charming shapes, playful kawaii style, " +
  "no photorealism, no gradients on background, no text, no watermarks, " +
  "square 1:1 composition, centered composition";

const SEASONS = [
  {
    name: "autumn",
    prompt:
      `${STYLE}, warm rich autumn forest scene, ` +
      "deep orange and burgundy maple trees with falling leaves, " +
      "cute cartoon squirrel holding an acorn, orange pumpkins on the ground, " +
      "golden sunlight filtering through colorful canopy, bright blue sky, " +
      "saturated warm palette: deep orange #E8610A, burgundy #8B2500, gold #F0A500, " +
      "rich green #4A7A1A, vibrant and cozy atmosphere",
  },
  {
    name: "winter",
    prompt:
      `${STYLE}, magical winter snow scene, ` +
      "big fluffy snowflakes falling from a deep blue starry sky, " +
      "round cute snowman with orange carrot nose and red scarf, " +
      "snow-covered pine trees sparkling with gold stars, " +
      "warm glowing windows of a little house in the background, " +
      "saturated blue and white palette with warm gold and red accents: " +
      "deep sky blue #1A4A8A, bright white snow, warm gold #FFD700, " +
      "festive red #D42B2B, magical and cozy atmosphere",
  },
  {
    name: "spring",
    prompt:
      `${STYLE}, cheerful spring garden scene, ` +
      "bright pink cherry blossom trees in full bloom with petals flying, " +
      "a pair of cute cartoon blue birds on a branch, " +
      "colorful tulips and daisies in vivid red yellow purple on bright green grass, " +
      "fluffy white clouds on a vibrant turquoise sky, " +
      "saturated spring palette: hot pink #FF5BA8, vivid green #3DB827, " +
      "bright turquoise sky #1ED8C8, red tulips #F02020, " +
      "joyful and energetic atmosphere",
  },
  {
    name: "summer",
    prompt:
      `${STYLE}, bright sunny summer meadow scene, ` +
      "big smiling cartoon sun with rays in vivid golden yellow, " +
      "tall lush green sunflowers with happy faces, " +
      "rolling green hills with colorful wildflowers, butterflies, " +
      "a small pond reflecting the blue sky, " +
      "saturated summer palette: vivid yellow #FFD600, " +
      "deep leafy green #2E9E0A, sky blue #1E9FFF, " +
      "orange sunflower center #E06400, " +
      "warm energetic summer feeling",
  },
];

async function callGemini(prompt) {
  const model = "gemini-3.1-flash-image";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }

  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart) {
    console.error("Response parts:", JSON.stringify(parts.map(p => Object.keys(p)), null, 2));
    throw new Error("No image in Gemini response");
  }

  return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
}

async function generate(season) {
  console.log(`\nGenerating: ${season.name}...`);
  const { data } = await callGemini(season.prompt);

  const inputBuf = Buffer.from(data, "base64");

  const webpBuf = await sharp(inputBuf)
    .resize(900, 900, { fit: "cover", position: "center" })
    .webp({ quality: 88, effort: 5 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `season_${season.name}.webp`);
  fs.writeFileSync(outPath, webpBuf);
  console.log(`  Saved ${outPath} (${Math.round(webpBuf.length / 1024)} KB)`);
}

async function main() {
  console.log("=== Season Image Generator ===");
  for (const season of SEASONS) {
    try {
      await generate(season);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`  ERROR ${season.name}: ${err.message}`);
    }
  }
  console.log("\nDone! Check scripts/season_output/");
}

main();
