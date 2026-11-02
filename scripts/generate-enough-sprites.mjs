/**
 * generate-enough-sprites.mjs
 * Pictures for «Сравнение» step 9 «Всем хватает?» (compare_enough): every
 * character and object as its own sprite on a transparent background, so the
 * screen builds each scene in code — the count on screen is always exactly
 * the task's count, unlike whole generated scenes (10 of 31 «Сравни в жизни»
 * pictures came out with a wrong number of items).
 *
 * Requires GEMINI_API_KEY (.env / .env.local, or the environment).
 *
 * Usage:
 *   node scripts/generate-enough-sprites.mjs           # generate all
 *   node scripts/generate-enough-sprites.mjs --skip    # keep sprites already made
 *   node scripts/generate-enough-sprites.mjs kid_1     # one sprite by id
 *
 * Writes the raw white-background picture to tools/comparison/media-src/enough/
 * as JPEG (kept in git so the cut-out can be redone without a new generation)
 * and the cut-out sprite to tools/comparison/media/enough/ as WebP with alpha
 * (~15 KB, packed into the topic ZIP; PNG was ~90 KB each).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";
import { removeWhiteBg } from "./lib/remove-white-bg.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "tools", "comparison", "media-src", "enough");
const OUT_DIR = path.join(ROOT, "tools", "comparison", "media", "enough");
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-image-preview";
const SKIP = process.argv.includes("--skip");
const ONLY = process.argv.slice(2).find((a) => !a.startsWith("--"));

// Same family look as the «Сравни в жизни» scenes, but one object alone.
const STYLE = `Flat vector children's-book illustration, thick clean dark outlines, warm saturated
storybook colours, soft flat shading (no photorealistic gradients, no 3D render look), simple
friendly design like a modern European picture book. ONE single object only, whole object visible,
centred, filling about 80% of a square frame, on a pure flat white background (#FFFFFF) with
nothing else in the picture: no floor, no ground line, no cast shadow, no other objects, no text,
no letters, no watermark.`;

const KID_POSE = `standing straight, full body from head to shoes, facing the viewer, arms relaxed
at the sides, bare head (no hat, no hood, no hair accessories that stick up), friendly smile`;

const SPRITES = [
  // ── characters ("who") ──
  { id: "kid_1", prompt: `A little boy about 5 years old with short brown hair, blue jumper, dark trousers, ${KID_POSE}.` },
  { id: "kid_2", prompt: `A little girl about 5 years old with two brown pigtails, pink dress, white tights, ${KID_POSE}.` },
  { id: "kid_3", prompt: `A little boy about 5 years old with curly ginger hair, green t-shirt, blue jeans, ${KID_POSE}.` },
  { id: "kid_4", prompt: `A little girl about 5 years old with a short black bob haircut, yellow dress, ${KID_POSE}.` },
  { id: "kid_5", prompt: `A little boy about 5 years old with short blond hair, orange striped t-shirt, grey shorts, ${KID_POSE}.` },
  { id: "kid_6", prompt: `A little girl about 5 years old with long dark curly hair and brown skin, purple dress, ${KID_POSE}.` },
  ...["red", "blue", "yellow", "green", "pink", "orange"].map((c, i) => ({
    id: `cup_${i + 1}`,
    prompt: `A single ${c} ceramic tea cup with a handle on the right, seen from the side at eye level, empty, no saucer under it, no spoon.`,
  })),
  ...["light brown puppy with floppy ears", "white puppy with black spots", "dark brown dachshund puppy (exactly ONE dog with ONE head, no second dog or extra head anywhere)", "grey fluffy puppy", "golden retriever puppy", "black puppy with a white chest"].map((d, i) => ({
    id: `dog_${i + 1}`,
    prompt: `A cute ${d}, sitting, whole body, facing the viewer, friendly.`,
  })),
  ...["white", "grey", "light brown", "white with grey patches", "dark brown", "cream-coloured"].map((r, i) => ({
    id: `rabbit_${i + 1}`,
    prompt: `A cute ${r} bunny rabbit, sitting upright, whole body, long ears up, facing the viewer, friendly.`,
  })),
  ...["red", "blue", "yellow", "green", "orange", "purple"].map((c, i) => ({
    id: `car_${i + 1}`,
    prompt: `A small ${c} toy car seen exactly from the side, facing right, all wheels on one level, cheerful rounded shape.`,
  })),
  // ── objects ("things"): one look each, all copies alike ──
  { id: "chair", prompt: "A simple wooden children's chair with a back, seen from the front at a slight angle, all four legs visible." },
  { id: "saucer", prompt: "A single white ceramic saucer seen from the side at a slight angle from above, a thin oval shape, empty." },
  { id: "bone", prompt: "A single cartoon dog bone (white-cream colour), lying horizontally, classic bone shape with two round knobs at each end." },
  { id: "carrot", prompt: "A single orange carrot with green leaves on top, lying diagonally." },
  { id: "hat", prompt: "A single warm knitted winter hat (beanie) for a child, red with a white pompom on top, seen from the front." },
  { id: "garage", prompt: "A small toy CAR garage for one toy car (clearly a garage for cars, NOT a dog house or kennel: no pointed roof, no round opening): a low wide box-shaped building with a flat grey roof, light grey walls and a wide rectangular roll-up door fully open, the inside empty, seen from the front." },
];

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": getGeminiApiKey() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.map((p) => p?.inlineData ?? p?.inline_data).find((d) => d?.data);
  if (!inline) throw new Error("No image in response");
  return Buffer.from(inline.data, "base64");
}

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`Model: ${MODEL}`);

const targets = ONLY ? SPRITES.filter((s) => s.id === ONLY) : SPRITES;
if (!targets.length) { console.error(`No sprite "${ONLY}"`); process.exit(1); }

let failed = 0;
for (const sprite of targets) {
  const rawPath = path.join(RAW_DIR, `${sprite.id}.jpg`);
  const outPath = path.join(OUT_DIR, `${sprite.id}.webp`);
  try {
    if (!(SKIP && fs.existsSync(rawPath))) {
      console.log(`▶ ${sprite.id}`);
      const raw = await callGemini(`${STYLE}\n\n${sprite.prompt}`);
      fs.writeFileSync(rawPath, await sharp(raw).resize(512, 512, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer());
    } else {
      console.log(`↩ ${sprite.id} (raw kept)`);
    }
    const cut = await removeWhiteBg(fs.readFileSync(rawPath));
    // 320px on the long side is plenty for a ~70px slot on a tablet (2× density).
    fs.writeFileSync(outPath, await sharp(cut).resize(320, 320, { fit: "inside" }).webp({ quality: 82, alphaQuality: 90 }).toBuffer());
    console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${sprite.id}: ${err.message}`);
  }
}
console.log(failed ? `\nDone with ${failed} failure(s).` : "\nDone.");
process.exit(failed ? 1 : 0);
