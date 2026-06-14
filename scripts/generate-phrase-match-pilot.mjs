/**
 * generate-phrase-match-pilot.mjs
 * Generates 25 images via Gemini, builds phrase_match_pilot ZIP deck.
 *
 * Usage:
 *   node scripts/generate-phrase-match-pilot.mjs          # generate all
 *   node scripts/generate-phrase-match-pilot.mjs --skip   # skip cached images
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "cardgen-studio", "projects", "phrase_match_pilot", "generated");
const TOPIC_ID  = "phrase_match_pilot";
const VERSION   = "1.1.0";
const ZIP_PATH  = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);
const SKIP      = process.argv.includes("--skip");

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
    if (/^['"].*['"]$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(ROOT, ".env.local"));
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env");
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env.local");

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";

if (!API_KEY) { console.error("GEMINI_API_KEY not found"); process.exit(1); }
console.log(`Model: ${MODEL}\n`);

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── Gemini call ───────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts   = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p?.inlineData || p?.inline_data);
  const inline  = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image in response");
  return Buffer.from(inline.data, "base64");
}

// ── Image definitions ─────────────────────────────────────────────────────────
const BASE = "high-quality photorealistic educational flashcard image, natural soft lighting, sharp focus, clean white background, true-to-life colors, square 1:1 composition, no text, no watermark, child-friendly";

const IMAGES = [
  // Group: soup
  { id: "soup_pour",  prompt: `${BASE}, soup ladle — a stainless steel ladle with a long handle, single object, centered` },
  { id: "soup_eat",   prompt: `${BASE}, tablespoon — a silver metal soup spoon, single object, centered` },
  { id: "soup_cook",  prompt: `${BASE}, cooking pot — a large metal pot with two side handles and a lid, single object, centered` },
  { id: "d_fork",     prompt: `${BASE}, dinner fork — a silver metal dining fork, single object, centered` },
  { id: "d_plate",    prompt: `${BASE}, round white ceramic dinner plate, empty, seen from above, single object, centered` },

  // Group: cut
  { id: "cut_bread",  prompt: `${BASE}, bread knife — a stainless steel bread knife with serrated edge, single object, centered` },
  { id: "cut_paper",  prompt: `${BASE}, scissors — a pair of red-handled scissors, single object, centered` },
  { id: "cut_nails",  prompt: `${BASE}, nail clippers — a small metal nail clipper, single object, centered` },
  { id: "d_pencil",   prompt: `${BASE}, yellow pencil with eraser tip, single object, centered` },
  { id: "d_ruler",    prompt: `${BASE}, transparent plastic ruler with centimeter markings, single object, centered` },

  // Group: transport
  { id: "transp_road", prompt: `${BASE}, yellow city bus on a road, side view, single vehicle, centered` },
  { id: "transp_sky",  prompt: `${BASE}, commercial airplane in flight against a light sky, side view, centered` },
  { id: "transp_sea",  prompt: `${BASE}, large passenger ship at sea, white hull, side view, centered` },
  { id: "d_bike",      prompt: `${BASE}, red bicycle, side view, single object, centered` },
  { id: "d_train",     prompt: `${BASE}, modern passenger train on rails, side view, centered` },

  // Group: clothing
  { id: "cloth_wash",  prompt: `${BASE}, white front-load washing machine, single appliance, centered` },
  { id: "cloth_iron",  prompt: `${BASE}, electric clothes iron, steam iron, single object, centered` },
  { id: "cloth_dry",   prompt: `${BASE}, clothesline with colorful clothes hanging and wooden clothespins, centered` },
  { id: "d_wardrobe",  prompt: `${BASE}, tall wooden wardrobe with two doors, furniture, single object, centered` },
  { id: "d_hanger",    prompt: `${BASE}, wooden clothes hanger, single object, centered` },

  // Group: play
  { id: "play_with",   prompt: `${BASE}, two young girls smiling and playing together, friends, warm scene, centered` },
  { id: "play_where",  prompt: `${BASE}, colorful children's playground with slide and swings, outdoor, centered` },
  { id: "play_what",   prompt: `${BASE}, colorful round ball, bright and clean, single object, centered` },
  { id: "d_doll",      prompt: `${BASE}, cute children's doll with yellow hair and pink dress, single toy, centered` },
  { id: "d_play_bike", prompt: `${BASE}, small children's bicycle with training wheels, side view, centered` },
];

// ── Generate & cache images ───────────────────────────────────────────────────
const webpBuffers = {};

for (const img of IMAGES) {
  const cachePath = path.join(CACHE_DIR, `${img.id}.webp`);

  if (SKIP && fs.existsSync(cachePath)) {
    console.log(`  ↩ ${img.id} (cached)`);
    webpBuffers[img.id] = fs.readFileSync(cachePath);
    continue;
  }

  console.log(`▶ ${img.id}…`);
  try {
    const raw    = await callGemini(img.prompt);
    const webp   = await sharp(raw).resize(512, 512, { fit: "contain", background: "#ffffff" }).webp({ quality: 85 }).toBuffer();
    fs.writeFileSync(cachePath, webp);
    webpBuffers[img.id] = webp;
    const kb = (webp.length / 1024).toFixed(0);
    console.log(`  ✓ ${img.id} (${kb} KB)`);
  } catch (err) {
    console.error(`  ✗ ${img.id}: ${err.message}`);
    process.exit(1);
  }
}

// ── deck.json ─────────────────────────────────────────────────────────────────
const deck = {
  meta: {
    id: TOPIC_ID,
    version: VERSION,
    renderer: "phrase_match",
    title: { ru: "Точное чтение" },
    language: "ru",
    minAppVersion: "1.0.0",
  },
  modes: [
    {
      id: "match",
      type: "match",
      evaluation: "instant",
      ui: {
        title: { ru: "Сопоставить" },
        instruction: { ru: "Перетащи картинку к нужной фразе" },
      },
      params: {
        answerType: {
          type: "enum",
          label: { ru: "Подсказки" },
          values: ["image", "text"],
          labels: { ru: { image: "Картинки", text: "Текстом" } },
          default: "image",
        },
      },
    },
  ],
  groups: [
    {
      id: "soup",
      items: [
        { id: "soup_pour", phrase: "Чем наливают суп?",  image: "media/soup_pour.webp",  answer: "Суп наливают половником"     },
        { id: "soup_eat",  phrase: "Чем едят суп?",       image: "media/soup_eat.webp",   answer: "Суп едят ложкой"             },
        { id: "soup_cook", phrase: "В чём варят суп?",    image: "media/soup_cook.webp",  answer: "Суп варят в кастрюле"        },
      ],
      distractors: [
        { id: "d_fork",  image: "media/d_fork.webp",  text: "Суп едят вилкой"      },
        { id: "d_plate", image: "media/d_plate.webp", text: "Суп подают в тарелке" },
      ],
    },
    {
      id: "cut",
      items: [
        { id: "cut_bread", phrase: "Чем режут хлеб?",   image: "media/cut_bread.webp", answer: "Хлеб режут ножом"       },
        { id: "cut_paper", phrase: "Чем режут бумагу?", image: "media/cut_paper.webp", answer: "Бумагу режут ножницами" },
        { id: "cut_nails", phrase: "Чем режут ногти?",  image: "media/cut_nails.webp", answer: "Ногти режут щипчиками"  },
      ],
      distractors: [
        { id: "d_pencil", image: "media/d_pencil.webp", text: "Бумагу режут карандашом" },
        { id: "d_ruler",  image: "media/d_ruler.webp",  text: "Бумагу режут линейкой"   },
      ],
    },
    {
      id: "transport",
      items: [
        { id: "transp_road", phrase: "На чём едут по дороге?", image: "media/transp_road.webp", answer: "По дороге едут на автобусе" },
        { id: "transp_sky",  phrase: "На чём летят по небу?",  image: "media/transp_sky.webp",  answer: "По небу летят на самолёте" },
        { id: "transp_sea",  phrase: "На чём плывут по морю?", image: "media/transp_sea.webp",  answer: "По морю плывут на корабле" },
      ],
      distractors: [
        { id: "d_bike",  image: "media/d_bike.webp",  text: "По дороге едут на велосипеде" },
        { id: "d_train", image: "media/d_train.webp", text: "По дороге едут на поезде"     },
      ],
    },
    {
      id: "clothing",
      items: [
        { id: "cloth_wash", phrase: "Чем стирают одежду?", image: "media/cloth_wash.webp", answer: "Одежду стирают в машине"   },
        { id: "cloth_iron", phrase: "Чем гладят одежду?",  image: "media/cloth_iron.webp", answer: "Одежду гладят утюгом"      },
        { id: "cloth_dry",  phrase: "Где сушат одежду?",   image: "media/cloth_dry.webp",  answer: "Одежду сушат на верёвке"   },
      ],
      distractors: [
        { id: "d_wardrobe", image: "media/d_wardrobe.webp", text: "Одежду хранят в шкафу"     },
        { id: "d_hanger",   image: "media/d_hanger.webp",   text: "Одежду вешают на вешалку"  },
      ],
    },
    {
      id: "play",
      items: [
        { id: "play_with",  phrase: "С кем играет девочка?",  image: "media/play_with.webp",  answer: "Девочка играет с подругой" },
        { id: "play_where", phrase: "Где играет девочка?",    image: "media/play_where.webp", answer: "Девочка играет на площадке"},
        { id: "play_what",  phrase: "Во что играет девочка?", image: "media/play_what.webp",  answer: "Девочка играет в мяч"     },
      ],
      distractors: [
        { id: "d_doll",      image: "media/d_doll.webp",      text: "Девочка играет с куклой"        },
        { id: "d_play_bike", image: "media/d_play_bike.webp", text: "Девочка катается на велосипеде" },
      ],
    },
  ],
};

// ── Build ZIP ─────────────────────────────────────────────────────────────────
const zip = new JSZip();
zip.file("topic.json", JSON.stringify(deck, null, 2));

for (const img of IMAGES) {
  zip.file(`media/${img.id}.webp`, webpBuffers[img.id]);
}

const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
fs.writeFileSync(ZIP_PATH, zipBuffer);
const zipKb = (zipBuffer.length / 1024).toFixed(0);
console.log(`\n✓ ZIP saved: ${ZIP_PATH} (${zipKb} KB)`);

// ── Update catalog.json ───────────────────────────────────────────────────────
const catalogPath = path.join(ROOT, "public", "decks", "catalog.json");
const catalog     = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const entry = {
  id: TOPIC_ID,
  version: VERSION,
  renderer: "phrase_match",
  url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  title: { ru: "Точное чтение" },
  description: { ru: "Пилот: 5 групп похожих фраз. Перетащи картинку к нужной фразе." },
};
const idx = catalog.decks.findIndex((d) => d.id === TOPIC_ID);
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
console.log("\nDone. Run 'npm run deploy:prod' to publish.");
