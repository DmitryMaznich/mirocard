/**
 * Generates real photos and audio for word_formation_soup deck.
 * Output: public/decks/word_formation_soup_v1.0.1.zip
 *
 * Credentials:
 *   GEMINI_API_KEY — from c:/Users/dmazn/Projects/Mirocard/.env.local
 *   Google TTS SA  — c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json
 */

import { createSign } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "word_formation_soup");

const TOPIC_ID  = "word_formation_soup";
const VERSION   = "1.0.1";
const ZIP_PATH  = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);

const GEMINI_KEY   = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";
const GEMINI_MODEL = "gemini-2.5-flash-image";

const TTS_SA_PATH = "c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const TTS_VOICE   = "ru-RU-Wavenet-D";
const TTS_RATE    = 0.9;

const CONCEPTS = [
  { id: "ryba",    noun: "рыба",    nounPhrase: "суп из рыбы",    adjPhrase: "рыбный суп",    difficulty: "easy",   color: "#2196F3",
    imgPrompt: "a steaming bowl of fish soup, clear broth with pieces of white fish and vegetables, rustic wooden table, warm natural lighting, appetizing, top-down view, square composition, no text, no watermark" },
  { id: "myaso",   noun: "мясо",    nounPhrase: "суп из мяса",    adjPhrase: "мясной суп",    difficulty: "easy",   color: "#F44336",
    imgPrompt: "a steaming bowl of meat soup, rich broth with chunks of tender beef, carrots, potatoes, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "grib",    noun: "гриб",    nounPhrase: "суп из грибов",  adjPhrase: "грибной суп",   difficulty: "easy",   color: "#795548",
    imgPrompt: "a steaming bowl of mushroom soup, creamy or clear broth with sliced mushrooms and herbs, rustic wooden bowl, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "kapusta", noun: "капуста", nounPhrase: "суп из капусты", adjPhrase: "капустный суп", difficulty: "easy",   color: "#4CAF50",
    imgPrompt: "a steaming bowl of cabbage soup, clear broth with shredded cabbage and vegetables, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "kuritsa", noun: "курица",  nounPhrase: "суп из курицы",  adjPhrase: "куриный суп",   difficulty: "medium", color: "#FF9800",
    imgPrompt: "a steaming bowl of chicken soup, golden clear broth with chicken pieces, carrots, noodles, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "goroh",   noun: "горох",   nounPhrase: "суп из гороха",  adjPhrase: "гороховый суп", difficulty: "medium", color: "#8BC34A",
    imgPrompt: "a steaming bowl of pea soup, thick creamy green soup with split peas, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "luk",     noun: "лук",     nounPhrase: "суп из лука",    adjPhrase: "луковый суп",   difficulty: "medium", color: "#9C27B0",
    imgPrompt: "a steaming bowl of French onion soup, rich brown broth with caramelized onions and melted cheese crouton on top, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "ovoschi", noun: "овощи",   nounPhrase: "суп из овощей",  adjPhrase: "овощной суп",   difficulty: "medium", color: "#009688",
    imgPrompt: "a steaming bowl of vegetable soup, colorful clear broth with carrots, peas, zucchini, tomatoes, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "fasolj",  noun: "фасоль",  nounPhrase: "суп из фасоли",  adjPhrase: "фасолевый суп", difficulty: "hard",   color: "#E91E63",
    imgPrompt: "a steaming bowl of bean soup, thick soup with red and white beans, tomatoes and herbs, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark" },
  { id: "tomat",   noun: "томат",   nounPhrase: "суп из томата",  adjPhrase: "томатный суп",  difficulty: "hard",   color: "#FF5722",
    imgPrompt: "a steaming bowl of tomato soup, smooth bright red tomato bisque, rustic ceramic bowl with fresh basil leaf, warm natural lighting, top-down view, square composition, no text, no watermark" },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function cached(name) { return path.join(CACHE_DIR, name); }

function isCached(name) { return existsSync(cached(name)); }

// ─── Gemini Imagen ───────────────────────────────────────────────────────────

async function generateImage(concept) {
  const filename = `${concept.id}.webp`;
  if (isCached(filename)) {
    console.log(`  [cache] image ${concept.id}`);
    return readFileSync(cached(filename));
  }

  process.stdout.write(`  [img]  ${concept.id}: generating ... `);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: concept.imgPrompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );

  const body = await resp.json();
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${body?.error?.message}`);

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const inlineData = imgPart?.inlineData || imgPart?.inline_data;
  if (!inlineData?.data) throw new Error(`No image in response for ${concept.id}`);

  const raw = Buffer.from(inlineData.data, "base64");
  const webp = await sharp(raw).resize(512, 512, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer();

  writeFileSync(cached(filename), webp);
  console.log(`OK (${Math.round(webp.length / 1024)} KB)`);
  await sleep(500);
  return webp;
}

// ─── Google Cloud TTS ────────────────────────────────────────────────────────

let _token = null, _tokenExp = 0;

async function getTtsToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExp - 60) return _token;

  const hdr = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const pay = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.update(hdr + "." + pay);
  const jwt = hdr + "." + pay + "." + signer.sign(sa.private_key, "base64url");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });
  const b = await r.json();
  if (!b.access_token) throw new Error("TTS token error: " + JSON.stringify(b));
  _token = b.access_token;
  _tokenExp = now + (b.expires_in || 3600);
  return _token;
}

async function tts(sa, text) {
  const token = await getTtsToken(sa);
  const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ru-RU", name: TTS_VOICE },
      audioConfig: { audioEncoding: "MP3", speakingRate: TTS_RATE },
    }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(`TTS ${r.status}: ${b?.error?.message}`);
  return Buffer.from(b.audioContent, "base64");
}

async function generateAudio(sa, concept, kind) {
  // kind: "noun" | "adj"
  const text    = kind === "noun" ? concept.nounPhrase : concept.adjPhrase;
  const filename = `${concept.id}_${kind}.mp3`;
  if (isCached(filename)) {
    console.log(`  [cache] audio ${filename}`);
    return readFileSync(cached(filename));
  }
  process.stdout.write(`  [tts]  ${filename}: "${text}" ... `);
  const buf = await tts(sa, text);
  writeFileSync(cached(filename), buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
  await sleep(200);
  return buf;
}

// ─── Build topic.json ────────────────────────────────────────────────────────

function buildTopic() {
  const cards = CONCEPTS.map(c => ({
    id:              c.id,
    noun:            c.noun,
    nounPhrase:      c.nounPhrase,
    adjPhrase:       c.adjPhrase,
    difficulty:      c.difficulty,
    color:           c.color,
    image:           `media/${c.id}.webp`,
    audioNounPhrase: `audio/${c.id}_noun.mp3`,
    audioAdjPhrase:  `audio/${c.id}_adj.mp3`,
  }));

  return {
    meta: {
      id: TOPIC_ID, renderer: "word_formation", version: VERSION,
      title: { ru: "Суп: словообразование", en: "Soup: word formation" }, language: "ru",
    },
    modes: [
      { id: "pair_intro",   type: "pair_intro",   evaluation: "none", requirePin: false,
        ui: { title: { ru: "Знакомство с парами" }, instruction: { ru: "Листайте пары: суп из … → … суп" } } },
      { id: "form_it",      type: "form_it",      evaluation: "auto", requirePin: false,
        ui: { title: { ru: "Образуй прилагательное" }, instruction: { ru: "Нажми на правильное слово" } },
        params: {
          stimulus:    { type: "enum",   label: { ru: "Стимул" },     values: ["phrase","image","mixed"], default: "mixed" },
          optionCount: { type: "enum",   label: { ru: "Вариантов" },  values: [2,3,4], default: 4 },
        },
      },
      { id: "yes_no",       type: "yes_no",       evaluation: "auto", requirePin: false,
        ui: { title: { ru: "Правильно / Нет?" }, instruction: { ru: "Это правильное словосочетание?" } },
        params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 5 } },
      },
      { id: "question_ask", type: "question_ask", evaluation: "none", requirePin: true,
        ui: { title: { ru: "Назови суп" }, instruction: { ru: "Логопед задаёт вопрос устно" } },
      },
    ],
    cards,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  ensureDir(CACHE_DIR);

  const sa = JSON.parse(readFileSync(TTS_SA_PATH, "utf8"));

  console.log("\n=== Генерация изображений ===");
  const images = {};
  for (const concept of CONCEPTS) {
    images[concept.id] = await generateImage(concept);
  }

  console.log("\n=== Генерация аудио ===");
  const audio = {};
  for (const concept of CONCEPTS) {
    audio[`${concept.id}_noun`] = await generateAudio(sa, concept, "noun");
    audio[`${concept.id}_adj`]  = await generateAudio(sa, concept, "adj");
  }

  console.log("\n=== Упаковка ZIP ===");
  const topic = buildTopic();
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify(topic, null, 2));
  for (const concept of CONCEPTS) {
    zip.file(`media/${concept.id}.webp`, images[concept.id]);
    zip.file(`audio/${concept.id}_noun.mp3`, audio[`${concept.id}_noun`]);
    zip.file(`audio/${concept.id}_adj.mp3`,  audio[`${concept.id}_adj`]);
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(ZIP_PATH, buf);
  console.log(`✓ ${ZIP_PATH} (${(buf.length / 1024).toFixed(0)} KB)`);

  const catalogPath = path.join(ROOT, "public", "decks", "catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  // Remove old versions of this deck
  catalog.decks = catalog.decks.filter(d => d.id !== TOPIC_ID);
  catalog.decks.push({
    id: TOPIC_ID, version: VERSION,
    url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
    zipUrl: `${TOPIC_ID}_v${VERSION}.zip`,
    title: { ru: "Суп: словообразование", en: "Soup: word formation" },
    renderer: "word_formation",
  });
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log("✓ catalog.json updated");
}

main().catch(e => { console.error(e); process.exit(1); });
