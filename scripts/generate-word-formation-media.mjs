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
const VERSION   = "1.0.3";
const ZIP_PATH  = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);

const GEMINI_KEY   = "AIzaSyAfKpjiMTIMGugV-WYRN_Rhk7vRKyXl-_k";
const GEMINI_MODEL = "gemini-2.5-flash-image";

const TTS_SA_PATH = "c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json";
const TTS_VOICE   = "ru-RU-Wavenet-D";
const TTS_RATE    = 0.9;

const QUESTION_TEXT = "Какой суп получится?";
const POT_PROMPT = "a large stainless steel cooking pot on a gas stove with blue flame burning underneath, steam rising from the pot, kitchen setting, warm natural lighting, top-down 3/4 view, clean white background, square composition, no text, no watermark, photorealistic educational photo";

const CONCEPTS = [
  { id: "ryba",    noun: "рыба",    nounPhrase: "суп из рыбы",    adjPhrase: "рыбный суп",    difficulty: "easy",   color: "#2196F3",
    imgPrompt: "a steaming bowl of fish soup, clear broth with pieces of white fish and vegetables, rustic wooden table, warm natural lighting, appetizing, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a fresh whole raw fish, lying on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "myaso",   noun: "мясо",    nounPhrase: "суп из мяса",    adjPhrase: "мясной суп",    difficulty: "easy",   color: "#F44336",
    imgPrompt: "a steaming bowl of meat soup, rich broth with chunks of tender beef, carrots, potatoes, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a piece of fresh raw beef meat, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "grib",    noun: "гриб",    nounPhrase: "суп из грибов",  adjPhrase: "грибной суп",   difficulty: "easy",   color: "#795548",
    imgPrompt: "a steaming bowl of mushroom soup, creamy or clear broth with sliced mushrooms and herbs, rustic wooden bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh whole champignon mushrooms, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kapusta", noun: "капуста", nounPhrase: "суп из капусты", adjPhrase: "капустный суп", difficulty: "easy",   color: "#4CAF50",
    imgPrompt: "a steaming bowl of cabbage soup, clear broth with shredded cabbage and vegetables, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a whole fresh white cabbage head, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kuritsa", noun: "курица",  nounPhrase: "суп из курицы",  adjPhrase: "куриный суп",   difficulty: "medium", color: "#FF9800",
    imgPrompt: "a steaming bowl of chicken soup, golden clear broth with chicken pieces, carrots, noodles, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a whole fresh raw chicken, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "goroh",   noun: "горох",   nounPhrase: "суп из гороха",  adjPhrase: "гороховый суп", difficulty: "medium", color: "#8BC34A",
    imgPrompt: "a steaming bowl of pea soup, thick creamy green soup with split peas, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "fresh green peas in pods, a small pile, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "luk",     noun: "лук",     nounPhrase: "суп из лука",    adjPhrase: "луковый суп",   difficulty: "medium", color: "#9C27B0",
    imgPrompt: "a steaming bowl of French onion soup, rich brown broth with caramelized onions and melted cheese crouton on top, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a few whole onions, one peeled, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "ovoschi", noun: "овощи",   nounPhrase: "суп из овощей",  adjPhrase: "овощной суп",   difficulty: "medium", color: "#009688",
    imgPrompt: "a steaming bowl of vegetable soup, colorful clear broth with carrots, peas, zucchini, tomatoes, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a colorful mix of fresh vegetables: carrot, zucchini, tomato, bell pepper, arranged together on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "fasolj",  noun: "фасоль",  nounPhrase: "суп из фасоли",  adjPhrase: "фасолевый суп", difficulty: "hard",   color: "#E91E63",
    imgPrompt: "a steaming bowl of bean soup, thick soup with red and white beans, tomatoes and herbs, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry red and white beans, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "tikva",   noun: "тыква",   nounPhrase: "суп из тыквы",   adjPhrase: "тыквенный суп", difficulty: "hard",   color: "#FF9800",
    imgPrompt: "a steaming bowl of pumpkin soup, smooth bright orange creamy soup, rustic ceramic bowl with a swirl of cream and pumpkin seeds on top, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small bright orange pumpkin and a slice showing the orange flesh, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function cached(name) { return path.join(CACHE_DIR, name); }

function isCached(name) { return existsSync(cached(name)); }

// ─── Gemini Imagen ───────────────────────────────────────────────────────────

async function generateImageFromPrompt(filename, prompt, label) {
  if (isCached(filename)) {
    console.log(`  [cache] image ${filename}`);
    return readFileSync(cached(filename));
  }

  process.stdout.write(`  [img]  ${label}: generating ... `);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );

  const body = await resp.json();
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${body?.error?.message}`);

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const inlineData = imgPart?.inlineData || imgPart?.inline_data;
  if (!inlineData?.data) throw new Error(`No image in response for ${label}`);

  const raw = Buffer.from(inlineData.data, "base64");
  const webp = await sharp(raw).resize(512, 512, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer();

  writeFileSync(cached(filename), webp);
  console.log(`OK (${Math.round(webp.length / 1024)} KB)`);
  await sleep(500);
  return webp;
}

function generateSoupImage(concept) {
  return generateImageFromPrompt(`${concept.id}.webp`, concept.imgPrompt, concept.id);
}

function generateIngredientImage(concept) {
  return generateImageFromPrompt(`${concept.id}_ingredient.webp`, concept.ingredientPrompt, `${concept.id} (ingredient)`);
}

function generatePotImage() {
  return generateImageFromPrompt("pot.webp", POT_PROMPT, "pot");
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
  // kind: "prep" (Готовим суп из X) | "adj" (Рыбный суп)
  const text     = kind === "prep" ? `Готовим ${concept.nounPhrase}` : concept.adjPhrase;
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

async function generateQuestionAudio(sa) {
  const filename = "question.mp3";
  if (isCached(filename)) {
    console.log(`  [cache] audio ${filename}`);
    return readFileSync(cached(filename));
  }
  process.stdout.write(`  [tts]  ${filename}: "${QUESTION_TEXT}" ... `);
  const buf = await tts(sa, QUESTION_TEXT);
  writeFileSync(cached(filename), buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
  await sleep(200);
  return buf;
}

// ─── Build topic.json ────────────────────────────────────────────────────────

function buildTopic() {
  const cards = CONCEPTS.map(c => ({
    id:               c.id,
    noun:             c.noun,
    nounPhrase:       c.nounPhrase,
    adjPhrase:        c.adjPhrase,
    difficulty:       c.difficulty,
    color:            c.color,
    image:            `media/${c.id}.webp`,
    ingredientImage:  `media/${c.id}_ingredient.webp`,
    audioPrepPhrase:  `audio/${c.id}_prep.mp3`,
    audioAdjPhrase:   `audio/${c.id}_adj.mp3`,
    vesselImage:      "media/pot.webp",
    questionText:     QUESTION_TEXT,
  }));

  return {
    meta: {
      id: TOPIC_ID, renderer: "word_formation", version: VERSION,
      title: { ru: "Суп: словообразование", en: "Soup: word formation" }, language: "ru",
      potImage:      "media/pot.webp",
      questionAudio: "audio/question.mp3",
      questionText:  QUESTION_TEXT,
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
  const potImage = await generatePotImage();
  const soupImages = {};
  const ingredientImages = {};
  for (const concept of CONCEPTS) {
    soupImages[concept.id]       = await generateSoupImage(concept);
    ingredientImages[concept.id] = await generateIngredientImage(concept);
  }

  console.log("\n=== Генерация аудио ===");
  const questionAudio = await generateQuestionAudio(sa);
  const audio = {};
  for (const concept of CONCEPTS) {
    audio[`${concept.id}_prep`] = await generateAudio(sa, concept, "prep");
    audio[`${concept.id}_adj`] = await generateAudio(sa, concept, "adj");
  }

  console.log("\n=== Упаковка ZIP ===");
  const topic = buildTopic();
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify(topic, null, 2));
  zip.file("media/pot.webp", potImage);
  zip.file("audio/question.mp3", questionAudio);
  for (const concept of CONCEPTS) {
    zip.file(`media/${concept.id}.webp`, soupImages[concept.id]);
    zip.file(`media/${concept.id}_ingredient.webp`, ingredientImages[concept.id]);
    zip.file(`audio/${concept.id}_prep.mp3`, audio[`${concept.id}_prep`]);
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
