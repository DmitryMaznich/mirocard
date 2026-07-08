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
  "thick clean outlines, simple geometric shapes, no photorealism, " +
  "no gradients on background, no text, no watermarks, " +
  "NO animals, NO people, NO characters, NO snowman, NO birds, NO squirrels, " +
  "focus on landscape and environment only, " +
  "square 1:1 composition";

const SEASONS = [
  {
    name: "autumn",
    prompt:
      `${STYLE}, autumn forest landscape, ` +
      "tall maple trees with bright orange red yellow crowns filling the frame, " +
      "carpet of fallen colourful leaves covering the ground, " +
      "golden light streaming between trunks, blue sky visible through canopy, " +
      "a few orange pumpkins on the ground in the distance, " +
      "rich warm palette: deep orange #E8610A, burgundy #8B2500, gold #F0A500, " +
      "dark trunks #4A2800, patch of blue sky #5BB8F0, " +
      "NO animals, NO people, NO characters, lush and cosy autumn atmosphere",
  },
  {
    name: "winter",
    prompt:
      `${STYLE}, winter snowy landscape, ` +
      "snow-covered pine and fir trees in a quiet forest, " +
      "large fluffy snowflakes drifting down from a deep blue night sky, " +
      "white snow drifts with smooth rounded shapes, " +
      "a small cosy house with glowing yellow windows far in the background, " +
      "icicles hanging from branches, " +
      "saturated palette: deep navy #0A1A4A, bright white snow, " +
      "teal-blue fir trees #1A6A5A, warm yellow window glow #FFD000, " +
      "NO snowman, NO animals, NO people, peaceful magical winter night",
  },
  {
    name: "spring",
    prompt:
      `${STYLE}, spring garden and orchard landscape, ` +
      "cherry blossom trees in full bloom with vivid hot-pink flowers, " +
      "pink petals falling through the air, " +
      "bright green meadow with patches of red and yellow tulips, " +
      "fluffy white clouds on a clear turquoise sky, " +
      "a winding stone path leading into the blossoming orchard, " +
      "saturated spring palette: hot pink #FF3D8A, vivid green #2EC820, " +
      "turquoise sky #00D4CC, red tulips #F01010, yellow tulips #FFE000, " +
      "NO animals, NO people, NO birds, joyful blooming spring landscape",
  },
  {
    name: "summer",
    prompt:
      `${STYLE}, bright summer meadow landscape, ` +
      "vast rolling green hills covered with wild flowers and sunflowers, " +
      "blazing yellow sun high in a vivid blue sky, " +
      "fluffy white cumulus clouds, " +
      "a small sparkling blue lake or river in the middle distance, " +
      "tall green grass and dandelions in the foreground, " +
      "saturated summer palette: sky blue #1AB0FF, vivid green #20C010, " +
      "sunflower yellow #FFD800, white clouds, " +
      "NO people, NO animals, NO characters, open joyful summer landscape",
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
