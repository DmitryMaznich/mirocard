/**
 * generate-recipe-photos.mjs
 * Generates a food photo for each recipe via Gemini API,
 * converts to WebP 512×512, saves to content/media/,
 * and patches the recipe .txt with # photo: and [name.webp] lines.
 *
 * Usage:
 *   node scripts/generate-recipe-photos.mjs [recipe_id ...]
 *   node scripts/generate-recipe-photos.mjs             # all missing
 *   node scripts/generate-recipe-photos.mjs soup chicken
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MEDIA_DIR = path.join(ROOT, "content/media");
const RECIPES_DIR = path.join(ROOT, "content/recipes");

// ── Load env ──────────────────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const sep = l.indexOf("=");
    if (sep <= 0) continue;
    const key = l.slice(0, sep).trim();
    let val = l.slice(sep + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Try Mirocard2 .env first, then Mirocard .env.local (where the key lives)
loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(ROOT, ".env.local"));
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env");
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env.local");

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";

if (!API_KEY) {
  console.error("GEMINI_API_KEY not found.");
  process.exit(1);
}

// ── Recipe photo prompts ──────────────────────────────────────────────────────
// Format: realistic food photo style, dish on plate, appetizing, soft natural light
const STYLE = "professional food photography, soft natural light, appetizing presentation, close-up shot, shallow depth of field, clean background";

const RECIPES = {
  buckwheat:       "sweet buckwheat porridge in a white bowl, topped with a pat of melting butter, steaming, cozy breakfast",
  chicken:         "chicken pieces in rich creamy sauce with carrots and herbs, golden color, in a white ceramic bowl, garnished with fresh parsley",
  cocoa:           "hot chocolate cocoa in a white ceramic mug, steaming, drizzle of honey beside it, cozy warm atmosphere",
  fried_eggs:      "sunny-side-up fried eggs on a white plate, perfectly set whites, bright golden yolks, light seasoning, simple and appetizing",
  kompot:          "berry compote in a glass, deep red color with whole berries visible, slight steam, on a wooden table",
  kotlety:         "three golden-brown pan-fried meat cutlets on a white plate, crispy crust, garnished with fresh dill",
  mashed_potatoes: "creamy mashed potatoes in a white bowl, smooth texture, topped with a pat of melting butter and a sprinkle of herbs",
  oatmeal:         "oatmeal porridge in a white bowl with a spoon of butter melting on top and a sprinkle of sugar, warm and inviting",
  omelet:          "folded golden omelet with sliced sausage on a white plate, slightly crispy edges, garnished with fresh herbs",
  pasta:           "pasta with butter and freshly grated cheese in a white bowl, cheese melting, simple and delicious",
  pasta_meat:      "spaghetti bolognese with rich meat sauce, topped with grated parmesan and fresh basil leaf, white plate",
  salad:           "fresh vegetable salad with tomatoes, cucumber, avocado, radishes and bell pepper in a white bowl, drizzled with balsamic dressing",
  soup:            "chicken noodle soup in a white bowl, clear golden broth with chicken pieces, thin vermicelli noodles, carrots, onion, and half a boiled egg, garnished with fresh dill",
  tea:             "cold iced tea in a tall glass with lemon slices and fresh mint, ice cubes, condensation on the glass, refreshing",
  fried_potatoes:  "golden crispy fried potatoes with caramelized onions on a white plate, brown crust, sprinkled with fresh dill, rustic and appetizing",
};

// ── Gemini API ────────────────────────────────────────────────────────────────
async function generateImage(recipeId) {
  const subject = RECIPES[recipeId];
  const prompt  = `${STYLE}, ${subject}`;
  console.log(`  prompt: ${prompt.slice(0, 90)}...`);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
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

  const parts     = body.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p?.inlineData || p?.inline_data);
  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data;
  if (!inlineData?.data) throw new Error("No image returned");

  return Buffer.from(inlineData.data, "base64");
}

// ── Patch .txt file ───────────────────────────────────────────────────────────
function patchRecipeTxt(recipeId, filename) {
  const txtPath = path.join(RECIPES_DIR, `${recipeId}.txt`);
  if (!fs.existsSync(txtPath)) {
    console.log(`  ⚠ ${recipeId}.txt not found, skipping patch`);
    return;
  }

  let content = fs.readFileSync(txtPath, "utf8");

  // Add/update # photo: line at the very top
  const photoMeta = `# photo: ${filename}`;
  if (content.startsWith("# photo:")) {
    content = content.replace(/^# photo:.*(\r?\n)/, photoMeta + "\n");
  } else {
    content = photoMeta + "\n" + content;
  }

  // Add [filename] right after the title line (first non-comment, non-empty line)
  const imgTag = `[${filename}]`;
  if (!content.includes(imgTag)) {
    const lines = content.split(/\r?\n/);
    // Find the title line (first line not starting with #)
    let titleIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith("#") && lines[i].trim()) {
        titleIdx = i;
        break;
      }
    }
    if (titleIdx >= 0) {
      lines.splice(titleIdx + 1, 0, imgTag);
    }
    content = lines.join("\n");
  }

  fs.writeFileSync(txtPath, content, "utf8");
  console.log(`  ✓ patched ${recipeId}.txt`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const targets  = args.length > 0
  ? args.filter((a) => RECIPES[a])
  : Object.keys(RECIPES).filter((id) => {
      // skip if photo already exists
      return !fs.existsSync(path.join(MEDIA_DIR, `${id}.webp`));
    });

if (targets.length === 0) {
  console.log("All recipe photos already exist. Pass recipe IDs to regenerate specific ones.");
  process.exit(0);
}

console.log(`Generating photos for: ${targets.join(", ")}`);
console.log(`Model: ${MODEL}\n`);

for (const id of targets) {
  console.log(`▶ ${id}`);
  try {
    const rawBuffer = await generateImage(id);

    const webpBuffer = await sharp(rawBuffer)
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();

    const filename  = `${id}.webp`;
    const outPath   = path.join(MEDIA_DIR, filename);
    fs.writeFileSync(outPath, webpBuffer);
    const kb = (webpBuffer.length / 1024).toFixed(0);
    console.log(`  ✓ saved ${filename} (${kb} KB)`);

    patchRecipeTxt(id, filename);
  } catch (err) {
    console.error(`  ✗ ${id}: ${err.message}`);
  }
  console.log();
}

console.log("Done.");
