// Generates the 4 "held-out" probe photos people_names has been missing
// since Phase 1 added the generalisation_probe mechanism (mode 10): one new
// real-person photo per concept (boy/girl/man/woman), tagged probeOnly so
// engine.js excludes it from every teaching mode and reserves it for that
// mode alone — a photo the child has genuinely never drilled on.
//
// Methodology review (2026-09) also flagged that the existing 8 photos are
// a thin, low-diversity generalization set: all light-skinned, average
// build, identical grey studio backdrop. Rather than just adding 4 more
// photos in the same mold, these 4 are deliberately varied on the axes the
// review named — skin tone, body build, backdrop tone, and (for the two
// adult concepts) age-appearance range — so the probe mode tests real
// transfer, not just "one more photo that looks like all the others."
//
// Usage: node scripts/generate-people-names-probe-photos.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/decks/_assets/people_names");
const API_KEY = getGeminiApiKey();
const MODEL   = "gemini-3.1-flash-image";

const STYLE =
  "professional studio fashion-catalog photograph, photorealistic, a single " +
  "person standing facing the camera directly, relaxed natural pose (hands " +
  "in pockets or resting at sides), soft even studio lighting, waist-up-to-" +
  "full-body framing with some headroom, gentle neutral or softly smiling " +
  "expression, plain seamless studio backdrop, sharp focus, high detail, " +
  "no text, no logos, no watermark, square 1:1 composition";

const TARGETS = [
  {
    id: "boy_probe",
    label: "мальчик (проверка переноса)",
    conceptId: "boy",
    semantic: { age: "child", category: "boy" },
    tags: ["children", "people", "probe"],
    prompt: `${STYLE}. A boy of about 8 years old, South Asian, brown skin, ` +
      `sturdy build, short black hair, wearing a plain grey hoodie and ` +
      `joggers, white sneakers. Warm cream/beige studio backdrop (not grey).`,
  },
  {
    id: "girl_probe",
    label: "девочка (проверка переноса)",
    conceptId: "girl",
    semantic: { age: "child", category: "girl" },
    tags: ["children", "people", "probe"],
    prompt: `${STYLE}. A girl of about 9 years old, East Asian, wearing ` +
      `round glasses, black hair in a single braid, a plain yellow ` +
      `sweater and denim trousers, white sneakers. Soft blue-grey studio ` +
      `backdrop (not grey).`,
  },
  {
    id: "man_probe",
    label: "мужчина (проверка переноса)",
    conceptId: "man",
    semantic: { age: "adult", category: "man" },
    tags: ["adults", "people", "probe"],
    prompt: `${STYLE}. A man of about 45 years old, Black, broad and ` +
      `heavyset build, short black hair, wearing a plain burgundy sweater ` +
      `and dark trousers. Warm terracotta studio backdrop (not grey).`,
  },
  {
    id: "woman_probe",
    label: "женщина (проверка переноса)",
    conceptId: "woman",
    semantic: { age: "adult", category: "woman" },
    tags: ["adults", "people", "probe"],
    prompt: `${STYLE}. A woman of about 62 years old, South Asian, full ` +
      `figure, short grey/silver hair, wearing a plain teal cardigan and ` +
      `dark trousers. Soft sage-green studio backdrop (not grey).`,
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
  const outPath = join(OUT_DIR, `${target.id}.png`);
  writeFileSync(outPath, buf);
  console.log(`${buf.length} bytes -> ${outPath}`);
}

console.log("\nDone. Review each photo, then wire the 4 new cards into tools/people_names/topic.json (probeOnly:true).");
