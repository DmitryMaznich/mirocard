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
  kotlety:         "three Russian-style meat kotlety on a white plate, golden-brown flour-breaded crispy crust, fried in butter and oil, rich caramelized exterior with slight flour dusting, one cut open showing juicy inside, garnished with fresh dill, home-cooked comfort food",
  mashed_potatoes: "creamy mashed potatoes in a white bowl, smooth texture, topped with a pat of melting butter and a sprinkle of herbs",
  oatmeal:         "oatmeal porridge in a white bowl with a spoon of butter melting on top and a sprinkle of sugar, warm and inviting",
  omelet:          "folded golden omelet with sliced sausage on a white plate, slightly crispy edges, garnished with fresh herbs",
  pasta:           "pasta with butter and freshly grated cheese in a white bowl, cheese melting, simple and delicious",
  pasta_meat:      "spaghetti bolognese with rich meat sauce, topped with grated parmesan and fresh basil leaf, white plate",
  salad:           "fresh vegetable salad with tomatoes, cucumber, avocado, radishes and bell pepper in a white bowl, drizzled with balsamic dressing",
  soup:            "chicken noodle soup in a white bowl, clear golden broth with chicken pieces, thin vermicelli noodles, carrots, onion, and half a boiled egg, garnished with fresh dill",
  tea:             "cold iced tea in a tall glass with lemon slices and fresh mint, ice cubes, condensation on the glass, refreshing",
  fried_potatoes:  "golden crispy fried potatoes with caramelized onions on a white plate, brown crust, sprinkled with fresh dill, rustic and appetizing",
  chicken_wings:   "golden-brown baked chicken wings on a baking tray lined with parchment paper, crispy skin, seasoned with garlic, fresh rosemary and thyme sprigs, appetizing caramelized crust",
  scramble_sausage: "soft creamy scrambled eggs with golden-brown fried sausage rounds on a white plate, fluffy yellow eggs, sausage slightly caramelized, simple home-style breakfast",
  risotto_shrimp:   "creamy shrimp risotto with arborio rice, plump pink shrimp, grated parmesan on top, flecks of fresh thyme, golden buttery sauce, served in a white shallow bowl",
  ravioli:          "fresh pasta ravioli in golden sage butter sauce, sprinkled with grated parmesan, crispy sage leaves as garnish, white plate, Italian-style",
  breakfast_champion: "creamy white cottage cheese and yogurt dessert bowl, smooth silky texture, topped with fresh strawberries and a drizzle of honey, served in a white ceramic bowl, cozy breakfast table",
  kislo_zelje:      "Slovenian braised sauerkraut with pieces of smoked meat, golden-brown color, hearty rustic dish, served on a white plate, traditional Slavic comfort food",
  mushroom_soup:    "mushroom soup with champignons in a white ceramic bowl, rich golden-brown broth, sliced mushrooms visible, fresh green herbs sprinkled on top, dollop of white sour cream, rustic wooden table, steam rising",
  chicken_potato_oven: "rustic baked chicken pieces with golden crispy skin and potato wedges skin-on, fresh rosemary and thyme sprigs, roasted garlic, drizzled with olive oil, on parchment-lined baking sheet, golden-brown caramelized, overhead shot",
  cicchetti: "Venetian cicchetti assortment on a rustic wooden board, four toasted baguette slices with colorful toppings: prosciutto, creamy white spread with herbs, tomato and mozzarella with basil, dark olive tapenade, soft warm light, Italian appetizer, overhead shot",
  stuffed_eggs: "deviled stuffed eggs on a white plate, halved hard-boiled eggs filled with creamy yellow yolk and cream cheese mixture, garnished with fresh green dill, six halves arranged neatly, top-down overhead shot, appetizing",
  coffee_chemex: "chemex pour-over coffee brewer filled with dark amber coffee, distinctive hourglass glass shape with wooden collar, steam rising, on a light wooden table, morning light, minimalist",

  // Chemex step-by-step illustrations
  chemex_s06: "pouring clear filtered water from a glass pitcher or glass carafe into a black electric gooseneck coffee kettle on a kitchen counter, clean white countertop, morning light, no tap or faucet visible",
  chemex_s07: "manual hand coffee grinder with screwed-on catch cup placed on a digital kitchen scale showing 20 grams, wooden kitchen surface, morning light, close-up, no loose beans scattered around",
  chemex_s08: "top-down view into a chemex glass brewer with a white paper filter cone inserted, clearly showing three paper layers on one side and one layer on the other side, the thick multi-layer side faces the spout, natural light, close-up overhead shot",
  chemex_s09: "placing a chemex paper filter cone into the top opening of a chemex glass brewer, filter fitting snugly, top-down close-up, soft light",
  chemex_s10: "pouring hot water from a thin gooseneck kettle spout over a white paper filter in chemex to rinse it, steam rising, chemex on wooden counter",
  chemex_s11: "tilting chemex glass brewer sideways to pour out rinse water, hand holding paper filter gently in place, water draining out",
  chemex_s12: "pouring freshly ground dark coffee from a small cup into a white cone filter inside chemex brewer, grounds falling in, close-up",
  chemex_s13: "gently shaking chemex coffee brewer with both hands to level coffee grounds flat inside the cone filter, close-up of even coffee bed",
  chemex_s14: "chemex pour-over glass brewer placed on a digital kitchen scale showing zero grams after taring, top-down view, clean counter",
  chemex_s15: "gooseneck electric kettle with steam rising, phone timer showing 1 minute on wooden counter, waiting for water to cool for brewing",
  chemex_s16: "thin precise stream of water pouring from black matte electric gooseneck kettle spout into center of coffee grounds in chemex glass brewer with wooden collar, black digital kitchen scale below showing 40 grams, bloom just beginning, wooden table, morning light",
  chemex_s17: "close-up overhead macro of coffee bloom in chemex paper filter, coffee grounds bubbling and expanding releasing CO2, dark brown dome rising with foam bubbles, chemex wooden collar visible at edges, soft natural light",
  chemex_s18: "pouring water in slow spiral from black matte electric gooseneck kettle over wet coffee grounds in chemex glass brewer with wooden collar, black digital kitchen scale showing 130 grams, amber coffee dripping into glass flask below, wooden table, morning light",
  chemex_s20: "pouring water in slow spiral from black matte electric gooseneck kettle over chemex coffee grounds, chemex glass brewer with wooden collar on black digital kitchen scale displaying 220 grams, amber coffee dripping into flask below, wooden table, morning light",
  chemex_s22: "final water pour in slow spiral from black matte electric gooseneck kettle over chemex coffee grounds, chemex glass brewer with wooden collar on black digital kitchen scale showing 320 grams, golden amber brew dripping into flask below, wooden table, morning light",
  chemex_s23: "chemex brewer with nearly empty filter, last drops of amber coffee dripping into glass flask below, 2-minute timer on phone, quiet morning",
  chemex_s24: "chemex with completely empty dry paper filter above, beautiful clear dark amber coffee fully collected in glass flask below, brew complete",
  chemex_s25: "removing used chemex paper filter with spent wet coffee grounds from brewer with both hands, lifting filter carefully, grounds inside",
  chemex_s26: "pouring medium amber-brown pour-over coffee from a chemex glass brewer with wooden collar but WITHOUT any paper filter inside, clean empty top opening visible, rich honey-brown coffee color, into a white ceramic mug, steam rising, morning light, wooden table",
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
