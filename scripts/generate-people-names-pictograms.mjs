// Draft pictogram icons for people_names Phase 4 (deferred generalization
// step: does the category word transfer from a photorealistic photo to an
// abstract/schematic symbol, not just to a new real person). Generates 4
// candidate PNGs for the user to review/approve before any topic.json/engine
// wiring happens - same "generate, then review" flow as
// generate-people-names-audio.mjs, just for images instead of speech.
//
// Usage: node scripts/generate-people-names-pictograms.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const OUT_DIR = join(ROOT, "scripts/_pictogram_drafts");
const API_KEY = getGeminiApiKey();
const MODEL   = "gemini-3.1-flash-image";

// Exactly the restroom-door-sign convention (ISO 7001-style public
// information symbol), not an illustrated/cartoon character: one smooth
// solid-color silhouette shape, no face, no hair, no clothing texture, no
// shading. The only differentiators are the geometric silhouette (separate
// leg shapes = trousers vs. a single triangular skirt shape = dress) and
// overall proportions (short/large-head-ratio = child vs. tall/elongated =
// adult) — the same two visual variables real restroom and pedestrian-
// crossing signs use.
const STYLE =
  "minimalist pictogram symbol in the exact style of a public restroom door " +
  "sign (ISO 7001 style): one smooth solid single-color silhouette shape on " +
  "a plain white background, flat solid fill with a clean simple outline, " +
  "absolutely no face, no eyes, no mouth, no hair strands, no clothing " +
  "texture or folds, no shading, no gradient, no photographic or painterly " +
  "detail of any kind — just a simple geometric human silhouette icon like " +
  "a traffic or signage symbol. The full figure (head to feet) must be " +
  "entirely visible within the frame, centered, with generous white margin " +
  "around it, symmetric, no cropping, no missing limbs. No text or letters " +
  "anywhere. No border, no rounded rectangle frame, no drop shadow. Square " +
  "1:1 composition, single dark navy-blue color (#1f4f8a) silhouette on " +
  "white.";

const TARGETS = [
  {
    id: "pictogram_boy",
    label: "мальчик",
    prompt: `${STYLE} A child-sized figure (short, large head-to-body ` +
      `ratio, like a pedestrian-crossing sign child) with two separate ` +
      `straight leg shapes, exactly like the male restroom sign silhouette ` +
      `but proportioned as a child.`,
  },
  {
    id: "pictogram_girl",
    label: "девочка",
    prompt: `${STYLE} A child-sized figure (short, large head-to-body ` +
      `ratio, like a pedestrian-crossing sign child) whose lower body is a ` +
      `single solid triangular skirt/dress shape covering both legs, ` +
      `exactly like the female restroom sign silhouette but proportioned ` +
      `as a child.`,
  },
  {
    id: "pictogram_man",
    label: "мужчина",
    prompt: `${STYLE} A tall adult-proportioned figure with two separate ` +
      `straight leg shapes — the standard male restroom-door-sign ` +
      `silhouette, clearly taller and more elongated than a child figure.`,
  },
  {
    id: "pictogram_woman",
    label: "женщина",
    prompt: `${STYLE} A tall adult-proportioned figure whose lower body is ` +
      `a single solid triangular skirt/dress shape covering both legs — ` +
      `the standard female restroom-door-sign silhouette, clearly taller ` +
      `and more elongated than a child figure.`,
  },
];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  process.stdout.write(`  gen   ${target.id}  (${target.label})... `);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: target.prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );
  const body = await res.json();
  if (!res.ok) {
    console.log(`FAILED: ${JSON.stringify(body?.error).slice(0, 300)}`);
    continue;
  }
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart) {
    console.log(`NO IMAGE: ${JSON.stringify(parts).slice(0, 300)}`);
    continue;
  }
  const buf = Buffer.from(imgPart.inlineData.data, "base64");
  const rawPath = join(OUT_DIR, `${target.id}.raw.png`);
  writeFileSync(rawPath, buf);
  console.log(`${buf.length} bytes -> ${rawPath}`);
}

// Two independent model generations never land on a reliable relative scale
// on their own (confirmed: the first pass's child/adult height difference
// was only ~10%, not something a viewer would read as "child vs adult" at
// icon size) — so the child/adult distinction here is enforced deterministically
// in code, not left to the model: every silhouette is trimmed to its own
// content bounding box, resized to a *fixed* height per age group, and
// composited onto a shared canvas with every figure's feet on the same
// baseline. Only the deliberately-set height differs between groups.
const CANVAS = 1024;
const BASELINE_Y = 960; // where every figure's feet sit
const HEIGHTS = { pictogram_boy: 560, pictogram_girl: 560, pictogram_man: 780, pictogram_woman: 780 };

for (const target of TARGETS) {
  const rawPath = join(OUT_DIR, `${target.id}.raw.png`);
  if (!existsSync(rawPath)) continue;
  const trimmed = await sharp(rawPath).trim({ background: "#ffffff", threshold: 20 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const targetHeight = HEIGHTS[target.id];
  const targetWidth = Math.round((meta.width / meta.height) * targetHeight);
  const resized = await sharp(trimmed).resize(targetWidth, targetHeight).toBuffer();
  const composed = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: "#ffffff" },
  })
    .composite([{
      input: resized,
      left: Math.round((CANVAS - targetWidth) / 2),
      top: BASELINE_Y - targetHeight,
    }])
    .png()
    .toBuffer();
  const outPath = join(OUT_DIR, `${target.id}.png`);
  writeFileSync(outPath, composed);
  console.log(`  norm  ${target.id}  height=${targetHeight}px -> ${outPath}`);
}
