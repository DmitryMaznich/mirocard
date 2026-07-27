/**
 * Generates 4 season background images for word_formation_soup deck.
 * Usage: node scripts/generate-season-images.mjs
 * Output: scripts/season_output/season_*.webp
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "season_output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = getGeminiApiKey();

// Same park scene in all 4 seasons:
// A large deciduous tree (oak) centered, a wooden bench beside it,
// a stone path curving through green grass, low garden fence in background.
// Only seasonal elements change — tree foliage, ground cover, sky, light.

const BASE =
  "children's book flat illustration, bold highly saturated colors, " +
  "thick clean outlines, simple shapes, no photorealism, no text, no watermarks, " +
  "NO animals, NO people, NO characters, " +
  "SAME SCENE every image: a large oak tree centered, a wooden bench to its right, " +
  "a curved stone path through a grassy park, low garden fence and shrubs in background, " +
  "square 1:1 composition, wide landscape view";

const SEASONS = [
  {
    name: "spring",
    prompt:
      `${BASE}, SPRING: ` +
      "tree has fresh light-green young leaves just opening on branches, " +
      "small pink and white blossoms on nearby shrubs, " +
      "bright green grass with scattered yellow dandelions and small white flowers, " +
      "bench is clean dry wood, " +
      "pale blue sky with a few fluffy white clouds, soft warm sunlight from the right, " +
      "palette: fresh green #4CD62A, pale blue sky #87DCFF, white blossom, yellow dandelion #FFE040, " +
      "light brown bench #C8854A, grey stone path",
  },
  {
    name: "summer",
    prompt:
      `${BASE}, SUMMER: ` +
      "tree has a full dense dark-green canopy casting deep shadow on the ground, " +
      "thick lush green grass, no fallen leaves, " +
      "bench sits in dappled shade under the tree, " +
      "blazing yellow-white sun high in a deep blue sky, one or two white clouds, " +
      "bright saturated summer palette: deep green #18A800, vivid sky blue #1A9FFF, " +
      "golden sun #FFD700, warm light brown bench #C8854A, grey stone path, " +
      "long shadow of tree falling across path",
  },
  {
    name: "autumn",
    prompt:
      `${BASE}, AUTUMN: ` +
      "tree has a brilliant crown of orange, red and yellow leaves, many leaves falling, " +
      "ground covered with a carpet of fallen orange and red leaves, " +
      "bench has a few leaves resting on it, " +
      "warm golden-orange afternoon light, pale blue-grey sky with light clouds, " +
      "rich warm palette: deep orange #E86010, crimson #C02010, gold #F0A500, " +
      "brown trunk #5A3010, grey path visible through leaf carpet, pale sky #B8D8F0",
  },
  {
    name: "winter",
    prompt:
      `${BASE}, WINTER: ` +
      "tree is completely bare, dark skeletal branches against the sky, " +
      "white snow covering the ground, bench, and branch tips, " +
      "soft snowflakes drifting down, " +
      "grey-white overcast sky, cold bluish light, " +
      "palette: white snow, dark bare branches #3A2810, " +
      "light blue-grey sky #C8DCF0, blue-tinted snow shadows #A8C4E0, " +
      "wooden bench barely visible under snow, grey stone path under thin snow layer",
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
