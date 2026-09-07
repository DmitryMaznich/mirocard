// Adds one more real photo per concept (boy/girl/man/woman) to the regular
// teaching pool, deliberately using more conventionally pronounced gender
// markers than the existing 8 photos (which the user found ambiguous:
// women in trousers, some with short hair). These are additive, not
// replacements - the existing photos stay exactly as they are ("пусть
// будут"). Also grows the generalization set per the earlier-deferred
// "not enough cards" follow-up.
//
// Same photorealistic studio style as generate-people-names-probe-photos.mjs.
//
// Usage: node scripts/generate-people-names-gendered-photos.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/decks/_assets/people_names");
const API_KEY = getGeminiApiKey();
const MODEL   = "gemini-3.1-flash-image";

const STYLE =
  "professional studio fashion-catalog photograph, photorealistic, a single " +
  "person standing facing the camera directly, relaxed natural pose, soft " +
  "even studio lighting, waist-up-to-full-body framing with some headroom, " +
  "gentle neutral or softly smiling expression, plain seamless grey studio " +
  "backdrop, sharp focus, high detail, no text, no logos, no watermark, " +
  "square 1:1 composition";

const TARGETS = [
  {
    id: "boy_sport",
    conceptId: "boy",
    label: "мальчик (2)",
    prompt: `${STYLE}. A boy of about 7 years old, short cropped hair, ` +
      `wearing a sports jersey and shorts, sneakers, holding a football ` +
      `under one arm.`,
  },
  {
    id: "girl_dress",
    conceptId: "girl",
    label: "девочка (2)",
    prompt: `${STYLE}. A girl of about 7 years old, long hair in two ` +
      `braids with small bows, wearing a knee-length dress with a bow at ` +
      `the waist, white tights, patent leather shoes.`,
  },
  {
    id: "man_beard",
    conceptId: "man",
    label: "мужчина (2)",
    prompt: `${STYLE}. A man of about 35 years old, short hair, a full ` +
      `beard, broad shoulders and sturdy build, wearing a flannel shirt ` +
      `and jeans, work boots.`,
  },
  {
    id: "woman_dress",
    conceptId: "woman",
    label: "женщина (2)",
    prompt: `${STYLE}. A woman of about 35 years old, long wavy hair past ` +
      `the shoulders, wearing a fitted knee-length dress, heeled shoes, ` +
      `a delicate necklace.`,
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

console.log("\nDone. Review each photo, then wire the 4 new cards into tools/people_names/topic.json.");
