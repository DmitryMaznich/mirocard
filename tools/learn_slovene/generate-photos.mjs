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
  // The distractors of the Malica-only trial come first (1–2); words of later
  // sets, so the pictures are reused there (3–4 added for sets 2–5).
  zoga: [
    "a red and white children's rubber ball",
    "a blue children's play ball",
    "a classic black and white football",
    "a yellow children's rubber ball",
  ],
  knjiga: [
    "a closed children's hardcover book with a plain red cover, no title",
    "an open book lying flat, pages blank of readable text",
    "a closed thick book with a plain green cover, no title",
    "a small stack of three closed books with plain covers, no titles",
  ],
  cevlji: [
    "a pair of children's sneakers, plain, no brand",
    "a pair of brown children's shoes",
    "a pair of red children's sneakers with velcro straps, no brand",
    "a pair of children's winter boots",
  ],
  svincnik: [
    "one yellow pencil with a pink eraser, lying diagonally",
    "one green wooden pencil, sharpened, lying diagonally",
    "one blue wooden pencil, sharpened, lying diagonally",
    "one red wooden pencil with an eraser, lying diagonally",
  ],
  kapa: [
    "a knitted children's winter hat with a pompom",
    "a plain blue knitted winter hat",
    "a red knitted children's winter hat with a pompom",
    "a grey knitted beanie hat",
  ],
  skarje: [
    "a pair of children's safety scissors with round tips and blue handles",
    "a pair of children's scissors with red handles",
    "a pair of children's scissors with green handles",
    "a pair of children's scissors with yellow handles, open",
  ],

  // Set 2: the body (from school commands such as «umij roke»).
  nos: [
    "close-up of a child's nose, face cropped from the eyes to the mouth",
    "close-up of an adult's nose, face cropped from the eyes to the mouth",
    "a child touching the tip of their own nose with one finger, face visible, neutral background",
    "side profile close-up of a child's nose",
  ],
  uho: [
    "close-up of a child's ear, side of the head",
    "close-up of an adult's ear, side of the head",
    "a child pointing at their own ear with one finger, side view",
    "close-up of a child's ear with short hair around it",
  ],
  noga: [
    "a child's bare leg and foot standing, from the knee down, side view",
    "a child's leg in trousers and a sock, from the knee down",
    "an adult's bare leg and foot from the knee down, side view",
    "a child standing on one leg, whole child visible, simple background",
  ],
  roke: [
    "two open child's hands, palms up",
    "two adult hands, palms facing the camera",
    "a child washing both hands under a running tap with soap",
    "two child's hands, backs of the hands up",
  ],

  // Set 3: the classroom.
  sola: [
    "a modern two-storey school building with large windows, daytime, no signs, no text",
    "the entrance of a school building with glass doors, no signs, no text",
    "a small rural school building with a red roof, no signs",
    "a school building with a playground in front, no signs, no text",
  ],
  miza: [
    "a plain wooden school desk, no chair",
    "a plain white table with four legs, no chair",
    "a round wooden kitchen table, no chairs",
    "a child's small classroom table, no chairs",
  ],
  zvezek: [
    "a closed school exercise notebook with a plain blue cover, no text",
    "an open school exercise notebook with lined pages, no writing",
    "a closed school exercise notebook with a plain yellow cover, no text",
    "an open squared-paper school notebook, no writing",
  ],
  barvice: [
    "a set of coloured pencils fanned out in a rainbow row",
    "an open box of wax crayons, many colours, no brand",
    "a few coloured pencils standing in a cup",
    "a handful of coloured pencils lying in a loose row",
  ],
  lepilo: [
    "a glue stick with the cap off, plain, no label",
    "a small white bottle of school glue, no label",
    "a glue stick with the cap on, plain purple, no label",
    "a glue stick and its cap lying next to it, plain, no label",
  ],
  tabla: [
    "a green classroom chalkboard on a wall, empty, no writing",
    "a white classroom whiteboard on a wall, empty, no writing",
    "a small black chalkboard on a wooden frame, empty",
    "a classroom wall with a large empty whiteboard",
  ],
  torba: [
    "a children's school backpack, plain blue, no logo",
    "a children's school backpack, plain red, no logo",
    "a rigid children's school bag with straps, plain green, no logo",
    "a children's school backpack, plain yellow and grey, no logo",
  ],

  // Set 4: the cloakroom, the playground, the way to school.
  copati: [
    "a pair of children's indoor slippers, plain blue",
    "a pair of children's indoor slippers with a velcro strap, plain red",
    "a pair of children's felt house slippers, grey",
    "a pair of children's indoor slippers, plain green",
  ],
  jakna: [
    "a children's winter jacket, plain red, front view, laid flat",
    "a children's rain jacket, plain yellow, front view",
    "a children's padded jacket, plain dark blue, on a hanger",
    "a children's light jacket, plain green, front view, laid flat",
  ],
  avtobus: [
    "a city bus seen from the side, plain white and blue, no text, no advertising",
    "a white minibus seen from the front three-quarters, no text, no logos",
    "a red bus seen from the side, no text",
    "a small school minibus, plain white, no text",
  ],

  // Set 1, later: the bread and the snack itself.
  kruh: [
    "a loaf of brown bread",
    "a few slices of white bread",
    "a round loaf of crusty bread",
    "a bread roll",
  ],
  malica: [
    "an open children's lunchbox with a sandwich and pieces of fruit",
    "a school canteen tray with a sandwich, a cup and a piece of fruit",
    "a plate with a small sandwich, a yogurt and cucumber slices",
    "an open lunchbox with crackers, cheese cubes and grapes",
  ],

  // Set 5: stol (стул) — never next to miza (стол).
  stol: [
    "a plain wooden chair, side view",
    "a children's school chair, plain blue seat",
    "a white plastic chair",
    "a wooden kitchen chair, front three-quarter view",
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
