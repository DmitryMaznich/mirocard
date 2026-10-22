// Picture candidates for «Учим словенский» via Gemini (gemini-2.5-flash-image).
// Real stock photos were the plan (docs/learn-slovene.md), but Pexels/Openverse/
// Wikimedia are closed to cloud sessions; the owner chose generation instead
// (2026-10-22). Single everyday objects on a plain background generate well;
// what failed for verbs_v2 (people using objects) does not apply here.
//
// Each word gets several different-looking variants (colour, shape, vessel),
// so the child learns the concept, not one picture. The owner picks 3 per word
// from the contact sheet; candidates/ is scratch, only picked files go to media/.
//
// Usage: node tools/learn_slovene/generate-photos.mjs [--keys=voda,sok] [--force]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "candidates");
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const args = process.argv.slice(2);
const keysArg = args.find((a) => a.startsWith("--keys="));
const KEYS = keysArg ? new Set(keysArg.slice(7).split(",")) : null;
const FORCE = args.includes("--force");

const STYLE = "realistic photograph, one single object centered and filling about two thirds of a square frame, "
  + "plain very light neutral background, soft even daylight, sharp focus, "
  + "no text, no letters, no logos, no labels, no hands, no people, no other objects";

const SUBJECTS = {
  voda: [
    "a tall clear drinking glass full of plain water",
    "a short clear glass tumbler half full of plain water, side view",
    "a clear plastic cup of plain water, like a school canteen cup",
    "a clear glass of plain water with a few drops of condensation on the outside",
  ],
  sok: [
    "a clear glass of orange juice",
    "a clear glass of cloudy apple juice",
    "a small plain carton juice box with a bendy straw, plain single colour, no print",
    "a clear glass of red berry juice",
  ],
  caj: [
    "a white mug of hot tea with a tea bag string and tag hanging over the rim, steam rising",
    "a clear glass mug of amber tea, steam rising",
    "a white teacup of tea on a saucer",
    "a cup of tea with a slice of lemon floating in it",
  ],
  jabolko: [
    "one whole shiny red apple with a short stem",
    "one whole green apple with a leaf on the stem",
    "one whole yellow and red striped apple",
    "one whole red apple seen slightly from above",
  ],
  banana: [
    "one ripe yellow banana",
    "a small bunch of three ripe yellow bananas",
    "one yellow banana with the peel partly pulled down",
    "one slightly green banana",
  ],
  hruska: [
    "one whole green pear with a stem",
    "one whole yellow pear",
    "one whole pear, yellow with a red blush",
    "one whole green pear with a leaf on the stem",
  ],
  mleko: [
    "a clear glass full of white milk",
    "a clear glass milk bottle full of white milk, no label",
    "a plain white milk carton, no print, next to nothing",
    "a clear mug full of white milk",
  ],
  sir: [
    "a wedge of yellow cheese with holes",
    "a few thin slices of yellow cheese stacked",
    "a block of yellow cheese on a small wooden board",
    "a wedge of pale hard cheese",
  ],
  // Not food: the distractors for the Malica-only trial (a distractor comes from
  // another situation). Words of later sets, so the pictures are reused there.
  zoga: [
    "a red and white children's rubber ball",
    "a blue children's play ball",
  ],
  knjiga: [
    "a closed children's hardcover book with a plain red cover, no title",
    "an open book lying flat, pages blank of readable text",
  ],
  cevlji: [
    "a pair of children's sneakers, plain, no brand",
    "a pair of brown children's shoes",
  ],
  svincnik: [
    "one yellow pencil with a pink eraser, lying diagonally",
    "one green wooden pencil, sharpened, lying diagonally",
  ],
  kapa: [
    "a knitted children's winter hat with a pompom",
    "a plain blue knitted winter hat",
  ],
  skarje: [
    "a pair of children's safety scissors with round tips and blue handles",
    "a pair of children's scissors with red handles",
  ],
};

async function generate(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p?.inlineData || p?.inline_data);
  const data = (part?.inlineData ?? part?.inline_data)?.data;
  if (!data) throw new Error("no image returned");
  return Buffer.from(data, "base64");
}

if (!API_KEY) { console.error("GEMINI_API_KEY not set"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const jobs = Object.entries(SUBJECTS)
  .filter(([key]) => !KEYS || KEYS.has(key))
  .flatMap(([key, list]) => list.map((subject, i) => ({ key, n: i + 1, subject })))
  .filter((job) => FORCE || !existsSync(join(OUT, `${job.key}_${job.n}.webp`)));

const POOL = 4;
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const png = await generate(`${STYLE}. Subject: ${job.subject}.`);
        const file = join(OUT, `${job.key}_${job.n}.webp`);
        writeFileSync(file, await sharp(png).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer());
        console.log(`ok   ${job.key}_${job.n}`);
        break;
      } catch (err) {
        console.log(`fail ${job.key}_${job.n} (${attempt}): ${err.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
}
await Promise.all(Array.from({ length: POOL }, worker));
